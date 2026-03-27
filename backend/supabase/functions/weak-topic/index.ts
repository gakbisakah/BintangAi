import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

// Client dengan Service Role Key untuk bypass RLS
const getAdminClient = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
};

function normalizeTopic(topic) {
  return topic.toLowerCase().trim().replace(/[\[\]]/g, '');
}

function extractTopics(text) {
  const topics = new Set();
  const textLower = text.toLowerCase();

  console.log("Menganalisis teks untuk topik...");

  // 1. Deteksi Tag AI (Format: <!--TOPICS:pecahan,penjumlahan-->)
  const aiTagMatch = text.match(/<!--TOPICS:([\s\S]*?)-->/i);
  if (aiTagMatch && aiTagMatch[1]) {
    console.log("Tag AI ditemukan:", aiTagMatch[1]);
    const cleaned = aiTagMatch[1].replace(/[\[\]]/g, '');
    cleaned.split(',').forEach(t => {
      const norm = normalizeTopic(t);
      if (norm) topics.add(norm);
    });
  }

  // 2. Deteksi Simbol & Kata Kunci (Fallback Agresif)
  const keywords = {
    "penjumlahan": ["tambah", "jumlah", "+", "tambahkan"],
    "pengurangan": ["kurang", "-", "sisa", "dikurangi"],
    "perkalian": ["kali", "x", "*", "dikali"],
    "pembagian": ["bagi", "/", ":", "dibagi"],
    "pecahan": ["pecahan", "per", "/", "setengah", "seper"],
    "matematika": ["hitung", "berapa", "hasilnya"]
  };

  for (const [topic, words] of Object.entries(keywords)) {
    if (words.some(w => textLower.includes(w))) {
      console.log(`Kata kunci terdeteksi: '${topic}'`);
      topics.add(topic);
    }
  }

  const finalTopics = Array.from(topics).slice(0, 5);
  console.log("Hasil deteksi final:", finalTopics);
  return finalTopics;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { student_id, action, topics, question, answer } = await req.json();
    const adminSupabase = getAdminClient();

    console.log(`Action: ${action}, StudentID: ${student_id}`);

    // ACTION: DETECT
    if (action === "detect") {
      const detected = extractTopics(`${question} ${answer}`);
      return new Response(JSON.stringify({ topics: detected }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ACTION: ADD
    if (action === "add") {
      if (!student_id) throw new Error("ID Siswa tidak ditemukan!");
      if (!topics || topics.length === 0) return new Response(JSON.stringify({ success: true, message: "Tidak ada topik untuk ditambah" }), { status: 200, headers: corsHeaders });

      console.log("Mencoba mengupdate weak_topics untuk student:", student_id);

      // Ambil data profil saat ini
      const { data: profile, error: fetchError } = await adminSupabase
        .from('profiles')
        .select('weak_topics')
        .eq('id', student_id)
        .single();

      if (fetchError) {
        console.error("Gagal mengambil profil:", fetchError);
        throw fetchError;
      }

      const existingTopics = profile?.weak_topics || [];
      const updatedTopics = Array.from(new Set([...existingTopics, ...topics]));

      console.log("Update database dari:", existingTopics, "ke:", updatedTopics);

      // Update kolom weak_topics (pastikan nama kolom menggunakan underscore sesuai tabel)
      const { error: updateError } = await adminSupabase
        .from('profiles')
        .update({ weak_topics: updatedTopics })
        .eq('id', student_id);

      if (updateError) {
        console.error("Gagal mengupdate database:", updateError);
        throw updateError;
      }

      console.log("Berhasil mengupdate weak_topics!");
      return new Response(JSON.stringify({ success: true, topics: updatedTopics }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Action tidak valid" }), { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("Terjadi kesalahan di Edge Function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Tetap 200 agar frontend tidak crash, tapi sertakan pesan error
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
