// supabase/functions/ai-tutor/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. Verifikasi Otorisasi (x-api-key)
    // Sesuai config.toml Anda, kita gunakan 'x-api-key' yang bernilai 'christian'
    const serverApiKey = Deno.env.get("x-api-key");
    const clientApiKey = req.headers.get("x-api-key");

    if (!serverApiKey || clientApiKey !== serverApiKey) {
      console.error("Unauthorized: API Key mismatch or missing");
      return new Response(JSON.stringify({
        error: "Unauthorized",
        reply: "Waduh, kunci keamanan Kak Bintang salah nih! 🔒"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing in Supabase Secrets");
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid JSON body");
    }

    // Mendukung 'message' (dari Playground) atau 'query'/'question' (dari TaskDetail)
    const message = body.message || body.query || body.question;
    const { nama = "Teman", kelas = 4, weak_topics = [] } = body;

    if (!message) throw new Error("Message is required");

    const systemPrompt = `Kamu adalah Kak BintangAi, tutor SD kelas 1-6 yang ceria dan sabar.
    Nama siswa: ${nama}, Kelas: ${kelas}.
    ${weak_topics.length > 0 ? `Bantu siswa dengan topik: ${weak_topics.join(", ")}.` : ""}
    Jawab dengan bahasa yang mudah dimengerti anak SD, gunakan emoji, dan maksimal 3 kalimat.
    Di akhir jawaban, sertakan tag topik: <!--TOPICS:topik_terkait-->`;

    const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 200,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq error:", errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "Maaf, Kak Bintang lagi bingung. Coba tanya lagi ya! 😊";

    // Pastikan ada tag topics jika AI lupa memberikan
    if (!reply.includes("<!--TOPICS:")) {
      reply += " <!--TOPICS:umum-->";
    }

    return new Response(JSON.stringify({ reply, answer: reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("AI Tutor Error:", error.message);
    return new Response(JSON.stringify({
      reply: "Waduh, Kak BintangAi lagi istirahat sebentar. Coba tanya lagi ya! 😊",
      answer: "Waduh, Kak BintangAi lagi istirahat sebentar. 😊",
      debug: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
