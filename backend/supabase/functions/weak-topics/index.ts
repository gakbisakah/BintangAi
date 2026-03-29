import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
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
    const { student_id, action, question, answer, topics } = await req.json();
    const adminSupabase = getAdminClient();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    if (action === "detect") {
      // Gunakan AI untuk mendeteksi topik dari soal yang salah
      if (!GROQ_API_KEY) {
        // Fallback ke keyword jika API key tidak ada
        return new Response(JSON.stringify({ topics: ["Umum"] }), { status: 200, headers: corsHeaders });
      }

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "Kamu adalah asisten analisis pendidikan. Tugasmu mendeteksi 1 topik utama (max 2 kata) dari teks soal dan jawaban berikut. Balas HANYA dengan nama topiknya saja tanpa penjelasan apa pun. Contoh: 'Pecahan', 'Tata Surya', 'Fotosintesis'."
            },
            { role: "user", content: `Soal: ${question}\nJawaban Siswa: ${answer}` }
          ],
          temperature: 0.1,
        }),
      });

      const aiData = await groqResponse.json();
      const detectedTopic = aiData.choices?.[0]?.message?.content?.trim() || "Materi Umum";

      return new Response(JSON.stringify({ topics: [detectedTopic] }), { status: 200, headers: corsHeaders });
    }

    if (action === "add") {
      if (!student_id || !topics) throw new Error("student_id and topics required");

      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('weak_topics')
        .eq('id', student_id)
        .single();

      const existingTopics = profile?.weak_topics || [];
      const updatedTopics = Array.from(new Set([...existingTopics, ...topics])).slice(-10);

      const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({ weak_topics: updatedTopics })
        .eq('id', student_id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, topics: updatedTopics }), {
        status: 200,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: corsHeaders
    });
  }
});
