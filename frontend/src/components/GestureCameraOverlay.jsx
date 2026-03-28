import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const GestureCameraOverlay = ({
  videoRef,
  canvasRef,
  isActive,
  handDetected = false,
  totalFingers = 0,
  menuActive = false,
  isProfilePage = false
}) => {
  const location = useLocation();
  const path = location.pathname;

  const isQuiz = path.includes('/student/tasks');
  const isModules = path.includes('/student/modules');
  const isDashboard = path.includes('/student/dashboard');

  const navCommands = [
    { icon: '☝️', label: 'Beranda' },
    { icon: '✌️', label: 'QuizKu' },
    { icon: '🤘', label: 'Modul' },
    { icon: '🖖', label: 'Mabar' },
    { icon: '✋', label: 'Tanya AI' },
    { icon: '7️⃣', label: 'Profil' },
  ];

  const profileCommands = [
    { icon: '✌️', label: 'Keluar (Logout)' },
    { icon: '🙌', label: 'Navigasi (10)' },
  ];

  const itemCommands = [
    { icon: '☝️', label: 'Urutan 1' },
    { icon: '✌️', label: 'Urutan 2' },
    { icon: '🤘', label: 'Urutan 3' },
    { icon: '🖖', label: 'Urutan 4' },
    { icon: '✋', label: 'Urutan 5' },
  ];

  const currentCommands = isProfilePage ? profileCommands : (menuActive ? navCommands : (isQuiz || isModules ? itemCommands : navCommands));

  const borderColor = !isActive ? 'border-slate-500' :
                      handDetected ? (menuActive ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.6)]' : (isProfilePage && totalFingers === 2 ? 'border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.6)]' : 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]')) : 'border-rose-500';

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end gap-3 pointer-events-none">
      {/* Camera Feed */}
      <div className={`relative w-48 h-36 md:w-64 md:h-48 rounded-[2rem] overflow-hidden border-4 transition-all duration-300 ${borderColor} bg-slate-900 shadow-2xl pointer-events-auto`}>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" muted playsInline autoPlay />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ transform: 'scaleX(-1)' }} />

        <div className="absolute bottom-0 inset-x-0 bg-slate-900/80 backdrop-blur-md py-1.5 px-3 flex justify-between items-center z-20">
          <span className="text-[9px] font-black text-white uppercase tracking-widest">
            {handDetected ? `${totalFingers} Jari Terdeteksi` : 'Tangan Tidak Terlihat'}
          </span>
          <div className={`w-2 h-2 rounded-full ${handDetected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        </div>
      </div>

      {/* Instruction Board */}
      <div className="bg-slate-900/95 backdrop-blur-xl rounded-[2rem] p-4 shadow-2xl border border-white/10 w-64 pointer-events-auto">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${menuActive ? 'text-emerald-400' : (isProfilePage ? 'text-rose-400' : 'text-indigo-400')}`}>
            {isProfilePage ? '👤 Menu Profil' : (menuActive ? '🔓 Menu Navigasi' : (isQuiz || isModules ? '🎯 Pilih Urutan' : '👋 Navigasi Jari'))}
          </p>
          <div className="flex gap-1">
             <div className={`w-1.5 h-1.5 rounded-full ${menuActive ? 'bg-emerald-500' : (isProfilePage ? 'bg-rose-500' : 'bg-indigo-500')}`}></div>
             <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
          </div>
        </div>

        <div className={`grid ${isProfilePage ? 'grid-cols-2' : 'grid-cols-5'} gap-2`}>
          {currentCommands.map((cmd, i) => (
            <div key={i} className="flex flex-col items-center gap-1 group">
              <div className={`text-xl transition-transform ${totalFingers === (i === 5 && !isProfilePage ? 7 : (isProfilePage && i === 0 ? 2 : (isProfilePage && i === 1 ? 10 : i+1))) ? 'scale-125' : 'opacity-40'}`}>{cmd.icon}</div>
              <div className={`text-[7px] font-black uppercase text-center leading-tight ${totalFingers === (i === 5 && !isProfilePage ? 7 : (isProfilePage && i === 0 ? 2 : (isProfilePage && i === 1 ? 10 : i+1))) ? 'text-white' : 'text-slate-500'}`}>
                {cmd.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-white/5 text-center">
           {isProfilePage ? (
             <p className="text-[7px] font-black text-rose-400 uppercase tracking-widest animate-pulse">
               ✌️ Tunjukkan 2 Jari untuk Keluar
             </p>
           ) : !menuActive ? (
             <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">
               🙌 Tunjukkan 10 jari untuk Menu Utama
             </p>
           ) : (
             <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
               Pilih 1-7 Jari untuk Pindah Halaman
             </p>
           )}
        </div>
      </div>
    </div>
  );
};

export default GestureCameraOverlay;
