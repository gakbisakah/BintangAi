import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

// Gunakan Service Role Key untuk bypass RLS agar penulisan ke profil siswa selalu berhasil
const getAdminClient = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
};

function normalizeTopic(topic) {
  return topic.toLowerCase().trim().replace(/[\[\]]/g, '');
}

// Fungsi deteksi yang lebih pintar (mencari tag AI atau kata kunci)
function extractTopics(text) {
  const topics = new Set();

  // 1. Coba cari tag AI: <!--TOPICS:[topic1,topic2]-->
  const aiTagMatch = text.match(/<!--TOPICS:\[(.*?)\]-->/);
  if (aiTagMatch && aiTagMatch[1]) {
    aiTagMatch[1].split(',').forEach(t => topics.add(normalizeTopic(t)));
  }

  // 2. Fallback ke deteksi kata kunci sederhana
  const textLower = text.toLowerCase();
  const keywords = {
    "pecahan": ["pecahan", "per", "pembilang", "penyebut"],
    "penjumlahan": ["tambah", "jumlah", "total"],
    "pengurangan": ["kurang", "selisih", "sisa"],
    "perkalian": ["kali", "perkalian"],
    "pembagian": ["bagi", "pembagian"]
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => textLower.includes(w))) {
      topics.add(topic);
    }
  }

  return Array.from(topics).slice(0, 5);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { student_id, action, topics, question, answer } = await req.json();
    const adminSupabase = getAdminClient();

    if (action === "detect") {
      const detected = extractTopics(`${question} ${answer}`);
      return new Response(JSON.stringify({ topics: detected }), { status: 200, headers: corsHeaders });
    }

    if (action === "add") {
      if (!student_id) throw new Error("student_id required");

      // Ambil data lama
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('weak_topics')
        .eq('id', student_id)
        .single();

      const existingTopics = profile?.weak_topics || [];
      const updatedTopics = Array.from(new Set([...existingTopics, ...topics]));

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
      status: 200, // Tetap return 200 agar frontend tidak crash, tapi sertakan error
      headers: corsHeaders
    });
  }
});
