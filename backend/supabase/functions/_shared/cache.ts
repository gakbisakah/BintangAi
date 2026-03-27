import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHash } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export async function getCachedResponse(input: string, model: string): Promise<string | null> {
  const hash = createHash('sha256').update(input + model).toString();
  const { data } = await supabase
    .from('ai_cache')
    .select('output_text')
    .eq('content_hash', hash)
    .eq('model', model)
    .maybeSingle();
  return data?.output_text || null;
}

export async function setCachedResponse(input: string, model: string, output: string): Promise<void> {
  const hash = createHash('sha256').update(input + model).toString();
  await supabase
    .from('ai_cache')
    .insert({ content_hash: hash, model, input_text: input, output_text: output });
}