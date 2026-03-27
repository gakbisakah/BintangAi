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
    if (hasInteracted) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    setHasInteracted(true);
  }, [getAudioContext, hasInteracted]);

  useEffect(() => {
    // Inisialisasi recognition hanya SEKALI (Singleton)
    if (!sharedRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        sharedRecognition = new SpeechRecognition();
        sharedRecognition.continuous = true;
        sharedRecognition.interimResults = true;
        sharedRecognition.lang = 'id-ID';
      }
    }

    const handleFirstInteraction = () => {
      unlockAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      isMounted.current = false;
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [unlockAudio]);

  const playSound = useCallback((type = 'click') => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {}
  }, [getAudioContext]);

  const startListening = useCallback((onResult) => {
    unlockAudio();
    if (!sharedRecognition) return;

    // Reset status jika sebelumnya macet
    try { sharedRecognition.stop(); } catch(e) {}

    setIsListening(true);

    sharedRecognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript && onResult) onResult(finalTranscript);
    };

    sharedRecognition.onerror = (event) => {
      console.error("Mic error:", event.error);
      setIsListening(false);
    };

    sharedRecognition.onend = () => {
      setIsListening(false);
    };

    setTimeout(() => {
        try { sharedRecognition.start(); } catch(e) {}
    }, 100);
  }, [unlockAudio]);

  const stopListening = useCallback(() => {
    if (sharedRecognition) {
      sharedRecognition.stop();
      setIsListening(false);
    }
  }, []);

  const speak = useCallback((text, rate = 1.1) => {
    if (!text || !isMounted.current) return;
    synthesisRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthesisRef.current.getVoices();
    const idVoice = voices.find(v => v.lang.includes('id-ID')) || voices.find(v => v.lang.includes('id'));
    if (idVoice) utterance.voice = idVoice;
    utterance.lang = 'id-ID';
    utterance.rate = rate;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synthesisRef.current.speak(utterance);
  }, []);

  return {
    isListening,
    isSpeaking,
    speak,
    playSound,
    hasInteracted,
    startListening,
    stopListening,
    stopSpeaking: () => synthesisRef.current.cancel()
  }
}
