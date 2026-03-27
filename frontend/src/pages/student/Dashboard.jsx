import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import StudentSidebar from '../../components/StudentSidebar';
import BintangAvatar from '../../components/BintangAvatar';
import ConfettiEffect from '../../components/ConfettiEffect';
import { supabase } from '../../lib/supabase';
import { useVoice } from '../../hooks/useVoice';

const StudentDashboard = () => {
  const { profile, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [avatarState, setAvatarState] = useState('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const hasAnnouncedRef = useRef(false);
  const { speak } = useVoice();

  const isBlind = profile?.disability_type === 'tunanetra';

  // 1. SINKRONISASI PROFIL REALTIME (XP & DATA LAIN)
  useEffect(() => {
    if (profile?.id) {
        fetchProfile(profile.id);
    }
  }, [profile?.id]);

  // 2. FETCH DATA AWAL & REALTIME LEADERBOARD
  useEffect(() => {
    if (profile?.id) {
        fetchTasks();
        fetchLeaderboard();

        const channel = supabase
          .channel(`leaderboard-realtime-${profile.class_code || 'global'}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: profile.class_code ? `class_code=eq.${profile.class_code}` : `role=eq.siswa`
            },
            () => {
              fetchLeaderboard();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
    }
  }, [profile?.id, profile?.class_code]);

  // Efek greeting dan animasi avatar
  useEffect(() => {
    if (!loading && profile && tasks !== null && !hasAnnouncedRef.current) {
      const hr = new Date().getHours();
      const timeGreeting = hr < 12 ? 'Selamat Pagi' : hr < 18 ? 'Selamat Siang' : 'Selamat Malam';
      setGreeting(timeGreeting);

      const timer = setTimeout(() => {
        setAvatarState('happy');
        hasAnnouncedRef.current = true;

        if (isBlind) {
          const taskCount = tasks.length;
          const name = profile.full_name?.split(' ')[0] || 'Teman';
          const intro = `Hai ${name}, ${timeGreeting}. Kamu berada di beranda. Saat ini kamu memiliki ${profile.xp || 0} XP. Ada ${taskCount} kuis yang tersedia untuk dikerjakan.`;
          speak(intro);
        }

        setTimeout(() => setShowConfetti(true), 500);
        setTimeout(() => setShowConfetti(false), 3000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, tasks, profile, isBlind]);

  const fetchTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', profile.id);

      const submittedIds = submissions?.map(s => s.assignment_id) || [];

      let teacherIds = [];
      if (profile.class_code) {
        const { data: teachers } = await supabase
          .from('profiles')
          .select('id')
          .eq('class_code', profile.class_code)
          .eq('role', 'guru');
        teacherIds = teachers?.map(t => t.id) || [];
      }

      let filterParts = ['is_public.eq.true'];
      if (teacherIds.length > 0) {
        teacherIds.forEach(id => filterParts.push(`teacher_id.eq.${id}`));
      }

      let query = supabase
        .from('assignments')
        .select('*, modules(title)')
        .or(filterParts.join(','));

      if (submittedIds.length > 0) {
        query = query.not('id', 'in', `(${submittedIds.join(',')})`);
      }

      const { data, error } = await query
        .order('deadline', { ascending: true })
        .limit(3);

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    if (!profile?.id) return;
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, xp')
        .eq('role', 'siswa');
      if (profile.class_code) {
        query = query.eq('class_code', profile.class_code);
      }
      const { data, error } = await query.order('xp', { ascending: false });
      if (error) throw error;
      setLeaderboard(data || []);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      setLeaderboard([]);
    }
  };

  const handleHover = (text) => {
    if (isBlind) {
      speak(text);
    }
  };

  const currentLevel = Math.floor((profile?.xp || 0) / 1000) + 1;
  const nextLevelXP = 1000;
  const currentXPProgress = (profile?.xp || 0) % 1000;
  const progressPercentage = (currentXPProgress / nextLevelXP) * 100;
  const isDeafMode = profile?.disability_type === 'tunarungu';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-indigo-100 relative overflow-hidden text-slate-900">
      <ConfettiEffect active={showConfetti} />
      <StudentSidebar />

      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-200/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-amber-200/20 rounded-full blur-[100px] pointer-events-none" />

      <main className="flex-1 p-6 md:p-10 lg:p-14 max-w-7xl mx-auto w-full overflow-y-auto h-screen custom-scrollbar relative z-10">

        {/* Header Section */}
        <header className="mb-14 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex items-center gap-8"
            onMouseEnter={() => handleHover(`Profil kamu, ${profile?.full_name}`)}
          >
            <div className="relative group">
               <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute inset-0 bg-gradient-to-r from-amber-300 to-indigo-400 rounded-full blur-2xl opacity-30"
               />
               <div className="relative z-10 transform group-hover:scale-105 transition-transform duration-500">
                 <BintangAvatar
                  state={avatarState}
                  size="xl"
                  animate={isDeafMode ? { scale: [1, 1.03, 1], rotate: [0, 3, -3, 0] } : {}}
                  transition={isDeafMode ? { repeat: Infinity, duration: 3 } : {}}
                 />
               </div>
               <motion.div
                animate={{ rotate: 360, y: [0, -5, 0] }}
                transition={{ rotate: { duration: 20, repeat: Infinity, ease: "linear" }, y: { duration: 2, repeat: Infinity } }}
                className="absolute -top-4 -right-2 text-4xl drop-shadow-[0_4px_10px_rgba(245,158,11,0.4)]"
               >
                 ⭐
               </motion.div>
            </div>
            <div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 mb-3"
              >
                <span className="h-[1px] w-8 bg-indigo-500/30"></span>
                <p className="text-indigo-600 font-bold text-xs uppercase tracking-[0.2em]">
                  {greeting}
                </p>
              </motion.div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tight text-slate-800 leading-[1.1]">
                Halo, <span className="bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent">{profile?.full_name?.split(' ')[0]}!</span><br/>
                <span className="text-indigo-600">Siap Belajar?</span>
              </h1>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden md:flex items-center gap-4 bg-white p-2 rounded-[2rem] shadow-xl shadow-indigo-500/5 border border-white"
            onMouseEnter={() => handleHover(`XP kamu saat ini adalah ${profile?.xp || 0}`)}
          >
             <div className="flex items-center gap-4 pr-6 pl-2">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-slate-200">
                  {profile?.full_name?.[0] || 'B'}
                </div>
                <div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Poin Kamu</p>
                   <p className="text-2xl font-black text-slate-800 flex items-center gap-2">
                      <span className="text-amber-500 drop-shadow-sm">⭐</span> {profile?.xp || 0}
                   </p>
                </div>
             </div>
          </motion.div>
        </header>

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-12">

            {/* XP PROGRESS BAR */}
            <section
              className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group"
              onMouseEnter={() => handleHover(`Level kamu ${currentLevel}. Kamu butuh ${1000 - currentXPProgress} XP lagi untuk naik level.`)}
            >
               <div className="flex justify-between items-end mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-2xl shadow-inner group-hover:rotate-12 transition-transform">
                      🏅
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-slate-800 tracking-tight">Level {currentLevel}</h3>
                       <p className="text-sm font-medium text-slate-400">
                         Kurang <span className="text-indigo-600 font-bold">{1000 - currentXPProgress} XP</span> lagi untuk naik level!
                       </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-300 uppercase tracking-tighter block">Progress</span>
                    <span className="text-3xl font-black text-indigo-600/20 group-hover:text-indigo-600/40 transition-colors tracking-tighter">
                        {Math.round(progressPercentage)}%
                    </span>
                  </div>
               </div>

               <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner">
                  <motion.div
                    key={profile?.xp}
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 via-orange-400 to-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                  >
                    <div className="absolute top-0 left-0 right-0 h-[40%] bg-white/20 rounded-full" />
                  </motion.div>
               </div>
            </section>

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Jelajah Materi', icon: '📖', desc: 'Belajar materi interaktif', path: '/student/modules', color: 'indigo', border: 'hover:border-indigo-200' },
                { label: 'QuizKu', icon: '🎯', desc: 'Uji pemahamanmu', path: '/student/tasks', color: 'rose', border: 'hover:border-rose-200' },
                { label: 'BintangAi', icon: '🤖', desc: 'Asisten belajarmu', path: '/student/playground', color: 'violet', border: 'hover:border-violet-200' },
                { label: 'Kolaborasi', icon: '🏰', desc: 'Belajar bersama teman', path: '/student/collaboration', color: 'amber', border: 'hover:border-amber-200' },
              ].map((item, i) => (
                <motion.button
                  key={i}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.5 }}
                  onClick={() => navigate(item.path)}
                  onMouseEnter={() => handleHover(`Menu ${item.label}. ${item.desc}`)}
                  className={`group relative bg-white p-1 rounded-[2rem] border border-slate-100 shadow-sm transition-all duration-300 ${item.border}`}
                >
                  <div className="p-7 flex items-start gap-5">
                    <div className={`w-16 h-16 shrink-0 rounded-[1.2rem] bg-${item.color}-50 text-${item.color}-500 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                      {item.icon}
                    </div>
                    <div className="text-left pt-1">
                      <h3 className="font-black text-slate-800 text-lg mb-1">{item.label}</h3>
                      <p className="text-slate-400 text-xs font-semibold leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* MISSION BANNER */}
            <motion.section
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-10 shadow-2xl shadow-indigo-900/20"
              onMouseEnter={() => handleHover(`Misi Inspirasi: Kamu itu bintang paling terang hari ini. Ayo pancarkan sinarmu dengan menyelesaikan satu materi lagi!`)}
            >
               <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                  <div className="w-28 h-28 shrink-0 bg-white/5 rounded-3xl backdrop-blur-md flex items-center justify-center border border-white/10 shadow-2xl">
                     <BintangAvatar state="happy" size="md" />
                  </div>
                  <div className="text-center md:text-left flex-1">
                     <p className="text-amber-400 font-black text-xs uppercase tracking-[0.3em] mb-4">
                       ✨ Misi Inspirasi
                     </p>
                     <p className="text-white text-xl md:text-2xl font-medium leading-relaxed italic opacity-90">
                       "Hai {profile?.full_name?.split(' ')[0]}! Kamu itu bintang paling terang hari ini. Ayo pancarkan sinarmu dengan menyelesaikan satu materi lagi!"
                     </p>
                  </div>
               </div>
               <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[80px]" />
            </motion.section>
          </div>

          <div className="lg:col-span-4 space-y-10">
            {/* LEADERBOARD (REALTIME) */}
            <section
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8"
              onMouseEnter={() => handleHover(`Peringkat kelas. Kamu bisa melihat siapa saja bintang kelas saat ini.`)}
            >
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Peringkat Kelas</h3>
                    <p className="text-xs font-bold text-slate-400 tracking-wide mt-1">
                      {profile.class_code ? `Kode: ${profile.class_code}` : 'Global'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl animate-bounce">🏆</div>
               </div>

               <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {leaderboard === null ? (
                    <div className="py-8 text-center text-slate-400 text-sm font-medium animate-pulse">Memuat peringkat...</div>
                  ) : leaderboard.length > 0 ? (
                    leaderboard.map((user, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        key={user.id}
                        onMouseEnter={() => handleHover(`Peringkat ${i+1}, ${user.full_name?.split(' ')[0]}, ${user.xp || 0} XP`)}
                        className={`flex items-center justify-between p-4 rounded-2xl transition-all ${user.id === profile?.id ? 'bg-indigo-50 border-2 border-indigo-200 shadow-md scale-[1.02]' : 'hover:bg-slate-50 border border-transparent'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                            i === 0 ? 'bg-amber-400 text-white' :
                            i === 1 ? 'bg-slate-300 text-white' :
                            i === 2 ? 'bg-orange-300 text-white' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {i + 1}
                          </div>
                          <span className={`text-sm font-bold truncate max-w-[100px] ${user.id === profile?.id ? 'text-indigo-600' : 'text-slate-700'}`}>
                            {user.full_name ? user.full_name.split(' ')[0] : 'Siswa'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                           <span className="text-sm font-black text-slate-800">{user.xp || 0}</span>
                           <span className="text-[10px] font-bold text-slate-400">XP</span>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                       <p className="text-sm font-black text-slate-400">Belum ada data peringkat</p>
                    </div>
                  )}
               </div>
            </section>

            {/* ACTIVE TASKS */}
            <section
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8"
              onMouseEnter={() => handleHover(`Daftar kuis aktif. Ada ${tasks?.length || 0} kuis yang harus diselesaikan.`)}
            >
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-lg font-black text-slate-800">QuizKu Aktif</h3>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
               </div>

               <div className="space-y-4">
                 {loading || tasks === null ? (
                    [1, 2].map(i => <div key={i} className="h-24 bg-slate-50 rounded-[1.5rem] animate-pulse" />)
                 ) : tasks.length > 0 ? (
                    tasks.map((task, i) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => navigate(`/student/task/${task.id}`)}
                        onMouseEnter={() => handleHover(`Kuis: ${task.title}. Klik untuk mengerjakan.`)}
                        className="group p-5 bg-slate-50 hover:bg-white rounded-2xl border border-transparent hover:border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            🎯
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">{task.title}</h4>
                            <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                               Deadline: {new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                 ) : (
                    <div className="py-12 text-center bg-emerald-50/30 rounded-3xl border border-dashed border-emerald-200">
                       <p className="text-sm font-black text-emerald-800">Semua tugas beres! 🏆</p>
                    </div>
                 )}
               </div>
               <Link
                to="/student/tasks"
                className="block w-full text-center mt-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all"
                onMouseEnter={() => handleHover(`Tombol lihat semua kuis.`)}
               >
                  Lihat Semua
               </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
