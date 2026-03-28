import { useState, useCallback, useRef, useEffect } from 'react'

// Singleton instance for Speech Recognition
let sharedRecognition = null;

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const isMounted = useRef(true)

  // Use a global flag to check if voice should be active
  // This is a safety measure to ensure no voice runs on login/register/landing
  const isPublicPage = ['/auth', '/login', '/register', '/'].includes(window.location.pathname);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Cleanup any pending speech on unmount
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playSound = useCallback((type = 'click') => {
    // Sound disabled globally for now as per previous instruction
    return;
  }, []);

  const startListening = useCallback((onResult) => {
    if (isPublicPage) return; // Block on public pages

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!sharedRecognition) {
      sharedRecognition = new SpeechRecognition();
      sharedRecognition.continuous = false;
      sharedRecognition.interimResults = false;
      sharedRecognition.lang = 'id-ID';
    }

    setIsListening(true);
    sharedRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (onResult) onResult(transcript);
    };
    sharedRecognition.onend = () => setIsListening(false);
    sharedRecognition.onerror = () => setIsListening(false);

    try {
      sharedRecognition.start();
    } catch (e) {
      console.warn("Recognition already started");
    }
  }, [isPublicPage]);

  const stopListening = useCallback(() => {
    if (sharedRecognition) {
      sharedRecognition.stop();
      setIsListening(false);
    }
  }, []);

  const speak = useCallback((text, rate = 1.1) => {
    // CRITICAL FIX: Block speech synthesis on public pages and if not explicitly called
    if (isPublicPage || !text || !window.speechSynthesis) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }

    // Cancel any ongoing speech before starting new one
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    // Safety check: only speak if the page is still active
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
