import React from 'react';
import { motion } from 'framer-motion';

const AILoadingSkeleton = () => {
  return (
    <div className="space-y-4 p-6 bg-white rounded-3xl border border-purple-100 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-purple-100 animate-pulse flex items-center justify-center">
          <span className="text-purple-600 text-xs">AI</span>
        </div>
        <div className="h-4 w-32 bg-slate-100 rounded-full animate-pulse" />
      </div>

      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-50 rounded-full animate-pulse" />
        <div className="h-4 w-[90%] bg-slate-50 rounded-full animate-pulse" />
        <div className="h-4 w-[95%] bg-slate-50 rounded-full animate-pulse" />
        <div className="h-4 w-[70%] bg-slate-50 rounded-full animate-pulse" />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="text-[10px] font-bold text-purple-400 uppercase tracking-widest text-center mt-4"
      >
        AI sedang membaca modul kamu...
      </motion.p>
    </div>
  );
};

export default AILoadingSkeleton;
