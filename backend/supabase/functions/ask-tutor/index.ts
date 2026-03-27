import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Verifikasi Otorisasi Custom (x-api-key)
    const clientApiKey = req.headers.get("x-api-key");
    const serverApiKey = Deno.env.get("x-api-key");

    if (!clientApiKey || clientApiKey !== serverApiKey) {
      return new Response(JSON.stringify({
        success: false,
        answer: "Akses ditolak. Kode keamanan salah."
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    // Mendukung query, question, atau message
    const question = body.query || body.question || body.message;
    const { context, user_profile } = body;

    if (!question) {
      throw new Error('Pertanyaan tidak boleh kosong (gunakan field "question", "query", atau "message").');
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY tidak ditemukan di server.");
    }

    const systemRole = `Kamu adalah BintangAi, tutor pendamping belajar SD yang sangat sabar dan ramah.
Siswa ini memiliki kebutuhan khusus: ${user_profile?.disability_type || 'Umum'} dan berada di kelas ${user_profile?.grade_level || 'SD'}.
Jelaskan dengan bahasa anak-anak yang sangat sederhana. Gunakan emoji agar menarik.
Jika ini pertanyaan matematika, tunjukkan langkahnya satu per satu.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemRole },
          { role: "user", content: `Konteks: ${context || 'Umum'}\nPertanyaan: ${question}` }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Gagal menghubungi Groq AI");
    }

    const data = await response.json();
    const answer = data.choices[0]?.message?.content;

    return new Response(JSON.stringify({
      answer: answer || "Aku belum bisa menjawab itu, coba tanya hal lain ya!",
      topic: "Umum"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({
      error: error.message,
      answer: "Waduh, Kak Bintang lagi kebingungan nih. Coba tanya sekali lagi ya! 😊"
    }), {
      status: 200, // Tetap 200 agar client bisa menampilkan pesan ramah
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
