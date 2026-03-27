import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from '../hooks/useVoice';
import { useVoiceCommand } from '../hooks/useVoiceCommand';
import { useAuthStore } from '../store/authStore';

const VoiceButton = ({ commands, onCommandMatch, customText }) => {
  const { isListening, isProcessing, isSpeaking, startListening, stopListening, speak } = useVoice();
  const { processCommand } = useVoiceCommand(commands);
  const { profile } = useAuthStore();
  const lastTranscript = useRef("");

  // Feedback getaran halus
  useEffect(() => {
    if (isListening && 'vibrate' in navigator) {
       navigator.vibrate(40);
    }
  }, [isListening]);

  const handleToggleMic = (e) => {
    e.stopPropagation(); // Mencegah bubbling yang bisa memicu pindah halaman/step

    if (isSpeaking) {
        window.speechSynthesis.cancel();
        return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening((transcript) => {
        if (!transcript) return;
        lastTranscript.current = transcript;
        const command = processCommand(transcript);

        if (onCommandMatch) {
          onCommandMatch(command, transcript);
        }
      });
    }
  };

  return (
    <div className="flex flex-col items-center group">
      {/* Label Status - Muncul di atas tombol tanpa menggeser posisi tombol */}
      <div className="h-12 flex items-end justify-center mb-2">
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-white/70 backdrop-blur-md px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm flex items-center gap-3"
            >
               <span className="flex gap-1">
                  {[1,2,3].map(i => (
                      <motion.div
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i*0.2 }}
                          className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
                      />
                  ))}
               </span>
               <p className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Mendengarkan...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        {/* Glow Effect (Efek Pendaran Transparan) */}
        <AnimatePresence>
          {(isListening || isSpeaking) && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 0.4 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`absolute inset-0 rounded-full blur-xl -z-10 ${isSpeaking ? 'bg-indigo-400' : 'bg-rose-400'}`}
            />
          )}
        </AnimatePresence>

        {/* Tombol Mikrofon Utama */}
        <button
          onClick={handleToggleMic}
          disabled={isProcessing}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 border-2
            ${isSpeaking
              ? 'bg-indigo-600/90 border-indigo-200'
              : (isListening ? 'bg-rose-500/90 border-rose-200' : 'bg-slate-900/80 hover:bg-indigo-600 border-white/20')
            }
            backdrop-blur-sm pointer-events-auto active:scale-95
          `}
          aria-label="Mikrofon"
        >
          {isProcessing ? (
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : isSpeaking ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
            </svg>
          )}
        </button>
      </div>

      {/* Teks Petunjuk */}
      <div className="mt-4 overflow-hidden h-6">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center transition-opacity duration-300 group-hover:opacity-100 opacity-60">
          {isSpeaking ? 'Klik untuk Senyap' : (customText || (isListening ? 'Bicara Sekarang' : 'Tekan Mikrofon'))}
        </p>
      </div>
    </div>
  );
};

export default VoiceButton;
