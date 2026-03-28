import { useEffect } from 'react';
import { useAccessibilityStore } from '../store/accessibilityStore';
import { useAuthStore } from '../store/authStore';

export function useAccessibility() {
  const { profile: authProfile } = useAuthStore();
  const { mode, isVoiceActive, isSubtitleActive, isGestureActive, setModeFromProfile } = useAccessibilityStore();

  useEffect(() => {
    if (authProfile) {
      setModeFromProfile(authProfile);
    }
  }, [authProfile, setModeFromProfile]);

  const isBlind = mode === 'tunanetra';
  const isDeaf = mode === 'tunarungu';
  const isMute = mode === 'tunawicara';

  return {
    mode,
    isBlind,
    isDeaf,
    isMute,
    isVoiceActive,
    isSubtitleActive,
    isGestureActive
  };
}