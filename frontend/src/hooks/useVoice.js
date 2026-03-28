import { useState, useCallback, useRef, useEffect } from 'react'

// Singleton instance for Speech Recognition
let sharedRecognition = null;

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const isMounted = useRef(true)

  const isPublicPage = ['/auth', '/login', '/register', '/'].includes(window.location.pathname);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playSound = useCallback((type = 'click') => {
    return;
  }, []);

  const startListening = useCallback((onResult) => {
    if (isPublicPage) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!sharedRecognition) {
      sharedRecognition = new SpeechRecognition();
      sharedRecognition.lang = 'id-ID';
    }

    // Set config for real-time and continuous capture
    sharedRecognition.continuous = true;
    sharedRecognition.interimResults = true;

    setIsListening(true);

    sharedRecognition.onresult = (event) => {
      let fullTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }
      if (onResult) onResult(fullTranscript);
    };

    sharedRecognition.onend = () => {
      setIsListening(false);
    };

    sharedRecognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    try {
      sharedRecognition.start();
    } catch (e) {
      // If already started, we just let it be
    }
  }, [isPublicPage]);

  const stopListening = useCallback(() => {
    if (sharedRecognition) {
      try {
        sharedRecognition.stop();
      } catch (e) {}
      setIsListening(false);
    }
  }, []);

  const speak = useCallback((text, rate = 1.1) => {
    if (isPublicPage || !text || !window.speechSynthesis) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    if (isMounted.current) {
      window.speechSynthesis.speak(utterance);
    }
  }, [isPublicPage]);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    isListening,
    isSpeaking: window.speechSynthesis ? window.speechSynthesis.speaking : false,
    speak,
    playSound,
    startListening,
    stopListening,
    stopSpeaking
  }
}
