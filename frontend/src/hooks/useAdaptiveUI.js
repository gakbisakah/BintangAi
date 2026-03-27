import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAdaptiveUI() {
  const { profile } = useAuthStore();
  const disability = profile?.disability_type || 'tidak_ada';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-disability', disability);

    // Apply specific classes based on disability
    if (disability === 'tunanetra') {
      root.classList.add('high-contrast');
      root.style.fontSize = '125%'; // Base scaling
    } else {
      root.classList.remove('high-contrast');
      root.style.fontSize = '100%';
    }

    if (disability === 'tunarungu') {
      root.classList.add('visual-only');
    } else {
      root.classList.remove('visual-only');
    }

    // Clean up or handle changes
    return () => {
      root.removeAttribute('data-disability');
    };
  }, [disability]);

  return { disability };
}
