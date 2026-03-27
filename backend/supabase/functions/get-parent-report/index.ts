// supabase/functions/get-parent-report/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { student_id } = await req.json();

    // 1. Ambil data siswa
    const { data: student } = await supabase
      .from('profiles')
      .select('full_name, weak_topics, xp, class_level')
      .eq('id', student_id)
      .single();

    // 2. Ambil skor tugas terbaru
    const { data: submissions } = await supabase
      .from('submissions')
      .select('total_score, assignments(title)')
      .eq('student_id', student_id)
      .order('submitted_at', { ascending: false })
      .limit(5);

    const scoresText = submissions?.map(s => `- ${s.assignments.title}: ${s.total_score}`).join("\n") || "Belum ada tugas.";
    const topicsText = student.weak_topics?.length > 0 ? student.weak_topics.join(", ") : "Tidak ada topik spesifik.";

    // 3. Panggil Groq untuk narasi
    const prompt = `Buatkan laporan mingguan untuk orang tua tentang progres belajar anak bernama ${student.full_name}.
    Data:
    - Kelas: ${student.class_level}
    - Total XP: ${student.xp}
    - Topik yang perlu ditingkatkan: ${topicsText}
    - Skor 5 tugas terakhir:
    ${scoresText}

    Tugasmu:
    Buat narasi yang ramah, profesional, namun mudah dimengerti orang tua.
    Jelaskan apa yang sudah baik dan apa yang perlu perhatian khusus di rumah.
    Gunakan bahasa Indonesia. Maksimal 150 kata.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const groqData = await groqRes.json();
    const report = groqData.choices[0].message.content;

    return new Response(JSON.stringify({ report }), {
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
