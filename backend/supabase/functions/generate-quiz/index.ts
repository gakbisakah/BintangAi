// supabase/functions/generate-quiz/index.ts
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
    const clientApiKey = req.headers.get("x-api-key");
    const serverApiKey = Deno.env.get("x-api-key");

    if (!clientApiKey || clientApiKey !== serverApiKey) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
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

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const numQuestions = Math.min(parseInt(total_questions) || 5, 15);
    const difficultyText = difficulty === 'hard' ? 'Sangat Sulit' : difficulty === 'medium' ? 'Sedang' : 'Mudah';

    const systemPrompt = `Kamu adalah Kak Bintang, asisten guru SD yang ceria dan cerdas.
    Tugasmu adalah membuat soal latihan berkualitas tinggi untuk siswa SD.

    PERATURAN PENTING:
    1. Output HARUS dalam format JSON murni.
    2. Setiap soal WAJIB memiliki 'feedback_correct' dan 'feedback_wrong'.
    3. 'feedback_correct' berisi pujian dan penjelasan singkat MENGAPA jawaban itu benar.
    4. 'feedback_wrong' berisi kata-kata penyemangat dan PETUNJUK atau CARA mengerjakan agar siswa bisa mencoba lagi dengan benar.
    5. Gunakan bahasa yang ramah anak SD.`;

    const userPrompt = `Buatkan ${numQuestions} soal tentang "${topic}" untuk kelas ${grade_level} SD.
    Tingkat Kesulitan: ${difficultyText}.
    Tipe Soal: ${question_types.join(", ")}.

    JSON Structure:
    {
      "quiz_title": "${title || `Latihan ${topic}`}",
      "instructions": "${instructions || "Selamat mengerjakan, tetap semangat!"}",
      "duration_minutes": ${duration_minutes || 30},
      "questions": [
        {
          "type": "multiple_choice",
          "question": "...",
          "options": ["opsi A", "opsi B", "opsi C", "opsi D"],
          "correct_answer_index": 0,
          "feedback_correct": "Luar biasa! Penjelasannya: ...",
          "feedback_wrong": "Jangan menyerah! Coba ingat kembali bahwa ...",
          "points": 10
        },
        {
          "type": "essay",
          "question": "...",
          "correct_answer": "kunci jawaban singkat",
          "feedback_correct": "Hebat sekali! Kamu benar karena ...",
          "feedback_wrong": "Hampir tepat! Tipsnya: Perhatikan bagian ...",
          "points": 20
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
        temperature: 0.4,
        response_format: { type: "json_object" }
      }),
    });

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
