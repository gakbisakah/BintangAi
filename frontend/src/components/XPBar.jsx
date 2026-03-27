import React from 'react';
import { motion } from 'framer-motion';

const XPBar = ({ current = 0, nextLevel = 1000, level = 1 }) => {
  const percentage = Math.min(Math.round((current / nextLevel) * 100), 100);

  return (
    <div className="w-full bg-white/5 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/10 shadow-inner">
      <div className="flex justify-between items-end mb-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">Level Petualangan</span>
          <h3 className="text-3xl font-black text-white flex items-baseline gap-2">
            {level}
            <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Master</span>
          </h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest opacity-60">Kemajuan</span>
          <p className="text-sm font-black text-white">{current} / {nextLevel} <span className="opacity-40">XP</span></p>
        </div>
      </div>

      <div className="relative h-5 w-full bg-white/10 rounded-full p-1 border border-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: "circOut" }}
          className="relative h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.5)]"
        >
          {/* Animated Shine */}
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-1/2 skew-x-12"
          />
        </motion.div>
      </div>

      <div className="flex justify-between mt-3 px-1">
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
           <span className="text-[8px] font-black text-indigo-200 uppercase tracking-widest">Level {level}</span>
        </div>
        <span className="text-[8px] font-black text-indigo-200 uppercase tracking-widest">Level {level + 1}</span>
      </div>
    </div>
  );
};

export default XPBar;
