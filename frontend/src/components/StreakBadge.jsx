import React from 'react';
import { motion } from 'framer-motion';

const StreakBadge = ({ days = 0 }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`
        flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300
        ${days > 0
          ? 'bg-orange-50 border-orange-100 text-orange-600 shadow-sm'
          : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
        }
      `}
    >
      <div className={`
        text-2xl
        ${days > 0 ? 'animate-bounce' : ''}
      `}>
        {days > 0 ? '🔥' : '❄️'}
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Streak Belajar</div>
        <div className="text-xl font-black">{days} <span className="text-sm font-bold">Hari</span></div>
      </div>
    </motion.div>
  );
};

export default StreakBadge;
