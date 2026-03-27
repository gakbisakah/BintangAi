import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const InactivityLogout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  // 10 menit = 600.000 ms
  const INACTIVITY_LIMIT = 10 * 60 * 1000;

  const handleAutoLogout = async () => {
    console.log('User inactive for 10 minutes. Logging out...');

    // Pastikan session benar-benar dihapus dari Supabase
    await supabase.auth.signOut();

    // Bersihkan store
    logout();

    // Redirect ke halaman auth
    navigate('/auth');
  };

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Hanya pasang timer jika user sedang login
    if (user) {
      timeoutRef.current = setTimeout(handleAutoLogout, INACTIVITY_LIMIT);
    }
  };

  useEffect(() => {
    // Daftar event yang dianggap sebagai aktivitas
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    if (user) {
      // Pasang listener saat user login
      activityEvents.forEach(event => {
        window.addEventListener(event, resetTimer);
      });

      // Mulai timer pertama kali
      resetTimer();
    }

    return () => {
      // Bersihkan listener dan timer saat unmount atau user logout
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user]);

  return <>{children}</>;
};

export default InactivityLogout;
