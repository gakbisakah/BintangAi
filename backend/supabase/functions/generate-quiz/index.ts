// supabase/functions/generate-quiz/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. Verifikasi Otorisasi Custom (x-api-key)
    const clientApiKey = req.headers.get("x-api-key");
    const serverApiKey = Deno.env.get("x-api-key");

    if (!clientApiKey || clientApiKey !== serverApiKey) {
      console.error("Unauthorized access attempt");
      return new Response(JSON.stringify({
        success: false,
        message: "Akses tidak diizinkan (Invalid x-api-key)."
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const {
      topic,
      grade_level,
      question_types,
      total_questions,
      difficulty,
      title,
      instructions,
      duration_minutes
    } = body;

    // 2. Ambil GROQ_API_KEY dari Env
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({
        success: false,
        message: "Konfigurasi GROQ_API_KEY tidak ditemukan di server."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const numQuestions = Math.min(parseInt(total_questions) || 5, 15);
    const types = Array.isArray(question_types) ? question_types : ["multiple_choice"];

    const hasPG = types.includes("multiple_choice");
    const hasEssay = types.includes("essay");

    let mcCount = 0;
    let essayCount = 0;

    if (hasPG && hasEssay) {
      mcCount = Math.floor(numQuestions * 0.7);
      essayCount = numQuestions - mcCount;
    } else if (hasPG) {
      mcCount = numQuestions;
    } else {
      essayCount = numQuestions;
    }

    const systemPrompt = `Kamu adalah Kak Bintang, asisten guru SD yang cerdas. Berikan output JSON murni.`;

    const userPrompt = `Buatkan ${numQuestions} soal tentang "${topic}" untuk kelas ${grade_level} SD.
    Kesulitan: ${difficulty}. Komposisi: ${mcCount} PG, ${essayCount} Esai.
    JSON Format:
    {
      "quiz_title": "${(title || `Latihan ${topic}`).replace(/"/g, "'")}",
      "instructions": "${(instructions || "Kerjakan dengan teliti.").replace(/"/g, "'")}",
      "duration_minutes": ${duration_minutes || 30},
      "questions": [
        {
          "type": "multiple_choice",
          "question": "...",
          "options": ["...", "...", "...", "..."],
          "correct_answer_index": 0,
          "explanation": "...",
          "points": 10
        }
      ]
    }`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      throw new Error(`Groq API Error: ${errorData.error?.message || "Gagal ke AI"}`);
    }

    const data = await groqResponse.json();
    const content = data.choices[0]?.message?.content;
    const quizResult = JSON.parse(content);

    return new Response(JSON.stringify({ success: true, quiz: quizResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
