import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const GestureCameraOverlay = ({
  videoRef,
  canvasRef,
  isActive,
  gestureLabel,
  lastGesture,
  handDetected = false
}) => {
  const location = useLocation();
  const isQuiz = location.pathname.includes('/quiz') || location.pathname.includes('/task');
  const isChat = location.pathname.includes('/playground');

  // Command configurations based on page
  const quizCommands = [
    { icon: '☝️', label: 'Pilih A' },
    { icon: '✌️', label: 'Pilih B' },
    { icon: '🤘', label: 'Pilih C' },
    { icon: '🖖', label: 'Pilih D' },
    { icon: '✊', label: 'Selesai' },
  ];

  const chatCommands = [
    { icon: '☝️', label: 'Tanya AI' },
    { icon: '✊', label: 'Bingung' },
    { icon: '👍', label: 'Paham' },
    { icon: '👎', label: 'Sulit' },
  ];

  const defaultCommands = [
    { icon: '👍', label: 'Lanjut' },
    { icon: '👎', label: 'Kembali' },
    { icon: '✌️', label: 'Pilih' },
    { icon: '✊', label: 'Beranda' },
  ];

  const currentCommands = isQuiz ? quizCommands : isChat ? chatCommands : defaultCommands;

  const borderColor = !isActive ? 'border-gray-500' :
                      handDetected ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'border-red-500';

  const statusText = !isActive ? 'Mengaktifkan...' :
                     !handDetected ? '❌ Tidak ada tangan' : '✓ Tangan terdeteksi';

  const statusColor = !isActive ? 'text-gray-400' :
                      !handDetected ? 'text-red-400' : 'text-green-400';

  return (
    <div className="fixed bottom-4 right-4 z-[150] flex flex-col items-end gap-2">
      {/* Camera Feed */}
      <div className={`relative w-40 h-32 md:w-56 md:h-44 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${borderColor} bg-black shadow-2xl`}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          muted
          playsInline
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Floating Indicator */}
        <div className="absolute top-2 right-2 z-20">
          <div className={`w-3 h-3 rounded-full ${handDetected ? 'bg-green-500 animate-pulse' : 'bg-red-500 opacity-50'}`} />
        </div>

        {/* Overlay Status */}
        <div className={`absolute bottom-0 left-0 right-0 text-center text-[9px] font-black ${statusColor} bg-black/60 backdrop-blur-sm py-1 z-20 uppercase tracking-tighter`}>
          {statusText}
        </div>
      </div>

      {/* Instruction Board (Papan Panduan) */}
      <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 shadow-2xl border border-white/10 w-56">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">✋ Panduan Jari</p>
          <div className="flex gap-0.5">
             <div className="w-1 h-1 rounded-full bg-white/20"></div>
             <div className="w-1 h-1 rounded-full bg-white/20"></div>
          </div>
        </div>

        <div className={`grid ${currentCommands.length > 4 ? 'grid-cols-5' : 'grid-cols-4'} gap-1 text-center`}>
          {currentCommands.map((cmd, i) => (
            <div key={i} className="flex flex-col items-center group">
              <div className="text-xl mb-1 group-hover:scale-110 transition-transform">{cmd.icon}</div>
              <div className="text-[7px] leading-tight font-bold text-slate-300 uppercase tracking-tighter">{cmd.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Gesture Overlay */}
      <AnimatePresence>
        {gestureLabel && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.5 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.5 }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 border-2 border-white/20"
          >
            <span className="text-2xl">{gestureLabel}</span>
            <span className="text-[10px] font-black uppercase tracking-widest">
              {lastGesture?.replace(/_/g, ' ')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GestureCameraOverlay;
