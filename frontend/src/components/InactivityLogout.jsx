import React, { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const InactivityLogout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const cameraActiveRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  // 10 minutes = 600.000 ms
  const INACTIVITY_LIMIT = 10 * 60 * 1000;

  const handleAutoLogout = useCallback(async () => {
    try {
      console.log('User inactive for 10 minutes. Logging out...');
      await supabase.auth.signOut();
      logout();
      navigate('/auth');
    } catch (error) {
      console.error('Auto-logout failed:', error);
    }
  }, [logout, navigate]);

  const resetTimer = useCallback((force = false) => {
    // Throttling: Avoid unnecessary processing on every mouse move
    const now = Date.now();
    if (!force && now - lastActivityRef.current < 2000) return;
    lastActivityRef.current = now;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // If camera is active (user is likely using sign language/gestures), we pause the logout timer
    if (user && !cameraActiveRef.current) {
      timeoutRef.current = setTimeout(handleAutoLogout, INACTIVITY_LIMIT);
    }
  }, [user, handleAutoLogout]);

  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Cek apakah kamera sedang aktif secara akurat dan sangat ringan
    const checkCameraActivity = () => {
      const video = document.querySelector('video');
      // Validasi apakah video benar-benar streaming (bukan sekadar elemen kosong)
      const isActive = !!(
        video &&
        video.srcObject &&
        video.srcObject.active &&
        video.readyState >= 2 && // HAVE_CURRENT_DATA
        !video.paused
      );

      // Hanya panggil resetTimer jika status berubah untuk mencegah "kedap-kedip" logika/efisiensi
      if (isActive !== cameraActiveRef.current) {
        cameraActiveRef.current = isActive;
        resetTimer(true);
      }
    };

    // Polling setiap 5 detik sudah sangat cukup untuk timer 10 menit
    const interval = setInterval(checkCameraActivity, 5000);

    const handleEvent = () => resetTimer();
    activityEvents.forEach(event => {
      window.addEventListener(event, handleEvent, { passive: true });
    });

    // Inisialisasi awal
    checkCameraActivity();
    resetTimer(true);

    return () => {
      clearInterval(interval);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleEvent);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, resetTimer]);

  return <>{children}</>;
};

export default InactivityLogout;
