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
import { useSubtitle } from '../../components/DeafSubtitleOverlay';
import { useAccessibility } from '../../hooks/useAccessibility';

const StudentDashboard = () => {
  const { profile, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const { speak } = useVoice();
  const { showSubtitle } = useSubtitle();
  const { isBlind, isDeaf, isMute } = useAccessibility();

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
      if (t.includes('mulai quiz') || t.includes('kerjakan quiz') || t.includes('buka quiz pertama')) {
        if (tasks && tasks.length > 0) {
          speakFn(`Membuka quiz ${tasks[0].title}`);
          navigate(`/student/task/${tasks[0].id}`);
        } else {
          speakFn('Belum ada quiz yang tersedia.');
        }
        return 'start_quiz';
      }
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

  useEffect(() => {
    if (profile?.id) {
      fetchProfile(profile.id);
      fetchTasks();
      fetchLeaderboard();
      const channel = supabase.channel(`leaderboard-${profile.class_code || 'global'}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, fetchLeaderboard).subscribe();
      return () => supabase.removeChannel(channel);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!loading && profile && tasks !== null && !hasAnnouncedRef.current) {
      const hr = new Date().getHours();
      const timeGreeting = hr < 12 ? 'Selamat Pagi' : hr < 18 ? 'Selamat Siang' : 'Selamat Malam';
      setGreeting(timeGreeting);

      setTimeout(() => {
        setAvatarState('happy');
        hasAnnouncedRef.current = true;
        const name = profile.full_name?.split(' ')[0] || 'Teman';
        const xp = profile.xp || 0;
        const level = Math.floor(xp / 1000) + 1;
        const progress = Math.round((xp % 1000) / 10);
        const taskCount = tasks?.length || 0;

        if (isBlind) {
          const sidebarMsg = 'Menu utama: Beranda. QuizKu. Materi Modul. Kolaborasi. Tanya AI. Profil.';
          const contentMsg = `Halo ${name}. Poin kamu ${xp}. Level ${level}. Progress ${progress} persen. ` + (taskCount > 0 ? `${taskCount} Quiz aktif tersedia. Katakan Mulai Quiz untuk memulai.` : 'Semua quiz sudah selesai. Kamu hebat!') + ' Misi hari ini: selesaikan satu materi.';
          speak(sidebarMsg);
          setTimeout(() => speak(contentMsg), 4000);
        }

        if (isDeaf) {
          showSubtitle(`${timeGreeting}, ${name}! XP: ${xp} | Level: ${level}`, 'info');
        }

        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
          setAvatarState('idle');
        }, 3500);
      }, 1500);
    }
  }, [loading, tasks, profile, isBlind, isDeaf]);

  const fetchTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data: submissions } = await supabase.from('submissions').select('assignment_id').eq('student_id', profile.id);
      const submittedIds = submissions?.map(s => s.assignment_id) || [];
      let filterParts = ['is_public.eq.true'];
      if (profile.class_code) {
        const { data: teachers } = await supabase.from('profiles').select('id').eq('class_code', profile.class_code).eq('role', 'guru');
        teachers?.forEach(t => filterParts.push(`teacher_id.eq.${t.id}`));
      }
      let query = supabase.from('assignments').select('*, modules(title)').or(filterParts.join(','));
      if (submittedIds.length > 0) query = query.not('id', 'in', `(${submittedIds.join(',')})`);
      const { data } = await query.order('deadline', { ascending: true }).limit(3);
      setTasks(data || []);
    } catch { setTasks([]); } finally { setLoading(false); }
  };

  const fetchLeaderboard = async () => {
    if (!profile?.id) return;
    let query = supabase.from('profiles').select('id, full_name, xp').eq('role', 'siswa');
    if (profile.class_code) query = query.eq('class_code', profile.class_code);
    const { data } = await query.order('xp', { ascending: false });
    setLeaderboard(data || []);
  };

  const handleHover = (text) => {
    if (isBlind) speak(text);
    if (isDeaf) showSubtitle(text.slice(0, 100), 'info');
  };

  const currentLevel = Math.floor((profile?.xp || 0) / 1000) + 1;
  const progressPercentage = ((profile?.xp || 0) % 1000) / 10;

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

      <main className="flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto h-screen relative z-10">
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-8">
            <BintangAvatar state={avatarState} size="xl" />
            <div onMouseEnter={() => handleHover(`Selamat datang, ${profile?.full_name}`)}>
              <p className="text-indigo-600 font-bold text-xs uppercase tracking-[0.2em] mb-2">{greeting}</p>
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-800 leading-[1.1]">
                Halo, <span className="text-indigo-600">{profile?.full_name?.split(' ')[0]}!</span>
              </h1>
            </div>
          </motion.div>
          <div className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-xl border border-slate-50" onMouseEnter={() => handleHover(`Poin kamu ${profile?.xp || 0} XP`)}>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Poin Kamu</p>
              <p className="text-2xl font-black text-slate-800 text-center">⭐ {profile?.xp || 0}</p>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-12">
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100" onMouseEnter={() => handleHover(`Level ${currentLevel}`)}>
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h3 className="font-black text-slate-800 text-xl">Level {currentLevel}</h3>
                  <p className="text-sm font-medium text-slate-400">XP Progress</p>
                </div>
                <span className="font-black text-indigo-600 text-3xl">{Math.round(progressPercentage)}%</span>
              </div>
              <div className="h-6 bg-slate-100 rounded-full overflow-hidden border-4 border-slate-50">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPercentage}%` }} className="h-full bg-gradient-to-r from-amber-400 to-indigo-500 rounded-full" />
              </div>
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {navItems.map((item, i) => (
                <button key={i} onClick={() => navigate(item.path)} onMouseEnter={() => handleHover(item.label)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-xl transition-all flex items-center gap-6 group">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">{item.icon}</div>
                  <span className="font-black text-slate-800 text-xl">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 space-y-10">
            <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8" onMouseEnter={() => handleHover('Quiz yang harus kamu kerjakan')}>
              <h3 className="font-black text-slate-800 text-lg mb-8 uppercase tracking-widest">Quiz Terdekat</h3>
              <div className="space-y-4">
                {tasks?.map(task => (
                  <div key={task.id} onClick={() => navigate(`/student/task/${task.id}`)} onMouseEnter={() => handleHover(`Quiz ${task.title}`)} className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 cursor-pointer transition-all">
                    <p className="font-bold text-slate-800 text-sm truncate">{task.title}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Selesaikan segera!</p>
                  </div>
                ))}
              </div>
            </section>
            {leaderboard && (
              <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8" onMouseEnter={() => handleHover('Papan peringkat')}>
                <h3 className="font-black text-slate-800 text-lg mb-6 uppercase tracking-widest">Papan Peringkat</h3>
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((s, i) => (
                    <div key={s.id} className={`flex items-center gap-4 p-3 rounded-xl ${s.id === profile?.id ? 'bg-indigo-50' : ''}`}>
                      <span className="w-6 font-black text-slate-400 text-sm">{i + 1}</span>
                      <span className="flex-1 font-bold text-slate-700 truncate text-sm">{s.full_name}</span>
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
