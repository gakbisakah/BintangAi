// supabase/functions/generate-questions/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { class_code, subject } = await req.json();

    // 1. Ambil weak_topics agregat kelas
    const { data: students } = await supabase
      .from('profiles')
      .select('weak_topics')
      .eq('class_code', class_code)
      .eq('role', 'siswa');

    const topicCounts = {};
    students?.forEach(s => {
      s.weak_topics?.forEach(t => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });

    const topWeaknesses = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const contextTopics = topWeaknesses.length > 0 ? topWeaknesses.join(", ") : "materi umum SD";

    // 2. Panggil Groq untuk generate soal
    const prompt = `Buatkan 5 soal pilihan ganda untuk anak SD kelas 4-6 tentang: ${contextTopics}.
    Mata pelajaran: ${subject || 'Matematika'}.

    Format harus JSON valid dengan struktur:
    {
      "questions": [
        {
          "text": "Pertanyaan...",
          "type": "pilihan_ganda",
          "points": 20,
          "options": [
            {"text": "Opsi A", "isCorrect": false},
            {"text": "Opsi B", "isCorrect": true},
            {"text": "Opsi C", "isCorrect": false},
            {"text": "Opsi D", "isCorrect": false}
          ]
        }
      ]
    }
    Berikan hanya JSON, tanpa teks lain.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6,
        response_format: { type: "json_object" }
      }),
    });

    const groqData = await groqRes.json();
    const resultText = groqData.choices[0].message.content;
    const result = JSON.parse(resultText);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
