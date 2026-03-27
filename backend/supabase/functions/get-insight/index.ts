import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callGemini } from '../_shared/gemini.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { studentData } = await req.json();
    const prompt = `Buat insight untuk orang tua tentang perkembangan belajar anak berdasarkan data: ${JSON.stringify(studentData)}. Gunakan bahasa yang hangat dan suportif dalam Bahasa Indonesia.`;

    const insight = await callGemini(prompt, { temperature: 0.7 });

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
