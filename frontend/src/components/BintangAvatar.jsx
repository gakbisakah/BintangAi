import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BintangAvatar = ({ state = 'idle', size = 'md' }) => {
  // states: idle, thinking, happy, speaking

  const sizes = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    xl: 'w-64 h-64'
  };

  return (
    <div className={`relative ${sizes[size] || sizes.md} flex items-center justify-center`}>
      {/* Glow Effect */}
      <motion.div
        animate={{
          scale: state === 'thinking' ? [1, 1.2, 1] : 1,
          opacity: state === 'thinking' ? [0.2, 0.5, 0.2] : 0.1,
        }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute inset-0 bg-indigo-400 rounded-full blur-2xl"
      />

      {/* Character Body */}
      <motion.div
        animate={{
          y: state === 'speaking' ? [0, -8, 0] : [0, -2, 0],
        }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="relative z-10 w-full h-full"
      >
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="starGradient" x1="50" y1="5" x2="50" y2="95" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366F1" />
              <stop offset="1" stopColor="#A855F7" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="4" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.3" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Star Shape */}
          <motion.path
            d="M50 5L61.2257 39.1306H97.044L68.0092 60.2388L79.2349 94.3694L50 73.2612L20.7651 94.3694L31.9908 60.2388L2.95601 39.1306H38.7743L50 5Z"
            fill="url(#starGradient)"
            filter="url(#shadow)"
            initial={{ rotate: 0 }}
            animate={{
              rotate: state === 'happy' ? [0, 15, -15, 0] : 0,
              scale: state === 'happy' ? [1, 1.15, 1] : 1
            }}
            transition={{ rotate: { repeat: state === 'happy' ? Infinity : 0, duration: 0.5 } }}
          />

          {/* Eyes */}
          <motion.circle
            cx="35" cy="45" r="4" fill="#1E293B"
            animate={{ scaleY: state === 'thinking' ? 0.1 : 1 }}
          />
          <motion.circle
            cx="65" cy="45" r="4" fill="#1E293B"
            animate={{ scaleY: state === 'thinking' ? 0.1 : 1 }}
          />

          {/* Mouth */}
          <AnimatePresence mode="wait">
            {state === 'speaking' ? (
              <motion.path
                key="speaking"
                d="M40 65 Q50 75 60 65"
                stroke="#1E293B" strokeWidth="3" strokeLinecap="round"
                animate={{ d: ["M40 65 Q50 70 60 65", "M40 65 Q50 85 60 65", "M40 65 Q50 70 60 65"] }}
                transition={{ repeat: Infinity, duration: 0.4 }}
              />
            ) : state === 'happy' ? (
              <motion.path
                key="happy"
                d="M30 60 Q50 85 70 60"
                stroke="#1E293B" strokeWidth="4" strokeLinecap="round"
              />
            ) : (
              <motion.path
                key="idle"
                d="M42 65 L58 65"
                stroke="#1E293B" strokeWidth="3" strokeLinecap="round"
              />
            )}
          </AnimatePresence>
        </svg>
      </motion.div>
    </div>
  );
};

export default BintangAvatar;
