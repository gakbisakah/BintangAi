import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import StudentSidebar from '../../components/StudentSidebar';
import { useVoice } from '../../hooks/useVoice';

const StudentTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [searching, setSearching] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollKey, setEnrollKey] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [error, setError] = useState('');
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const { speak, startListening, stopListening, isListening } = useVoice();

  const isBlind = profile?.disability_type === 'tunanetra';

  useEffect(() => {
    if (profile?.id) {
        fetchTasks();
    }
    if (isBlind) {
      speak("Halaman QuizKu. Kamu bisa melihat daftar kuis yang tersedia atau mencari kuis dengan ID 6 digit.");
    }
  }, [profile]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, modules(title)')
        .eq('is_public', true)
        .order('deadline', { ascending: true });

      if (error) throw error;
      if (data) setTasks(data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchTask = async (providedId) => {
    const idToSearch = providedId || searchId;
    if (!idToSearch || idToSearch.length < 6) return;
    setSearching(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, modules(title)')
        .eq('short_id', idToSearch)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        if (!tasks.find(t => t.id === data.id)) {
           setTasks(prev => [data, ...prev]);
        }
        setSearchId('');
        if (isBlind) speak(`Kuis ditemukan: ${data.title}.`);
        if (data.is_public === false) {
            handleTaskClick(data);
        }
      } else {
        const msg = 'ID Quiz tidak ditemukan. Silakan hubungi Gurumu untuk ID yang benar.';
        setError(msg);
        if (isBlind) speak(msg);
      }
    } catch (err) {
      setError('Gagal mencari QuizKu.');
    } finally {
      setSearching(false);
    }
  };

  const handleTaskClick = async (task) => {
    if (task.is_public === false) {
      const { data: sub } = await supabase
        .from('submissions')
        .select('id')
        .eq('assignment_id', task.id)
        .eq('student_id', profile.id)
        .maybeSingle();

      if (sub) {
        navigate(`/student/task/${task.id}`);
      } else {
        setSelectedTaskId(task.id);
        setShowEnrollModal(true);
        if (isBlind) speak(`Kuis ini terkunci. Silakan masukkan kunci masuk.`);
      }
    } else {
      navigate(`/student/task/${task.id}`);
    }
  };

  const handleEnroll = async (providedKey) => {
    const keyToUse = providedKey || enrollKey;
    setError('');
    const { data: task, error: fetchErr } = await supabase
      .from('assignments')
      .select('enroll_key')
      .eq('id', selectedTaskId)
      .single();

    if (task && task.enroll_key === keyToUse) {
      navigate(`/student/task/${selectedTaskId}`);
    } else {
      const msg = 'Kunci Masuk salah! Tanya Gurumu ya.';
      setError(msg);
      if (isBlind) speak(msg);
    }
  };

  const handleVoiceCommand = (transcript) => {
    const command = transcript.toLowerCase();
    if (command.includes('cari kuis') || command.includes('cari tugas')) {
        speak('Sebutkan 6 digit ID kuis.');
    } else if (command.match(/\d{6}/)) {
        const id = command.match(/\d{6}/)[0];
        handleSearchTask(id);
    } else if (command.includes('buka kuis')) {
        speak('Sebutkan judul kuis yang ingin dibuka.');
    } else if (showEnrollModal && command.includes('kunci')) {
        const key = command.replace('kunci', '').trim();
        handleEnroll(key);
    } else {
        const found = tasks.find(t => command.includes(t.title.toLowerCase()));
        if (found) {
            handleTaskClick(found);
        }
    }
  };

  const toggleMic = () => {
    if (isListening) stopListening();
    else startListening(handleVoiceCommand);
  };

  const handleHover = (text) => {
    if (isBlind) speak(text);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans selection:bg-indigo-100 pb-12">
      <StudentSidebar />

      {isBlind && (
        <button
          onClick={toggleMic}
          className={`fixed top-6 right-6 z-[60] w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl ${isListening ? 'bg-rose-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}

      <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto custom-scrollbar h-screen flex flex-col">
        <div className="flex-1">
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight" onMouseEnter={() => handleHover('Judul Halaman: Eksplorasi QuizKu')}>Eksplorasi QuizKu</h2>
              <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">Cari ID Quiz untuk tantangan rahasia dari Gurumu!</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
               <div className="relative flex-1 sm:w-80" onMouseEnter={() => handleHover('Kotak pencarian ID Kuis 6 digit.')}>
                  <input
                    type="text"
                    value={searchId}
                    onChange={e => setSearchId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Masukkan 6 Digit ID Quiz..."
                    className="w-full pl-6 pr-14 py-4 bg-white border-2 border-indigo-100 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm placeholder:text-slate-300"
                  />
                  <button
                    onClick={() => handleSearchTask()}
                    disabled={searching || searchId.length < 6}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                  >
                    {searching ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    )}
                  </button>
               </div>
               <div className="px-5 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-3 whitespace-nowrap" onMouseEnter={() => handleHover(`${tasks.length} kuis tersedia saat ini.`)}>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tasks.length} Quiz Tersedia</span>
               </div>
            </div>
          </header>

          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border border-rose-100">
                ❌ {error}
            </motion.div>
          )}

          <div className="max-w-5xl space-y-6">
            {loading ? (
              <div className="grid gap-6">
                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-[2.5rem] border border-slate-100 animate-pulse" />)}
              </div>
            ) : tasks.length > 0 ? (
              <div className="grid gap-6">
                <AnimatePresence>
                  {tasks.map((task, idx) => (
                    <motion.div
                      key={task.id}
                      data-gesture-item="true"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ y: -4 }}
                      onClick={() => handleTaskClick(task)}
                      onMouseEnter={() => handleHover(`Kuis: ${task.title}. Materi: ${task.modules?.title || 'Umum'}. Durasi: ${task.duration_minutes || '30'} menit. Batas waktu: ${new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}. Klik untuk mengerjakan.`)}
                      className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer group transition-all duration-300 ${task.is_public ? 'border-slate-50 hover:border-indigo-100' : 'border-amber-200 bg-amber-50 shadow-indigo-100/50'}`}
                    >
                      <div className="flex items-center gap-8">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-3xl group-hover:rotate-6 transition-transform duration-300 ${task.is_public ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                          {task.is_public ? '📚' : '🔒'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{task.title}</h3>
                            {!task.is_public && <span className="px-2 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase rounded shadow-sm">Secret Quiz</span>}
                          </div>
                          <div className="flex flex-wrap gap-4 items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                              {task.modules?.title || 'Umum'}
                            </span>
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                              ⏱️ {task.duration_minutes || '30'} Menit
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-300 mb-1">Batas Misi</p>
                          <p className={`text-sm font-black uppercase ${task.is_public ? 'text-rose-500' : 'text-amber-600'}`}>
                            {new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-all ${task.is_public ? 'bg-slate-900 text-white' : 'bg-amber-600 text-white'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-50 flex flex-col items-center">
                <span className="text-6xl mb-6 opacity-20">🔍</span>
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm max-w-xs mx-auto leading-relaxed">Masukkan 6 Digit ID Quiz dari Gurumu untuk memulai misi rahasia.</p>
              </div>
            )}
          </div>
        </div>

        {/* Enroll Key Modal */}
        <AnimatePresence>
          {showEnrollModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEnrollModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full space-y-8 border-4 border-amber-100">
                  <div className="text-center">
                     <span className="text-5xl block mb-6">🔐</span>
                     <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Misi Terkunci</h3>
                     <p className="text-slate-500 font-bold text-xs mt-3 uppercase tracking-wider">Masukkan Enroll Key untuk membuka akses kuis ini.</p>
                  </div>
                  <div className="space-y-4">
                     {error && <p className="text-rose-500 text-[10px] font-black text-center uppercase animate-bounce">{error}</p>}
                     <input
                       type="text"
                       value={enrollKey}
                       onChange={e => setEnrollKey(e.target.value)}
                       placeholder="Ketik Kunci Masuk..."
                       className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-center text-slate-900 text-lg outline-none focus:border-amber-500 focus:bg-white transition-all placeholder:text-slate-200"
                     />
                  </div>
                  <button
                    onClick={() => handleEnroll()}
                    onMouseEnter={() => handleHover('Tombol buka akses sekarang.')}
                    className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-100 hover:bg-amber-700 transition-all active:scale-95"
                  >
                    Buka Akses Sekarang
                  </button>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        <footer className="mt-24 py-10 border-t border-slate-100 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-80">
            @2026 BintangAi. Dikembangkan khusus untuk Siswa Indonesia.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default StudentTasks;
