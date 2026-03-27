import { supabase } from './supabase'

export async function callEdgeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw error
  return data
}