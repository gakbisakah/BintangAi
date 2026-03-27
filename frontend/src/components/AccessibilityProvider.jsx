import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useVoice } from '../hooks/useVoice';

const AccessibilityProvider = ({ children }) => {
  const { profile } = useAuthStore();
  const { speak, playSound, setHasInteracted } = useVoice();
  const location = useLocation();
  const lastTextRef = useRef("");
  const [isReady, setIsReady] = useState(false);

  const isLanding = location.pathname === '/';
  const isAuth = ['/auth', '/login', '/register'].includes(location.pathname);
  const isStudent = location.pathname.startsWith('/student');
  const isActive = (isLanding || isAuth || isStudent) && (!profile || profile.role === 'siswa');

  // Logic Unlocking Audio Tanpa Klik (Hanya Gerakan Mouse)
  useEffect(() => {
    const unlock = () => {
      if (!isReady) {
        setIsReady(true);
        setHasInteracted?.(true);

        // Pancing suara pertama agar browser memberikan izin
        if (isLanding) {
          speak("Selamat datang di Bintang AI. Silakan daftar di tombol sisi atas kanan.", 1.1);
        } else {
          speak("Aksesibilitas Suara Aktif.", 1.2);
        }
      }
    };

    window.addEventListener('mousemove', unlock, { once: true });
    window.addEventListener('mousedown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('mousemove', unlock);
      window.removeEventListener('mousedown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [isReady, isLanding, speak, setHasInteracted]);

  useEffect(() => {
    if (!isActive) return;

    const handleMouseOver = (e) => {
      // Pemindai Teks yang Jauh Lebih Sensitif (Universal)
      const target = e.target.closest('button, a, input, h1, h2, h3, h4, h5, p, span, label, li, img, [role="button"]');
      if (!target) return;

      let text = "";
      let prefix = "";

      const tagName = target.tagName;
      if (tagName === 'BUTTON' || target.getAttribute('role') === 'button') {
        prefix = "Tombol ";
        text = target.innerText || target.ariaLabel || "";
      } else if (tagName === 'A') {
        prefix = "Link ";
        text = target.innerText || target.ariaLabel || "";
      } else if (tagName === 'INPUT') {
        prefix = "Isian ";
        text = target.placeholder || target.ariaLabel || "";
      } else if (tagName === 'IMG') {
        prefix = "Gambar ";
        text = target.alt || "Tanpa keterangan";
      } else {
        // Tangkap teks dari span/p/div yang ada isinya
        text = target.innerText || target.textContent || "";
      }

      const fullText = (prefix + text).trim().replace(/\s+/g, ' ');

      // Validasi: Abaikan teks yang terlalu pendek (icon) atau hanya whitespace
      if (fullText && fullText.length > 2 && fullText.length < 500 && fullText !== lastTextRef.current) {
        lastTextRef.current = fullText;

        // Suara klik mekanik (Local Audio)
        playSound?.('click');

        // Gunakan timeout kecil untuk mencegah tabrakan audio
        const timer = setTimeout(() => {
          speak(fullText, 1.2);
        }, 60);
        return () => clearTimeout(timer);
      }
    };

    // Reset memori saat ganti rute
    lastTextRef.current = "";

    window.addEventListener('mouseover', handleMouseOver);
    return () => window.removeEventListener('mouseover', handleMouseOver);
  }, [isActive, location.pathname, speak, playSound]);

  return <>{children}</>;
};

export default AccessibilityProvider;
