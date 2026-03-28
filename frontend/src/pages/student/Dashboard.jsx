// pages/student/Dashboard.jsx — FULL FIXED ACCESSIBILITY VERSION
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import StudentSidebar from '../../components/StudentSidebar';
import BintangAvatar from '../../components/BintangAvatar';
import ConfettiEffect from '../../components/ConfettiEffect';
import { supabase } from '../../lib/supabase';
import { useVoice } from '../../hooks/useVoice';
import { useGlobalVoiceNav } from '../../hooks/useGlobalVoiceNav';
import { useGestureControl } from '../../hooks/useGestureControl';
import GestureCameraOverlay from '../../components/GestureCameraOverlay';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';
import { useAccessibility } from '../../hooks/useAccessibility';

const StudentDashboard = () => {
  const { profile, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const { speak } = useVoice();
  const { showSubtitle } = useSubtitle();
  const { isBlind, isDeaf, isMute, isVoiceActive, isSubtitleActive, isGestureActive } = useAccessibility();

  const [tasks, setTasks] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [avatarState, setAvatarState] = useState('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const hasAnnouncedRef = useRef(false);

  // ── TUNANETRA: Global voice navigation ──
  useGlobalVoiceNav({
    enabled: isBlind,
    onCommand: (t, speakFn) => {
      // "Mulai quiz" → langsung buka quiz pertama
      if (t.includes('mulai quiz') || t.includes('kerjakan quiz') || t.includes('buka quiz pertama')) {
        if (tasks && tasks.length > 0) {
          speakFn(`Membuka quiz ${tasks[0].title}`);
          navigate(`/student/task/${tasks[0].id}`);
        } else {
          speakFn('Belum ada quiz yang tersedia.');
        }
        return 'start_quiz';
      }
      // "Baca status"
      if (t.includes('baca status') || t.includes('status saya') || t.includes('info saya')) {
        const name = profile?.full_name?.split(' ')[0] || 'Teman';
        const xp = profile?.xp || 0;
        const level = Math.floor(xp / 1000) + 1;
        speakFn(`Halo ${name}. Poin kamu ${xp}. Level ${level}. ${tasks?.length || 0} quiz aktif tersedia.`);
        return 'read_status';
      }
      return null;
    }
  });

  // ── TUNAWICARA: Gesture control ──
  const {
    videoRef,
    canvasRef,
    isActive: camActive,
    gestureLabel,
    lastGesture,
    confidence,
    handDetected,
    landmarksVisible
  } = useGestureControl({
    enabled: isMute,
    onGesture: (gesture, action, text) => {
      // Navigation using gestures
      if (action === 'home') {
        navigate('/student/dashboard');
        if (isDeaf) showSubtitle('✊ Kembali ke Beranda', 'success');
      }
      if (action === 'quiz') {
        navigate('/student/tasks');
        if (isDeaf) showSubtitle('☝️ Membuka QuizKu', 'info');
      }
      if (action === 'select') {
        // Cari tombol aktif dan klik
        const activeElement = document.activeElement;
        if (activeElement && activeElement.click) {
          activeElement.click();
          if (isDeaf) showSubtitle('✌️ Memilih', 'success');
        }
      }
      if (action === 'next') {
        // Navigasi ke konten berikutnya
        window.scrollBy({ top: 300, behavior: 'smooth' });
        if (isDeaf) showSubtitle('✋ Lanjut', 'info');
      }
      if (action === 'back') {
        window.scrollBy({ top: -300, behavior: 'smooth' });
        if (isDeaf) showSubtitle('👎 Kembali', 'info');
      }

      // Additional specific gestures
      if (action === 'confirm' && tasks?.length > 0) {
        navigate(`/student/task/${tasks[0].id}`);
        showSubtitle('👍 Memulai Quiz', 'success');
      }
      if (action === 'ask_ai' || gesture === 'point_up') {
        navigate('/student/playground');
        showSubtitle('☝️ Membuka Tanya AI', 'info');
      }
      if (gesture === 'open_hand') {
        navigate('/student/modules');
        showSubtitle('✋ Membuka Materi', 'info');
      }
    }
  });

  useEffect(() => {
    if (profile?.id) {
      fetchProfile(profile.id);
      fetchTasks();
      fetchLeaderboard();

      const channel = supabase
        .channel(`leaderboard-${profile.class_code || 'global'}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, fetchLeaderboard)
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!loading && profile && tasks !== null && !hasAnnouncedRef.current) {
      const hr = new Date().getHours();
      const timeGreeting =
        hr < 12 ? 'Selamat Pagi' : hr < 18 ? 'Selamat Siang' : 'Selamat Malam';
      setGreeting(timeGreeting);

      setTimeout(() => {
        setAvatarState('happy');
        hasAnnouncedRef.current = true;

        const name = profile.full_name?.split(' ')[0] || 'Teman';
        const xp = profile.xp || 0;
        const level = Math.floor(xp / 1000) + 1;
        const progress = Math.round((xp % 1000) / 10);
        const taskCount = tasks?.length || 0;

        // ── TUNANETRA: Briefing lengkap ──
        if (isBlind) {
          const sidebarMsg =
            'Menu utama: Beranda. QuizKu. Materi Modul. Kolaborasi. Tanya AI. Profil.';
          const contentMsg =
            `Halo ${name}. Poin kamu ${xp}. Level ${level}. Progress ${progress} persen. ` +
            (taskCount > 0
              ? `${taskCount} Quiz aktif tersedia. Katakan Mulai Quiz untuk memulai.`
              : 'Semua quiz sudah selesai. Kamu hebat!') +
            ' Misi hari ini: selesaikan satu materi.';

          speak(sidebarMsg);
          setTimeout(() => speak(contentMsg), 4000);
        }

        // ── TUNARUNGU: Subtitle ──
        if (isDeaf) {
          showSubtitle(`${timeGreeting}, ${name}! XP: ${xp} | Level: ${level}`, 'info');
          setTimeout(
            () =>
              showSubtitle(
                taskCount > 0 ? `${taskCount} Quiz menunggumu!` : 'Semua quiz selesai! 🏆',
                'success'
              ),
            2500
          );
        }

        // ── TUNAWICARA: Panduan gesture ──
        if (isMute) {
          showSubtitle('👍 Mulai Quiz | ✌️ Lihat Semua Quiz | ☝️ Tanya AI | ✋ Materi', 'info');
        }

        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
          setAvatarState('idle');
        }, 3500);
      }, 1500);
    }
  }, [loading, tasks, profile, isBlind, isDeaf, isMute]);

  const fetchTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', profile.id);
      const submittedIds = submissions?.map(s => s.assignment_id) || [];

      let filterParts = ['is_public.eq.true'];
      if (profile.class_code) {
        const { data: teachers } = await supabase
          .from('profiles')
          .select('id')
          .eq('class_code', profile.class_code)
          .eq('role', 'guru');
        teachers?.forEach(t => filterParts.push(`teacher_id.eq.${t.id}`));
      }

      let query = supabase
        .from('assignments')
        .select('*, modules(title)')
        .or(filterParts.join(','));
      if (submittedIds.length > 0) {
        query = query.not('id', 'in', `(${submittedIds.join(',')})`);
      }

      const { data } = await query.order('deadline', { ascending: true }).limit(3);
      setTasks(data || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    if (!profile?.id) return;
    let query = supabase
      .from('profiles')
      .select('id, full_name, xp')
      .eq('role', 'siswa');
    if (profile.class_code) query = query.eq('class_code', profile.class_code);
    const { data } = await query.order('xp', { ascending: false });
    setLeaderboard(data || []);
  };

  const handleHover = (text) => {
    if (isBlind) speak(text);
    if (isDeaf) showSubtitle(text.slice(0, 100), 'info');
  };

  const currentLevel = Math.floor((profile?.xp || 0) / 1000) + 1;
  const currentXPProgress = (profile?.xp || 0) % 1000;
  const progressPercentage = (currentXPProgress / 1000) * 100;

  const navItems = [
    { label: 'Beranda', path: '/student/dashboard', icon: '🏠' },
    { label: 'QuizKu', path: '/student/tasks', icon: '🎯' },
    { label: 'Materi Modul', path: '/student/modules', icon: '📖' },
    { label: 'Kolaborasi', path: '/student/collaboration', icon: '🏰' },
    { label: 'Tanya AI', path: '/student/playground', icon: '🤖' },
    { label: 'Profil', path: '/profile', icon: '👤' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans relative overflow-hidden">
      <ConfettiEffect active={showConfetti} />
      <StudentSidebar />

      {isMute && (
        <GestureCameraOverlay
          videoRef={videoRef}
          canvasRef={canvasRef}
          isActive={camActive}
          gestureLabel={gestureLabel}
          lastGesture={lastGesture}
          confidence={confidence}
          handDetected={handDetected}
          landmarksVisible={landmarksVisible}
        />
      )}

      {/* TUNANETRA: floating voice hint */}
      {isBlind && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-xl">
          🎤 Mode Suara Aktif — Bicara untuk navigasi
        </div>
      )}

      <main className="flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto h-screen relative z-10">
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-8"
          >
            <div className="relative group">
              <BintangAvatar state={avatarState} size="xl" />
            </div>
            <div onMouseEnter={() => handleHover(`Selamat datang, ${profile?.full_name}`)}>
              <p className="text-indigo-600 font-bold text-xs uppercase tracking-[0.2em] mb-2">
                {greeting}
              </p>
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-800 leading-[1.1]">
                Halo,{' '}
                <span className="text-indigo-600">{profile?.full_name?.split(' ')[0]}!</span>
              </h1>
            </div>
          </motion.div>

          <div
            className={`flex items-center gap-4 bg-white p-4 rounded-3xl shadow-xl border ${isDeaf ? 'border-blue-200' : 'border-slate-50'}`}
            onMouseEnter={() => handleHover(`Poin kamu ${profile?.xp || 0} XP`)}
          >
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                Poin Kamu
              </p>
              <p className="text-2xl font-black text-slate-800 text-center">⭐ {profile?.xp || 0}</p>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-12">
            {/* XP Bar */}
            <section
              className={`bg-white p-8 rounded-[2.5rem] shadow-sm border ${isDeaf ? 'border-blue-200' : 'border-slate-100'}`}
              onMouseEnter={() =>
                handleHover(
                  `Level ${currentLevel}. Progres level ${Math.round(progressPercentage)} persen.`
                )
              }
            >
              <div className="flex justify-between items-end mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-2xl">
                    🏅
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-xl">Level {currentLevel}</h3>
                    <p className="text-sm font-medium text-slate-400">XP Progress</p>
                  </div>
                </div>
                <span className="font-black text-indigo-600 text-3xl">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <div className="h-6 bg-slate-100 rounded-full overflow-hidden border-4 border-slate-50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  className="h-full bg-gradient-to-r from-amber-400 to-indigo-500 rounded-full"
                />
              </div>
            </section>

            {/* Nav Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {navItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => navigate(item.path)}
                  onMouseEnter={() => handleHover(item.label)}
                  aria-label={item.label}
                  className={`bg-white p-8 rounded-[2.5rem] border shadow-sm hover:border-indigo-100 hover:shadow-xl transition-all flex items-center gap-6 group ${isDeaf ? 'border-blue-100' : 'border-slate-100'}`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <span className="font-black text-slate-800 text-xl">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quiz sidebar */}
          <div className="lg:col-span-4 space-y-10">
            <section
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8"
              onMouseEnter={() => handleHover('Quiz yang harus kamu kerjakan')}
            >
              <h3 className="font-black text-slate-800 text-lg mb-8 uppercase tracking-widest">
                Quiz Terdekat
              </h3>
              <div className="space-y-4">
                {loading
                  ? [1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
                    ))
                  : tasks?.map(task => (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/student/task/${task.id}`)}
                        onMouseEnter={() =>
                          handleHover(`Quiz ${task.title}. Klik untuk mulai.`)
                        }
                        aria-label={`Quiz: ${task.title}`}
                        className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 cursor-pointer transition-all group"
                      >
                        <p className="font-bold text-slate-800 text-sm truncate">{task.title}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                          Selesaikan segera!
                        </p>
                      </div>
                    ))}
                {!loading && tasks?.length === 0 && (
                  <p className="text-center py-4 text-slate-400 font-bold">
                    Semua quiz selesai! 🏆
                  </p>
                )}
              </div>
            </section>

            {/* Leaderboard */}
            {leaderboard && leaderboard.length > 0 && (
              <section
                className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8"
                onMouseEnter={() => handleHover('Papan peringkat kelas')}
              >
                <h3 className="font-black text-slate-800 text-lg mb-6 uppercase tracking-widest">
                  Papan Peringkat
                </h3>
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((s, i) => (
                    <div
                      key={s.id}
                      className={`flex items-center gap-4 p-3 rounded-xl ${s.id === profile?.id ? 'bg-indigo-50' : ''}`}
                      onMouseEnter={() => handleHover(`Peringkat ${i + 1}: ${s.full_name}, ${s.xp} XP`)}
                    >
                      <span className="w-6 font-black text-slate-400 text-sm">{i + 1}</span>
                      <span className="flex-1 font-bold text-slate-700 truncate text-sm">
                        {s.full_name}
                      </span>
                      <span className="font-black text-indigo-600 text-sm">{s.xp} XP</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
