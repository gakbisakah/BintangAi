import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccessibility } from '../hooks/useAccessibility';
import { useGestureControl } from '../hooks/useGestureControl';
import GestureCameraOverlay from './GestureCameraOverlay';
import { useSubtitle } from './DeafSubtitleOverlay';
import { useAuthStore } from '../store/authStore';

const GlobalGestureCamera = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMute } = useAccessibility();
  const { showSubtitle } = useSubtitle();
  const { logout } = useAuthStore();

  const [menuActive, setMenuActive] = useState(false);
  const path = location.pathname;

  // Camera always enabled for Tunawicara mode
  const isEnabled = isMute;

  const lastProcessedFinger = useRef(-1);
  const cooldownRef = useRef(false);

  const { videoRef, canvasRef, isActive, handDetected, totalFingers } = useGestureControl({
    enabled: isEnabled,
    onScroll: (dir) => {
      if ((path === '/student/dashboard' || path === '/') && !menuActive) {
        window.scrollBy({ top: dir === 'down' ? 250 : -250, behavior: 'smooth' });
      }
    }
  });

  // Determine page context
  const isLandingPage = path === '/';
  const isAuthPage = path === '/auth';
  const isTaskDetail = path.includes('/student/task/');
  const isTasksList = path === '/student/tasks';
  const isModulesList = path === '/student/modules';
  const isProfilePage = path === '/profile';

  // Auth specific state detected from DOM
  const [isLoginMode, setIsLoginMode] = useState(true);

  useEffect(() => {
    if (isAuthPage) {
      const checkMode = () => {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
          setIsLoginMode(submitBtn.textContent.includes('Masuk'));
        }
      };
      checkMode();
      // Use mutation observer to track login/register toggle
      const observer = new MutationObserver(checkMode);
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [isAuthPage]);

  useEffect(() => {
    if (!isEnabled || totalFingers === 0 || cooldownRef.current) return;

    if (totalFingers === lastProcessedFinger.current) return;
    lastProcessedFinger.current = totalFingers;

    // --- LANDING PAGE LOGIC ---
    if (isLandingPage) {
      if (totalFingers === 2) {
        showSubtitle('🚀 Menuju Halaman Masuk...', 'info');
        navigate('/auth');
        triggerCooldown();
        return;
      }
      if (totalFingers === 5) {
        showSubtitle('📝 Menuju Halaman Daftar...', 'info');
        navigate('/auth');
        // Auto-click toggle if needed after navigation is handled by auth internal state
        triggerCooldown();
        return;
      }
    }

    // --- LOGIN / REGISTER LOGIC ---
    if (isAuthPage) {
      if (isLoginMode) {
        if (totalFingers === 1) { navigate('/'); showSubtitle('🏠 Kembali ke Beranda', 'info'); triggerCooldown(); return; }
        if (totalFingers === 2) {
          const toggleBtn = document.querySelector('button.text-indigo-600');
          if (toggleBtn) toggleBtn.click();
          showSubtitle('📝 Pindah ke Daftar', 'info');
          triggerCooldown();
          return;
        }
        if (totalFingers === 5) {
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
          showSubtitle('✨ Masuk Sekarang...', 'success');
          triggerCooldown();
          return;
        }
        if (totalFingers === 7) {
          const eyeBtn = document.querySelector('button.absolute.right-5');
          if (eyeBtn) eyeBtn.click();
          showSubtitle('👁️ Lihat/Sembunyi Sandi', 'info');
          triggerCooldown();
          return;
        }
      } else { // Register Mode
        if (totalFingers === 1) { navigate('/'); showSubtitle('🏠 Kembali ke Beranda', 'info'); triggerCooldown(); return; }
        if (totalFingers === 2) {
          const toggleBtn = document.querySelector('button.text-indigo-600');
          if (toggleBtn) toggleBtn.click();
          showSubtitle('🔑 Pindah ke Masuk', 'info');
          triggerCooldown();
          return;
        }
        if (totalFingers === 7) {
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
          showSubtitle('📝 Mendaftarkan Akun...', 'success');
          triggerCooldown();
          return;
        }
      }
    }

    // --- LOGGED IN PAGES LOGIC ---
    const isLoggedInPage = path.startsWith('/student/') || path === '/profile';

    // MENU UTAMA (10 Jari)
    if (totalFingers >= 9 && isLoggedInPage) {
      setMenuActive(true);
      showSubtitle('🔓 MENU TERBUKA! Pilih 1-7 jari.', 'success');
      triggerCooldown();
      return;
    }

    // PROFILE LOGOUT (2 Jari)
    if (isProfilePage && totalFingers === 2 && !menuActive) {
      showSubtitle('👋 Melakukan Logout...', 'info');
      setTimeout(() => { logout(); navigate('/auth'); }, 1000);
      triggerCooldown();
      return;
    }

    if (menuActive) {
      let targetPath = '';
      let label = '';
      if (totalFingers === 1) { targetPath = '/student/dashboard'; label = 'Beranda'; }
      else if (totalFingers === 2) { targetPath = '/student/tasks'; label = 'QuizKu'; }
      else if (totalFingers === 3) { targetPath = '/student/modules'; label = 'Materi Modul'; }
      else if (totalFingers === 4) { targetPath = '/student/collaboration'; label = 'Kolaborasi'; }
      else if (totalFingers === 5) { targetPath = '/student/playground'; label = 'Tanya AI'; }
      else if (totalFingers === 7) { targetPath = '/profile'; label = 'Profil'; }

      if (targetPath) {
        setMenuActive(false);
        showSubtitle(`🚀 Membuka ${label}...`, 'success');
        navigate(targetPath);
        triggerCooldown();
      }
      return;
    }

    // AUTO-CLICK INTERACTIVE ITEMS
    const interactivePaths = ['/student/tasks', '/student/modules', '/student/task/'];
    if (interactivePaths.some(p => path.includes(p))) {
      const items = document.querySelectorAll('[data-gesture-item="true"]');
      if (items && items[totalFingers - 1]) {
        const target = items[totalFingers - 1];
        target.style.transition = 'all 0.2s';
        target.style.boxShadow = '0 0 30px rgba(79, 70, 229, 0.5)';
        target.style.transform = 'scale(0.98)';
        setTimeout(() => {
          target.click();
          target.style.boxShadow = '';
          target.style.transform = '';
          showSubtitle(`✅ Memilih urutan ke-${totalFingers}`, 'success');
        }, 400);
        triggerCooldown();
      }
    }
  }, [totalFingers, menuActive, path, isEnabled, isProfilePage, logout, navigate, isLandingPage, isAuthPage, isLoginMode]);

  const triggerCooldown = () => {
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
      lastProcessedFinger.current = -1;
    }, 1800);
  };

  useEffect(() => { setMenuActive(false); }, [path]);

  if (!isEnabled) return null;

  return (
    <GestureCameraOverlay
      videoRef={videoRef}
      canvasRef={canvasRef}
      isActive={isActive}
      handDetected={handDetected}
      totalFingers={totalFingers}
      menuActive={menuActive}
      isProfilePage={isProfilePage}
      isLandingPage={isLandingPage}
      isAuthPage={isAuthPage}
      isLoginMode={isLoginMode}
    />
  );
};

export default GlobalGestureCamera;
