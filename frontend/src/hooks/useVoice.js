import { useState, useCallback, useRef, useEffect } from 'react'

// Singleton instance to prevent multiple recognition objects interfering with each other
let sharedRecognition = null;

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const synthesisRef = useRef(window.speechSynthesis)
  const audioCtxRef = useRef(null)
  const isMounted = useRef(true)

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const unlockAudio = useCallback(() => {
    // Disabled
  }, []);

  useEffect(() => {
    // Recognition logic kept for possible voice command features,
    // but sound output is being disabled as per request.
    if (!sharedRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitRecognition;
      if (SpeechRecognition) {
        sharedRecognition = new SpeechRecognition();
        sharedRecognition.continuous = true;
        sharedRecognition.interimResults = true;
        sharedRecognition.lang = 'id-ID';
      }
    }

    return () => {
      isMounted.current = false;
    };
  }, []);

  const playSound = useCallback((type = 'click') => {
    // Perbaikan: Hapus/Nonaktifkan semua sound effect
    return;
  }, []);

  const startListening = useCallback((onResult) => {
    if (!sharedRecognition) return;
    try { sharedRecognition.stop(); } catch(e) {}
    setIsListening(true);
    sharedRecognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript && onResult) onResult(finalTranscript);
    };
    sharedRecognition.onerror = () => setIsListening(false);
    sharedRecognition.onend = () => setIsListening(false);
    setTimeout(() => {
        try { sharedRecognition.start(); } catch(e) {}
    }, 100);
  }, []);

  const stopListening = useCallback(() => {
    if (sharedRecognition) {
      sharedRecognition.stop();
      setIsListening(false);
    }
  }, []);

  const speak = useCallback((text, rate = 1.1) => {
    // Perbaikan: Hapus/Nonaktifkan semua fitur suara (TTS)
    return;
  }, []);

  return {
    isListening,
    isSpeaking: false,
    speak,
    playSound,
    hasInteracted: true,
    startListening,
    stopListening,
    stopSpeaking: () => {}
  }
}
