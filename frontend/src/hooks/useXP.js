import { supabase } from '../lib/supabase'
import { useXPStore } from '../store/xpStore'

export function useXP() {
  const { xp, streak, addXP } = useXPStore()

  const awardXP = async (points) => {
    const { data, error } = await supabase.rpc('add_xp', { points })
    if (!error) addXP(points)
  }

  return { xp, streak, awardXP }
}