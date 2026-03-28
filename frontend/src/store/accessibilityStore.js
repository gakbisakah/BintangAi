import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAccessibilityStore = create(
  persist(
    (set, get) => ({
      mode: null, // 'tunanetra', 'tunarungu', 'tunawicara'
      isVoiceActive: false,
      isSubtitleActive: false,
      isGestureActive: false,
      profile: null,

      setModeFromProfile: (profile) => {
        if (!profile) {
          get().reset();
          return;
        }

        const mode = profile.disability_type;
        set({
          mode,
          isVoiceActive: mode === 'tunanetra',
          // Perbaikan: Tunarungu tidak butuh subtitle karena fokus pada teks yang diperjelas
          isSubtitleActive: mode === 'tunarungu' ? false : mode === 'tunawicara',
          isGestureActive: mode === 'tunawicara',
          profile
        });

        // Apply to DOM
        const root = document.documentElement;
        root.setAttribute('data-disability', mode || 'none');

        // Reset all mode classes first
        root.classList.remove('blind-mode', 'deaf-mode', 'mute-mode');

        if (mode === 'tunanetra') {
          root.classList.add('blind-mode');
          root.style.fontSize = '125%';
        } else if (mode === 'tunarungu') {
          root.classList.add('deaf-mode');
          root.style.fontSize = '115%'; // Memperbesar teks sedikit agar lebih jelas dibaca
        } else if (mode === 'tunawicara') {
          root.classList.add('mute-mode');
          root.style.fontSize = '100%';
        } else {
          root.style.fontSize = '100%';
        }
      },

      reset: () => {
        const root = document.documentElement;
        root.setAttribute('data-disability', 'none');
        root.classList.remove('blind-mode', 'deaf-mode', 'mute-mode');
        root.style.fontSize = '100%';

        set({
          mode: null,
          isVoiceActive: false,
          isSubtitleActive: false,
          isGestureActive: false,
          profile: null
        });
      }
    }),
    {
      name: 'bintangai-accessibility',
      partialize: (state) => ({ mode: state.mode })
    }
  )
);
