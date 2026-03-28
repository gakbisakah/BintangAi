import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccessibilityStore } from '../store/accessibilityStore';

let subtitleListeners = [];

export const subtitleBus = {
  emit: (text, type = 'info') => {
    subtitleListeners.forEach(fn => fn(text, type));
  }
};

export const useSubtitle = () => {
  return {
    showSubtitle: (text, type = 'info') => subtitleBus.emit(text, type)
  };
};

const TYPE_STYLES = {
  info: 'bg-blue-600 text-white border-blue-400',
  success: 'bg-emerald-600 text-white border-emerald-400',
  error: 'bg-red-600 text-white border-red-400',
  warning: 'bg-yellow-500 text-slate-900 border-yellow-600 animate-pulse',
  ai: 'bg-indigo-700 text-white border-indigo-500',
};

const DeafSubtitleOverlay = () => {
  const { mode, isSubtitleActive } = useAccessibilityStore();
  const isDeaf = mode === 'tunarungu';
  const [entries, setEntries] = useState([]);
  const idRef = useRef(0);
  const flashRef = useRef(null);

  useEffect(() => {
    if (!isDeaf || !isSubtitleActive) return;

    const handler = (text, type) => {
      const id = ++idRef.current;
      if (!text) return;

      setEntries(prev => [...prev.slice(-2), { id, text, type }]);

      // Visual flash for warnings/errors
      if (type === 'warning' || type === 'error') {
        if (flashRef.current) {
          flashRef.current.style.opacity = '0.3';
          setTimeout(() => {
            if (flashRef.current) flashRef.current.style.opacity = '0';
          }, 300);
        }
      }

      const duration = type === 'ai' ? 8000 : 5000;
      setTimeout(() => {
        setEntries(prev => prev.filter(e => e.id !== id));
      }, duration);
    };

    subtitleListeners.push(handler);
    return () => {
      subtitleListeners = subtitleListeners.filter(fn => fn !== handler);
    };
  }, [isDeaf, isSubtitleActive]);

  if (!isDeaf || !isSubtitleActive) return null;

  return (
    <>
      {/* Visual Flash Overlay for warnings/errors */}
      <div
        ref={flashRef}
        className="fixed inset-0 pointer-events-none z-[199] transition-opacity duration-300 opacity-0"
        style={{ backgroundColor: 'rgba(255, 0, 0, 0.3)' }}
      />

      <div className="fixed bottom-10 left-0 right-0 z-[200] flex flex-col items-center gap-4 p-6 pointer-events-none">
        <AnimatePresence>
          {entries.map(e => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className={`px-10 py-5 rounded-[2rem] text-2xl font-black max-w-3xl text-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl border-4 ${TYPE_STYLES[e.type] || TYPE_STYLES.info}`}
            >
              <div className="flex items-center justify-center gap-3">
                {e.type === 'ai' && <span className="text-3xl">🤖</span>}
                {e.type === 'warning' && <span className="text-3xl animate-pulse">⚠️</span>}
                {e.type === 'error' && <span className="text-3xl">🚫</span>}
                {e.type === 'success' && <span className="text-3xl">✅</span>}
                <span>{e.text}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Pulsing border for warning */}
        <AnimatePresence>
          {entries.some(e => e.type === 'warning') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.15, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="fixed inset-0 bg-yellow-400 pointer-events-none -z-10"
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default DeafSubtitleOverlay;