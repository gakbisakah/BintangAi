// supabase/functions/summarize/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const CUSTOM_API_KEY = Deno.env.get("CUSTOM_AI_TUTOR_KEY");
    if (req.headers.get("x-api-key") !== CUSTOM_API_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { content, grade_level } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

    const SUMMARIZE_PROMPT = `Kamu adalah Kak BintangAi, asisten belajar SD.
Tugasmu adalah meringkas materi modul menjadi poin-poin yang sangat sederhana untuk anak kelas ${grade_level || 'SD'}.
Gunakan bahasa yang ceria dan banyak emoji. Maksimal 5 poin ringkasan.

Format ringkasan:
📚 **RINGKASAN MATERI**
[Poin-poin di sini]

✨ **Tips Belajar**: [Tips]`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: SUMMARIZE_PROMPT }, { role: "user", content: content }],
      }),
    });

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content ?? "Gagal meringkas.";

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
});
