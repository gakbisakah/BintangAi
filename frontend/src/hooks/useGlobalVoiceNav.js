import { useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccessibilityStore } from '../store/accessibilityStore';

let sharedRecognition = null;
let isRecognitionActive = false;

export function useGlobalVoiceNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, isVoiceActive } = useAccessibilityStore();
  const isBlind = mode === 'tunanetra';
  const activeRef = useRef(false);
  const synthRef = useRef(window.speechSynthesis);
  const lastSpokenRef = useRef('');
  const menuAnnouncedRef = useRef(false);

  const speak = useCallback((text, rate = 1.0) => {
    if (!text || !isBlind) return;
    try {
      synthRef.current.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      const voices = synthRef.current.getVoices();
      const idVoice = voices.find(v => v.lang.includes('id-ID')) || voices[0];
      if (idVoice) utt.voice = idVoice;
      utt.lang = 'id-ID';
      utt.rate = rate;
      utt.pitch = 1.0;
      utt.volume = 1.0;
      synthRef.current.speak(utt);
      lastSpokenRef.current = text;
    } catch (e) {
      console.error('speak error:', e);
    }
  }, [isBlind]);

  // Announce sidebar menu on page load
  const announceSidebar = useCallback(() => {
    const menuItems = [
      'Beranda', 'QuizKu', 'Materi Modul', 'Kolaborasi', 'Tanya AI', 'Profil'
    ];
    speak(`Menu utama: ${menuItems.join(', ')}. Katakan nama menu untuk navigasi.`);
  }, [speak]);

  // Read page title and content on load
  const readPageContent = useCallback(() => {
    const title = document.querySelector('h1, h2')?.innerText || location.pathname;
    const mainContent = document.querySelector('main')?.innerText || '';
    speak(`${title}. ${mainContent.slice(0, 500)}`);
  }, [speak, location]);

  const processCommand = useCallback((transcript) => {
    const t = transcript.toLowerCase().trim();
    console.log('[VoiceNav] command:', t);

    // Navigation commands
    if (t.includes('beranda') || t === 'home') {
      speak('Membuka beranda');
      navigate('/student/dashboard');
      return;
    }
    if (t.includes('quizku') || t.includes('quiz') || t.includes('tugas')) {
      speak('Membuka halaman quiz');
      navigate('/student/tasks');
      return;
    }
    if (t.includes('materi') || t.includes('modul')) {
      speak('Membuka materi modul');
      navigate('/student/modules');
      return;
    }
    if (t.includes('kolaborasi') || t.includes('diskusi') || t.includes('grup')) {
      speak('Membuka halaman kolaborasi');
      navigate('/student/collaboration');
      return;
    }
    if (t.includes('tanya ai') || t.includes('ai') || t.includes('asisten')) {
      speak('Membuka asisten AI');
      navigate('/student/playground');
      return;
    }
    if (t.includes('profil') || t.includes('akun')) {
      speak('Membuka profil');
      navigate('/profile');
      return;
    }
    if (t.includes('kembali') || t.includes('back')) {
      speak('Kembali');
      navigate(-1);
      return;
    }

    // Scroll commands
    if (t.includes('scroll bawah') || t.includes('gulir bawah')) {
      window.scrollBy({ top: 500, behavior: 'smooth' });
      speak('Menggulir ke bawah');
      return;
    }
    if (t.includes('scroll atas') || t.includes('gulir atas')) {
      window.scrollBy({ top: -500, behavior: 'smooth' });
      speak('Menggulir ke atas');
      return;
    }

    // Read commands
    if (t.includes('baca menu') || t.includes('daftar menu')) {
      announceSidebar();
      return;
    }
    if (t.includes('baca halaman') || t.includes('baca semua')) {
      readPageContent();
      return;
    }

    // Quiz specific
    if (t.includes('mulai quiz') || t.includes('kerjakan')) {
      const startBtn = document.querySelector('button:has(span:contains("Mulai"))');
      if (startBtn) {
        speak('Memulai quiz');
        startBtn.click();
      } else {
        speak('Tidak ada tombol mulai. Pilih quiz terlebih dahulu.');
      }
      return;
    }

    // Answer selection for quiz
    const answerMap = {
      'pilih a': 'A', 'jawab a': 'A', 'pilihan a': 'A',
      'pilih b': 'B', 'jawab b': 'B', 'pilihan b': 'B',
      'pilih c': 'C', 'jawab c': 'C', 'pilihan c': 'C',
      'pilih d': 'D', 'jawab d': 'D', 'pilihan d': 'D'
    };
    for (const [cmd, letter] of Object.entries(answerMap)) {
      if (t.includes(cmd)) {
        speak(`Jawaban ${letter} dipilih`);
        const btn = document.querySelector(`button:has(span:contains("${letter}"))`);
        if (btn) btn.click();
        return;
      }
    }

    if (t.includes('lanjut') || t.includes('next') || t.includes('soal berikutnya')) {
      speak('Soal berikutnya');
      const nextBtn = document.querySelector('button:has(span:contains("Lanjut"))');
      if (nextBtn) nextBtn.click();
      return;
    }
  }, [navigate, speak, announceSidebar, readPageContent]);

  const startGlobalListening = useCallback(() => {
    if (!isBlind || !isVoiceActive || activeRef.current) return;

    if (!sharedRecognition) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        console.warn('SpeechRecognition not supported');
        return;
      }
      sharedRecognition = new SR();
      sharedRecognition.continuous = true;
      sharedRecognition.interimResults = false;
      sharedRecognition.lang = 'id-ID';
    }

    sharedRecognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          processCommand(e.results[i][0].transcript);
        }
      }
    };

    sharedRecognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        speak('Mikrofon tidak diizinkan. Mohon izinkan akses mikrofon di browser.');
        activeRef.current = false;
        return;
      }
    };

    sharedRecognition.onend = () => {
      isRecognitionActive = false;
      if (activeRef.current) {
        setTimeout(() => {
          if (activeRef.current) {
            try {
              sharedRecognition.start();
              isRecognitionActive = true;
            } catch (e) {}
          }
        }, 300);
      }
    };

    if (!isRecognitionActive) {
      try {
        sharedRecognition.start();
        isRecognitionActive = true;
        activeRef.current = true;
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    } else {
      activeRef.current = true;
    }
  }, [isBlind, isVoiceActive, processCommand, speak]);

  const stopGlobalListening = useCallback(() => {
    activeRef.current = false;
    if (sharedRecognition && isRecognitionActive) {
      try {
        sharedRecognition.stop();
        isRecognitionActive = false;
      } catch (e) {}
    }
  }, []);

  // Auto-announce sidebar on first load
  useEffect(() => {
    if (isBlind && isVoiceActive && !menuAnnouncedRef.current) {
      const timer = setTimeout(() => {
        announceSidebar();
        menuAnnouncedRef.current = true;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isBlind, isVoiceActive, announceSidebar]);

  // Start/stop listening
  useEffect(() => {
    if (isBlind && isVoiceActive) {
      const timer = setTimeout(startGlobalListening, 2000);
      return () => {
        clearTimeout(timer);
        stopGlobalListening();
      };
    }
    return () => {};
  }, [isBlind, isVoiceActive, startGlobalListening, stopGlobalListening]);

  // Auto-read page content on route change
  useEffect(() => {
    if (isBlind && isVoiceActive) {
      const timer = setTimeout(() => {
        readPageContent();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isBlind, isVoiceActive, location.pathname, readPageContent]);

  // Auto-read hovered elements
  useEffect(() => {
    if (!isBlind || !isVoiceActive) return;

    const handleHover = (e) => {
      const target = e.target.closest('button, a, h1, h2, h3, h4, p, span, [aria-label], [title]');
      if (target) {
        let text = target.getAttribute('aria-label') || target.getAttribute('title') || target.innerText;
        text = text?.trim();
        if (text && text !== lastSpokenRef.current && text.length < 200) {
          speak(text);
          lastSpokenRef.current = text;
        }
      }
    };

    window.addEventListener('mouseover', handleHover);
    return () => {
      window.removeEventListener('mouseover', handleHover);
      lastSpokenRef.current = '';
    };
  }, [isBlind, isVoiceActive, speak]);

  return { speak, isActive: isBlind && isVoiceActive };
}