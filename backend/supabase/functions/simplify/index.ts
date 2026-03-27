import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getCachedResponse, setCachedResponse } from '../_shared/cache.ts';
import { callGemini } from '../_shared/gemini.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text) throw new Error('Missing text');

    const model = 'gemini-1.5-flash';
    const cached = await getCachedResponse(text, model);
    if (cached) {
      return new Response(JSON.stringify({ simplified: cached, fromCache: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Jelaskan dengan bahasa yang sangat sederhana untuk anak SD: ${text}`;
    const simplified = await callGemini(prompt, { temperature: 0.5 });

    await setCachedResponse(text, model, simplified);

    return new Response(JSON.stringify({ simplified, fromCache: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
