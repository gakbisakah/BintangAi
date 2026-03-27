import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import BintangAvatar from '../../components/BintangAvatar';
import ConfettiEffect from '../../components/ConfettiEffect';

const StudentTaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, fetchProfile } = useAuthStore();
  const { askTutor } = useAI();

  const [task, setTask] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionRecord, setSubmissionRecord] = useState(null);
  const [avatarState, setAvatarState] = useState('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) fetchTaskData();
  }, [id]);

  useEffect(() => {
    let timer;
    if (started && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && started) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [started, timeLeft]);

  useEffect(() => {
    if (submitting) setAvatarState('thinking');
    else setAvatarState('idle');
  }, [submitting]);

  const fetchTaskData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Task Info
      const { data: taskData, error: taskError } = await supabase
        .from('assignments')
        .select('*, modules(title)')
        .eq('id', id)
        .maybeSingle();

      if (taskError) throw taskError;
      if (!taskData) {
        setError("Kuis tidak ditemukan.");
        setLoading(false);
        return;
      }

      setTask(taskData);
      if (taskData.duration_minutes) {
        setTimeLeft(taskData.duration_minutes * 60);
      } else {
        setTimeLeft(30 * 60); // Default 30 minutes
      }

      // 2. Fetch Questions
      const { data: qs, error: qsError } = await supabase
        .from('assignment_questions')
        .select('*, assignment_question_options(*)')
        .eq('assignment_id', id)
        .order('order_index', { ascending: true });

      if (qsError) throw qsError;
      setQuestions(qs || []);

      // 3. Check Existing Submission (Submitted or Graded)
      const { data: existingSub } = await supabase
        .from('submissions')
        .select('*, submission_answers(*)')
        .eq('assignment_id', id)
        .eq('student_id', profile?.id)
        .maybeSingle();

      if (existingSub) {
        setSubmissionRecord(existingSub);
      }
    } catch (err) {
      console.error("Error fetching task detail:", err);
      setError("Gagal memuat data kuis.");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (questions.length === 0) {
      alert("Maaf, kuis ini belum memiliki soal. Silakan hubungi gurumu.");
      return;
    }

    // Proteksi Tambahan: Jangan biarkan mulai jika sudah ada record dan tidak diizinkan remidi
    if (submissionRecord && !submissionRecord.allow_retake && (submissionRecord.status === 'submitted' || submissionRecord.status === 'graded')) {
      alert("Anda sudah menyelesaikan misi ini.");
      return;
    }

    setStarted(true);
    setCurrentStep(1);
    setAvatarState('happy');
  };

  const handleAnswerChange = (qId, value) => {
    setAnswers({ ...answers, [qId]: { ...answers[qId], ...value } });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setAvatarState('thinking');
    try {
      let totalScore = 0;
      const questionResults = [];

      for (let q of questions) {
        const ans = answers[q.id] || {};
        let isCorrect = false;
        let pointsEarned = 0;
        const questionPoints = Number(q.points) > 0 ? Number(q.points) : (q.question_type === 'pilihan_ganda' ? 10 : 20);

        if (q.question_type === 'pilihan_ganda') {
          const correctOpt = q.assignment_question_options?.find(o => o.is_correct);
          isCorrect = ans.selected_option_id === correctOpt?.id;
          pointsEarned = isCorrect ? questionPoints : 0;
        } else {
          isCorrect = !!ans.answer_text?.trim();
          pointsEarned = isCorrect ? questionPoints : 0;
        }

        totalScore += pointsEarned;
        questionResults.push({
          question_id: q.id,
          answer_text: ans.answer_text || null,
          selected_option_id: ans.selected_option_id || null,
          is_correct: isCorrect,
          points_earned: pointsEarned
        });
      }

      let sub;
      // FIX: Gunakan UPDATE jika record sudah ada (ongoing atau remidi)
      if (submissionRecord) {
        const { data: updatedSub, error: updateErr } = await supabase.from('submissions').update({
            status: 'graded',
            total_score: totalScore,
            submitted_at: new Date().toISOString(),
            allow_retake: false,
            attempt_number: (submissionRecord.attempt_number || 1) + (submissionRecord.allow_retake ? 1 : 0)
        }).eq('id', submissionRecord.id).select().single();

        if (updateErr) throw updateErr;
        sub = updatedSub;

        // Bersihkan jawaban lama jika remidi
        await supabase.from('submission_answers').delete().eq('submission_id', sub.id);
      } else {
        // First time insertion
        const { data: newSub, error: subErr } = await supabase.from('submissions').insert({
          assignment_id: id,
          student_id: profile.id,
          status: 'graded',
          total_score: totalScore,
          submitted_at: new Date().toISOString()
        }).select().single();

        if (subErr) throw subErr;
        sub = newSub;
      }

      await supabase.from('submission_answers').insert(questionResults.map(res => ({ ...res, submission_id: sub.id })));

      if (totalScore > 0) {
        await supabase.rpc('add_bonus_xp', { target_student_id: profile.id, amount: totalScore });
        await fetchProfile(profile.id);
      }

      setShowConfetti(true);
      setAvatarState('happy');
      setSubmissionRecord({ ...sub });
      setStarted(false);
    } catch (err) {
      console.error(err);
      alert("Gagal mengirim jawaban: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Tampilkan kartu "Misi Berhasil" jika sudah mengerjakan dan tidak ada izin remidi
  if (submissionRecord && !submissionRecord.allow_retake && (submissionRecord.status === 'submitted' || submissionRecord.status === 'graded')) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <ConfettiEffect active={showConfetti} />
        <div className="mb-8">
           <BintangAvatar state="happy" size="md" />
        </div>
        <h2 className="text-4xl font-black text-slate-900 mt-4 mb-4 uppercase tracking-tighter leading-tight">Misi Selesai! ✨</h2>
        <p className="text-slate-500 font-bold mb-8 uppercase text-xs tracking-widest max-w-sm">Kamu sudah pernah menyelesaikan <br/> <span className="text-indigo-600">"{task?.title}"</span></p>

        <div className="bg-white p-12 rounded-[4rem] shadow-2xl shadow-indigo-100/50 border border-indigo-50 mb-10 flex flex-col items-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-indigo-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Skor Tertinggi Kamu</span>
            <p className="text-8xl font-black text-slate-900 tabular-nums">{submissionRecord.total_score || 0}</p>
            <div className="mt-4 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                LULUS
            </div>
        </div>

        {/* Notifikasi Remidi Sesuai Request */}
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border-2 border-dashed border-amber-200 p-8 rounded-[2.5rem] mb-12 max-w-md relative"
        >
            <div className="absolute -top-4 -right-4 text-3xl">💡</div>
            <p className="text-amber-800 text-sm font-bold leading-relaxed">
               BintangAi mencatat kamu sudah mengerjakan ini. Kamu bisa mengerjakan lagi (Remidi) setelah diberikan izin oleh Bapak/Ibu Gurumu!
            </p>
        </motion.div>

        <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => navigate('/student/tasks')} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-600 transition-all active:scale-95">
                Ke Daftar Misi
            </button>
            <button onClick={() => navigate('/student/dashboard')} className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors">
                Kembali ke Beranda
            </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
      <BintangAvatar state="thinking" size="md" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Menyiapkan Misi...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
      <BintangAvatar state="sad" size="md" />
      <h2 className="text-2xl font-black text-slate-900 mt-8 mb-4">{error}</h2>
      <button onClick={() => navigate('/student/tasks')} className="px-12 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest">Kembali</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-6 sticky top-0 z-50 flex justify-between items-center">
        <button onClick={() => navigate('/student/tasks')} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm hover:bg-white transition-all">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        </button>
        <div className="text-center">
          <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">{task?.modules?.title || 'Kuis Mandiri'}</h1>
          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{task?.title}</p>
        </div>
        <div className="flex items-center gap-4">
          {started && (
            <div className={`px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-indigo-100 ${timeLeft < 300 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
              ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}
          <BintangAvatar state={avatarState} size="xs" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!started ? (
            <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <div className="bg-white p-12 md:p-20 rounded-[4rem] shadow-sm border border-slate-100 mb-12 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <span className="text-9xl">🚀</span>
                  </div>
                  <BintangAvatar state="happy" size="md" className="mx-auto mb-8" />
                  <h2 className="text-5xl font-black text-slate-900 uppercase mb-6 tracking-tighter leading-none">{task?.title}</h2>
                  <p className="text-xl text-slate-500 font-bold mb-10 max-w-2xl mx-auto leading-relaxed">{task?.description || 'Siapkan dirimu untuk petualangan ilmu pengetahuan yang seru! Kumpulkan XP sebanyak-banyaknya.'}</p>

                  <div className="flex flex-wrap justify-center gap-6">
                    <div className="px-6 py-4 bg-indigo-50 rounded-3xl border border-indigo-100">
                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Durasi</p>
                      <p className="text-lg font-black text-indigo-600 uppercase">{task?.duration_minutes || 30} Menit</p>
                    </div>
                    <div className="px-6 py-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Jumlah Soal</p>
                      <p className="text-lg font-black text-emerald-600 uppercase">{questions.length} Soal</p>
                    </div>
                    <div className="px-6 py-4 bg-amber-50 rounded-3xl border border-amber-100">
                      <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-1">Potensi XP</p>
                      <p className="text-lg font-black text-amber-600 uppercase">+{questions.reduce((acc, q) => acc + (q.points || 10), 0)} XP</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleStart}
                  className="group relative px-20 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl shadow-2xl shadow-indigo-200 uppercase tracking-widest hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
                >
                  <span className="relative z-10">{submissionRecord?.allow_retake ? 'Mulai Remidi 🚀' : 'Mulai Petualangan 🚀'}</span>
                  <div className="absolute inset-0 bg-white/20 rounded-[2.5rem] scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </button>
            </motion.div>
          ) : (
            <motion.div key="questions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
               {questions.map((q, idx) => idx + 1 === currentStep && (
                 <div key={q.id} className="space-y-8">
                    <div className="bg-white p-8 md:p-16 rounded-[4rem] shadow-sm border border-slate-100 relative min-h-[500px] flex flex-col justify-center">
                       <div className="absolute top-12 left-12 right-12 flex justify-between items-center">
                         <div className="flex items-center gap-4">
                           <span className="px-5 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100">Tantangan {idx + 1} / {questions.length}</span>
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{q.points || 10} XP</span>
                         </div>
                         <div className="flex gap-1">
                            {questions.map((_, i) => (
                              <div key={i} className={`w-8 h-1.5 rounded-full transition-all ${i + 1 <= currentStep ? 'bg-indigo-500' : 'bg-slate-100'}`} />
                            ))}
                         </div>
                       </div>

                       <div className="mt-12">
                          <h3 className="text-4xl font-black text-slate-900 leading-tight mb-16 uppercase tracking-tighter">{q.question_text}</h3>

                          {q.question_type === 'pilihan_ganda' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {q.assignment_question_options?.map((opt, oi) => (
                                  <button
                                    key={opt.id}
                                    onClick={() => handleAnswerChange(q.id, { selected_option_id: opt.id })}
                                    className={`group p-6 rounded-[2.5rem] border-2 text-left flex items-center gap-6 transition-all relative overflow-hidden ${answers[q.id]?.selected_option_id === opt.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-[1.02]' : 'bg-white border-slate-50 text-slate-600 hover:border-indigo-100'}`}
                                  >
                                    <span className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 ${answers[q.id]?.selected_option_id === opt.id ? 'bg-white text-indigo-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-400'}`}>
                                      {String.fromCharCode(65 + oi)}
                                    </span>
                                    <span className="font-black text-lg uppercase leading-tight">{opt.option_text}</span>
                                    {answers[q.id]?.selected_option_id === opt.id && (
                                      <div className="absolute top-0 right-0 p-4">
                                        <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                                      </div>
                                    )}
                                  </button>
                                ))}
                            </div>
                          ) : (
                            <div className="space-y-4">
                                <textarea
                                    value={answers[q.id]?.answer_text || ''}
                                    onChange={(e) => handleAnswerChange(q.id, { answer_text: e.target.value })}
                                    placeholder="Ketik jawabanmu di sini..."
                                    className="w-full h-80 p-10 bg-slate-50 border-2 border-slate-100 rounded-[3.5rem] font-black text-2xl outline-none resize-none uppercase focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-200"
                                />
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center mt-4 italic">Bintang AI akan menilai jawaban esaimu dengan adil ✨</p>
                            </div>
                          )}
                       </div>
                    </div>

                    <div className="flex justify-between items-center px-8">
                       <button
                        disabled={currentStep === 1}
                        onClick={() => setCurrentStep(prev => prev - 1)}
                        className="group flex items-center gap-3 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] disabled:opacity-30 hover:text-indigo-600 transition-colors"
                       >
                         <span className="group-hover:-translate-x-1 transition-transform">←</span> Kembali
                       </button>

                       <div className="flex items-center gap-4">
                          {currentStep === questions.length ? (
                            <button
                              onClick={handleSubmit}
                              disabled={submitting}
                              className="px-16 py-6 bg-emerald-500 text-white rounded-[2.5rem] font-black text-sm uppercase shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                            >
                              {submitting ? 'Mengirim...' : 'Selesaikan Misi 🚀'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setCurrentStep(prev => prev + 1)}
                              className="px-16 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-sm uppercase shadow-2xl hover:bg-indigo-600 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                            >
                              Lanjut <span className="text-xl">→</span>
                            </button>
                          )}
                       </div>
                    </div>
                 </div>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Help Button */}
      {started && (
        <button
          onClick={() => alert("Bintang AI: Fokus ya! Kamu pasti bisa menjawabnya. Baca soal pelan-pelan.")}
          className="fixed bottom-8 right-8 w-16 h-16 bg-white border border-slate-100 rounded-full shadow-2xl flex items-center justify-center text-2xl hover:scale-110 transition-transform active:scale-90 z-[60]"
        >
          💡
        </button>
      )}
    </div>
  );
};

export default StudentTaskDetail;