import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: true,
      subscription: null,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),

      // Mendengarkan perubahan profil secara Realtime
      subscribeToProfile: (userId) => {
        if (!userId) return;

        // Hapus subscription lama jika ada
        const existingSub = get().subscription;
        if (existingSub) {
          supabase.removeChannel(existingSub);
        }

        const channel = supabase
          .channel(`public:profiles:id=eq.${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${userId}`,
            },
            (payload) => {
              console.log('Realtime profile update:', payload.new);
              set({ profile: payload.new });
            }
          )
          .subscribe();

        set({ subscription: channel });
      },

      unsubscribeFromProfile: () => {
        const { subscription } = get();
        if (subscription) {
          supabase.removeChannel(subscription);
          set({ subscription: null });
        }
      },

      fetchProfile: async (userId) => {
        if (!userId) return null;
        set({ loading: true });

        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (profileError) throw profileError;

          if (profileData) {
            // Jalankan subscription realtime setelah profile ditemukan
            get().subscribeToProfile(userId);

            set({ profile: profileData, loading: false });
            return profileData;
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        } finally {
          set({ loading: false });
        }
        return null;
      },

      updateXP: async (xpGained) => {
        const { profile } = get()
        if (profile) {
          const { data, error } = await supabase.rpc('increment_xp', {
            user_id: profile.id,
            amount: xpGained
          });

          if (error) {
            // Fallback manual jika RPC belum ada
            const newXP = Number(profile.xp || 0) + Number(xpGained);
            await supabase.from('profiles').update({ xp: newXP }).eq('id', profile.id);
          }
        }
      },

      logout: async () => {
        get().unsubscribeFromProfile();
        await supabase.auth.signOut()
        set({ user: null, profile: null })
      }
    }),
    {
      name: 'bintangai-auth-storage',
      partialize: (state) => ({ user: state.user, profile: state.profile }), // Jangan persist subscription
    }
  )
)
