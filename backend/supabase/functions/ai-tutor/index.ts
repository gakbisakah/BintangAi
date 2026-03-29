import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const getAdminClient = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const clientApiKey = req.headers.get("x-api-key");
    const serverApiKey = Deno.env.get("CUSTOM_AI_TUTOR_KEY") || "christian";

    if (!clientApiKey || clientApiKey !== serverApiKey) {
      return new Response(JSON.stringify({ success: false, reply: "Akses ditolak. 🔒" }), { status: 401, headers: corsHeaders });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const body = await req.json();
    const message = body.message || body.query;
    const student_id = body.student_id || body.user_id;
    const { nama = "Teman", kelas = 4, weak_topics = [] } = body;

    if (!message) return new Response(JSON.stringify({ success: false, reply: "Pesan kosong. 😊" }), { status: 400, headers: corsHeaders });

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Kamu adalah Kak BintangAi, tutor ramah SD. Nama: ${nama}, Kelas: ${kelas}.
            Jika bertanya materi, akhiri dengan tag: [TOPIC: Nama Topik].`
          },
          { role: "user", content: message }
        ],
        temperature: 0.6,
      }),
    });

    const data = await groqResponse.json();
    let aiReply = data.choices?.[0]?.message?.content || "Maaf, Kak Bintang sedang pusing. 😊";

    let detectedTopic = null;
    const topicMatch = aiReply.match(/\[TOPIC:\s*(.*?)\]/);
    if (topicMatch) {
      detectedTopic = topicMatch[1].trim();
      aiReply = aiReply.replace(/\[TOPIC:.*?\]/, "").trim();
    }

    // ATOMIC & SCALABLE UPDATE menggunakan RPC
    if (detectedTopic && student_id) {
      const adminSupabase = getAdminClient();
      // Menggunakan rpc 'add_weak_topic' yang lebih stabil untuk banyak pengguna sekaligus
      await adminSupabase.rpc('add_weak_topic', {
        target_user_id: student_id,
        new_topic: detectedTopic
      });
      console.log(`Realtime Weak Topic Updated for ${student_id}: ${detectedTopic}`);
    }

    return new Response(JSON.stringify({ success: true, reply: aiReply, detected_topic: detectedTopic }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, reply: "Terjadi kesalahan sistem. 😊" }), { status: 500, headers: corsHeaders });
  }
});
