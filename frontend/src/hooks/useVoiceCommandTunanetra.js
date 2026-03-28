import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for high-accuracy voice commands specifically for blind users.
 * Features: Noise filtering, fuzzy matching, and persistent listening.
 */
export function useVoiceCommandTunanetra({ onCommand, onTranscript, onListeningChange }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);

  const recognitionRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const isActiveRef = useRef(false);

  // Enhanced command mapping for better recognition
  const commandMap = {
    beranda: ['beranda', 'home', 'dashboard', 'halaman utama', 'ke beranda', 'depan'],
    quizku: ['quizku', 'quiz', 'tugas', 'soal', 'kuis', 'buka quiz', 'kerjakan soal'],
    materi: ['materi', 'modul', 'bahan ajar', 'pelajaran', 'buku', 'materi modul', 'belajar'],
    kolaborasi: ['kolaborasi', 'diskusi', 'grup', 'kelompok', 'chat', 'buka kolaborasi', 'teman'],
    tanya_ai: ['tanya ai', 'ai', 'asisten', 'bintang ai', 'tanya bintang', 'buka ai', 'tanya'],
    profil: ['profil', 'akun', 'pengaturan', 'profile', 'data diri', 'saya'],
    kembali: ['kembali', 'back', 'mundur', 'balik', 'tutup'],
    scroll_bawah: ['scroll bawah', 'gulir bawah', 'ke bawah', 'turun', 'lihat bawah'],
    scroll_atas: ['scroll atas', 'gulir atas', 'ke atas', 'naik', 'lihat atas'],
    baca_menu: ['baca menu', 'daftar menu', 'menu apa saja', 'sebutkan menu', 'ada apa aja'],
    baca_halaman: ['baca halaman', 'baca semua', 'bacakan halaman', 'baca konten', 'baca teks'],
    mulai_quiz: ['mulai quiz', 'mulai', 'kerjakan', 'start quiz', 'mulai soal', 'gas'],
    lanjut: ['lanjut', 'next', 'berikutnya', 'soal selanjutnya', 'seterusnya'],
    pilih_a: ['pilih a', 'jawab a', 'a', 'pilihan a', 'huruf a'],
    pilih_b: ['pilih b', 'jawab b', 'b', 'pilihan b', 'huruf b'],
    pilih_c: ['pilih c', 'jawab c', 'c', 'pilihan c', 'huruf c'],
    pilih_d: ['pilih d', 'jawab d', 'd', 'pilihan d', 'huruf d'],
    ok: ['ok', 'oke', 'kirim', 'send', 'sudah', 'selesai', 'mantap']
  };

  // Calculate similarity between two strings for fuzzy matching
  const calculateSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    const track = Array(s2.length + 1).fill(null).map(() =>
      Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator,
        );
      }
    }
    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (distance / maxLength);
  };

  const findBestCommand = useCallback((text) => {
    const words = text.toLowerCase().split(' ');
    let bestMatch = null;
    let bestScore = 0;

    for (const [command, phrases] of Object.entries(commandMap)) {
      for (const phrase of phrases) {
        const similarity = calculateSimilarity(text, phrase);
        if (similarity > bestScore && similarity > 0.7) {
          bestScore = similarity;
          bestMatch = command;
        }

        // Word by word check
        for (const word of words) {
          if (word.length > 2 && phrase.includes(word)) {
            const wordSimilarity = calculateSimilarity(word, phrase);
            if (wordSimilarity > bestScore && wordSimilarity > 0.6) {
              bestScore = wordSimilarity;
              bestMatch = command;
            }
          }
        }
      }
    }

    return { command: bestMatch, confidence: bestScore };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser.');
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
      isActiveRef.current = true;
      if (onListeningChange) onListeningChange(true);
      setTranscript('');
      setInterimTranscript('');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimText = '';
      let highestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptText = result[0].transcript;
        const confidenceValue = result[0].confidence || 0.5;

        if (result.isFinal) {
          finalTranscript += transcriptText + ' ';
          highestConfidence = Math.max(highestConfidence, confidenceValue);
          setConfidence(highestConfidence);
        } else {
          interimText += transcriptText + ' ';
        }
      }

      if (interimText) {
        setInterimTranscript(interimText.trim());
        if (onTranscript) onTranscript(interimText.trim(), false);
      }

      if (finalTranscript) {
        const cleanText = finalTranscript.trim();
        setTranscript(cleanText);
        setConfidence(highestConfidence);

        if (onTranscript) onTranscript(cleanText, true);

        const { command, confidence: cmdConfidence } = findBestCommand(cleanText);

        if (command && cmdConfidence > 0.65 && onCommand) {
          onCommand(command, cleanText, cmdConfidence);
        }

        // Handle "OK" to stop
        if (cleanText.toLowerCase().match(/\b(ok|oke|sudah|selesai|kirim)\b/)) {
          setTimeout(() => stopListening(), 300);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (isActiveRef.current && event.error !== 'not-allowed') {
        restartTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) startListening();
        }, 1000);
      }
    };

    recognition.onend = () => {
      if (isActiveRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) startListening();
        }, 500);
      } else {
        setIsListening(false);
        if (onListeningChange) onListeningChange(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("Recognition start skipped: already active");
    }
  }, [findBestCommand, onCommand, onTranscript, onListeningChange]);

  const stopListening = useCallback(() => {
    isActiveRef.current = false;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    if (onListeningChange) onListeningChange(false);
  }, [onListeningChange]);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    confidence,
    startListening,
    stopListening
  };
}
