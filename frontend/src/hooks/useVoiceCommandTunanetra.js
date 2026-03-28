import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for high-accuracy voice commands specifically for blind users.
 * Optimized for Laptop (Chrome/Edge) and Android.
 */
export function useVoiceCommandTunanetra({ onCommand, onTranscript, onListeningChange }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);

  const recognitionRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const isActiveRef = useRef(false);

  // Perintah yang didukung
  const commandMap = {
    ok: ['ok', 'oke', 'kirim', 'selesai', 'mantap', 'sudah']
  };

  const calculateSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;
    return 0;
  };

  const findBestCommand = useCallback((text) => {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(' ');

    for (const [command, phrases] of Object.entries(commandMap)) {
      for (const phrase of phrases) {
        if (words.includes(phrase) || lowerText.endsWith(phrase)) {
          return { command, confidence: 1 };
        }
      }
    }
    return { command: null, confidence: 0 };
  }, []);

  const startListening = useCallback(() => {
    // 1. Cek dukungan browser
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = 'Browser Anda tidak mendukung pengenalan suara. Gunakan Chrome atau Edge.';
      console.error(msg);
      if (onTranscript) onTranscript(msg, true);
      return;
    }

    // 2. Hentikan instance lama jika ada
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null; // Prevent restart loop
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // 3. Inisialisasi
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';

    recognition.onstart = () => {
      console.log('Voice Recognition Started');
      setIsListening(true);
      isActiveRef.current = true;
      if (onListeningChange) onListeningChange(true);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimText += text;
        }
      }

      // Update Real-time
      const liveText = (finalTranscript + interimText).trim();
      if (onTranscript) onTranscript(liveText, false);
      setInterimTranscript(liveText);

      if (finalTranscript) {
        const cleanFinal = finalTranscript.trim();
        setTranscript(cleanFinal);

        // Deteksi Perintah "OK"
        const { command } = findBestCommand(cleanFinal);
        if (command === 'ok' && onCommand) {
          onCommand('ok', cleanFinal);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Recognition Error:', event.error);
      if (event.error === 'not-allowed') {
        if (onTranscript) onTranscript('❌ Akses Mikrofon Ditolak. Harap izinkan di pengaturan browser Anda.', true);
        isActiveRef.current = false;
      }
      if (event.error === 'network') {
        if (onTranscript) onTranscript('❌ Masalah Jaringan. Periksa koneksi internet Anda.', true);
      }
    };

    recognition.onend = () => {
      console.log('Voice Recognition Ended');
      // Auto-restart jika masih aktif (agar tetap mendengarkan di laptop)
      if (isActiveRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) {
            try { recognition.start(); } catch (e) {}
          }
        }, 300);
      } else {
        setIsListening(false);
        if (onListeningChange) onListeningChange(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error('Start Error:', e);
    }
  }, [findBestCommand, onCommand, onTranscript, onListeningChange]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
    if (onListeningChange) onListeningChange(false);
  }, [onListeningChange]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening
  };
}
