import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
          isSubtitleActive: mode === 'tunawicara', // Tunarungu uses clear text, Tunawicara uses subtitles for gesture feedback
          isGestureActive: mode === 'tunawicara',
          profile
        });

        get().reapplyMode();
      },

      // Reapply mode on page load and route changes
      reapplyMode: () => {
        const { mode } = get();
        if (mode) {
          const root = document.documentElement;
          root.setAttribute('data-disability', mode);

          // Clear existing classes
          root.classList.remove('blind-mode', 'deaf-mode', 'mute-mode');
          root.classList.add(`${mode}-mode`);

          if (mode === 'tunanetra') {
            root.style.fontSize = '125%';
          } else if (mode === 'tunarungu') {
            root.style.fontSize = '115%';
          } else {
            root.style.fontSize = '100%';
          }

          // Save simple key for main.jsx early access
          localStorage.setItem('bintangai-mode-simple', mode);
        }
      },

      reset: () => {
        const root = document.documentElement;
        root.setAttribute('data-disability', 'none');
        root.classList.remove('blind-mode', 'deaf-mode', 'mute-mode');
        root.style.fontSize = '100%';
        localStorage.removeItem('bintangai-mode-simple');

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
