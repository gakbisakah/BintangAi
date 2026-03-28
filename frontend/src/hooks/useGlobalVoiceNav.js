import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAccessibilityStore } from '../store/accessibilityStore';
import { useSubtitle } from '../components/DeafSubtitleOverlay';

let sharedRecognition = null;
let isRecognitionActive = false;

export function useGlobalVoiceNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, isVoiceActive } = useAccessibilityStore();
  const { showSubtitle } = useSubtitle();
  const isBlind = mode === 'tunanetra';
  const activeRef = useRef(false);
  const synthRef = useRef(window.speechSynthesis);
  const lastSpokenRef = useRef('');
  const menuAnnouncedRef = useRef(false);
  const [aiListening, setAiListening] = useState(false);
  const [aiTranscript, setAiTranscript] = useState('');
  const aiRecognitionRef = useRef(null);

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

  // AI Microphone khusus untuk Tanya AI
  // Ditingkatkan akurasinya dengan pengaturan khusus
  const startAIMicrophone = useCallback((onResult, onStop) => {
    if (!isBlind) return;

    if (aiRecognitionRef.current) {
      try {
        aiRecognitionRef.current.stop();
      } catch(e) {}
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      speak('Browser tidak mendukung pengenalan suara');
      return;
    }

    const recognition = new SR();
    // High accuracy settings
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      setAiListening(true);
      speak('Mikrofon aktif. Silakan bicara sekarang. Untuk mengirim pertanyaan, katakan OK');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';

          // Deteksi perintah stop: "OK", "OKE", "Kirim", "Stop"
          const t = transcript.toLowerCase();
          if (t.includes('ok') || t.includes('oke') || t.includes('kirim') || t.includes('selesai')) {
            recognition.stop();
            if (onStop) onStop();
            return;
          }
        } else {
          interimTranscript += transcript;
        }
      }

      // Update UI Teks secara real-time
      const combined = (finalTranscript + interimTranscript).trim();
      setAiTranscript(combined);
      showSubtitle(`🎤 Mendengar: ${combined}`, 'info');
    };

    recognition.onerror = (event) => {
      console.error('AI recognition error:', event.error);
      if (event.error === 'network') speak('Masalah jaringan, periksa koneksi internet Anda.');
      setAiListening(false);
    };

    recognition.onend = () => {
      setAiListening(false);
      // Bersihkan teks perintah dari transcript akhir
      const cleanedResult = finalTranscript.replace(/ok|oke|kirim|selesai/gi, '').trim();
      if (cleanedResult.length > 1) {
        if (onResult) onResult(cleanedResult);
      }
      speak('Mikrofon dimatikan');
    };

    aiRecognitionRef.current = recognition;
    recognition.start();
  }, [isBlind, speak, showSubtitle]);

  const stopAIMicrophone = useCallback(() => {
    if (aiRecognitionRef.current) {
      try {
        aiRecognitionRef.current.stop();
      } catch(e) {}
    }
    setAiListening(false);
  }, []);

  // Perintah suara navigasi global tetap aktif
  const processCommand = useCallback((transcript) => {
    const t = transcript.toLowerCase().trim();
    if (t.includes('kembali')) { navigate(-1); speak('Kembali'); return; }
    if (t.includes('beranda')) { navigate('/student/dashboard'); speak('Beranda'); return; }
    if (t.includes('baca halaman')) { readPageContent(); return; }
  }, [navigate, speak]);

  const startGlobalListening = useCallback(() => {
    if (!isBlind || !isVoiceActive || activeRef.current || aiListening) return;

    if (!sharedRecognition) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return;
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

    sharedRecognition.onend = () => {
      isRecognitionActive = false;
      if (activeRef.current && !aiListening) {
        setTimeout(() => {
          if (activeRef.current && !aiListening) {
            try { sharedRecognition.start(); isRecognitionActive = true; } catch (e) {}
          }
        }, 500);
      }
    };

    if (!isRecognitionActive) {
      try { sharedRecognition.start(); isRecognitionActive = true; activeRef.current = true; } catch (e) {}
    } else {
      activeRef.current = true;
    }
  }, [isBlind, isVoiceActive, processCommand, aiListening]);

  const stopGlobalListening = useCallback(() => {
    activeRef.current = false;
    if (sharedRecognition && isRecognitionActive) {
      try { sharedRecognition.stop(); isRecognitionActive = false; } catch (e) {}
    }
  }, []);

  const readPageContent = useCallback(() => {
    const mainText = document.querySelector('main')?.innerText || '';
    speak(mainText.slice(0, 1000));
  }, [speak]);

  useEffect(() => {
    if (isBlind && isVoiceActive) {
      startGlobalListening();
      return () => stopGlobalListening();
    }
  }, [isBlind, isVoiceActive, startGlobalListening, stopGlobalListening]);

  // Hover-to-Speak (Sangat membantu Tunanetra)
  useEffect(() => {
    if (!isBlind || !isVoiceActive) return;
    const handleHover = (e) => {
      const target = e.target.closest('button, a, h1, h2, h3, p');
      if (target) {
        const text = target.innerText || target.getAttribute('aria-label');
        if (text && text !== lastSpokenRef.current) {
          speak(text);
          lastSpokenRef.current = text;
        }
      }
    };
    window.addEventListener('mouseover', handleHover);
    return () => window.removeEventListener('mouseover', handleHover);
  }, [isBlind, isVoiceActive, speak]);

  return {
    speak,
    startAIMicrophone,
    stopAIMicrophone,
    aiListening,
    aiTranscript
  };
}
