import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import BintangAvatar from '../../components/BintangAvatar';
import ConfettiEffect from '../../components/ConfettiEffect';
import { useVoice } from '../../hooks/useVoice';
import { useGlobalVoiceNav } from '../../hooks/useGlobalVoiceNav';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';

const StudentTaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, fetchProfile } = useAuthStore();
  const { speak } = useVoice();
  const { showSubtitle } = useSubtitle();

  const [task, setTask] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [initialDuration, setInitialDuration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submissionRecord, setSubmissionRecord] = useState(null);
  const [submissionDetails, setSubmissionDetails] = useState([]);
  const [avatarState, setAvatarState] = useState('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState(null);
  const hasAnnouncedQuestion = useRef(false);

  const isBlind = profile?.disability_type === 'tunanetra';
  const isDeaf = profile?.disability_type === 'tunarungu';

  const handleVoiceCommand = useCallback((t) => {
    if (!started) {
        if (t.includes('mulai')) { handleStart(); return 'start'; }
    } else {
        const q = questions[currentStep - 1];
        if (!q) return;
        if (t.includes('pilih a')) { handleAnswerChoice(0); return 'a'; }
        if (t.includes('pilih b')) { handleAnswerChoice(1); return 'b'; }
        if (t.includes('lanjut')) { handleNext(); return 'next'; }
    }
  }, [started, questions, currentStep]);

  useGlobalVoiceNav({ enabled: isBlind, onCommand: handleVoiceCommand });

  useEffect(() => { if (id) fetchTaskData(); }, [id]);

  useEffect(() => {
    let timer;
    if (started && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
            if (prev === 11 && isDeaf) showSubtitle("Waktu hampir habis!", "warning");
            return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0 && started) { handleSubmit(); }
    return () => clearInterval(timer);
  }, [started, timeLeft]);

  const fetchTaskData = async () => {
    setLoading(true);
    try {
      const { data: taskData } = await supabase.from('assignments').select('*, modules(title)').eq('id', id).maybeSingle();
      if (!taskData) return;
      setTask(taskData);
      const duration = taskData.duration_minutes * 60 || 1800;
      setTimeLeft(duration);
      setInitialDuration(duration);
      const { data: qs } = await supabase.from('assignment_questions').select('*, assignment_question_options(*)').eq('assignment_id', id).order('order_index', { ascending: true });
      setQuestions(qs || []);
      const { data: existingSub } = await supabase.from('submissions').select('*').eq('assignment_id', id).eq('student_id', profile?.id).maybeSingle();
      if (existingSub) {
        setSubmissionRecord(existingSub);
        const { data: ansDetails } = await supabase.from('submission_answers').select('*, assignment_questions(question_text, assignment_question_options(*))').eq('submission_id', existingSub.id);
        setSubmissionDetails(ansDetails || []);
      }
    } catch (err) {} finally { setLoading(false); }
  };

  const handleStart = () => {
    if (questions.length === 0) return;
    setStarted(true);
    setCurrentStep(1);
    hasAnnouncedQuestion.current = false;
  };

  const handleAnswerChoice = (index) => {
    const q = questions[currentStep - 1];
    const opt = q.assignment_question_options[index];
    if (!opt) return;
    setAnswers({ ...answers, [q.id]: { selected_option_id: opt.id } });

    // Feedback visual cepat untuk tunarungu
    if (isDeaf) showSubtitle(`Memilih: ${String.fromCharCode(65 + index)}`, 'info');

    setTimeout(handleNext, 1200);
  };

  const handleNext = () => {
    if (currentStep < questions.length) {
        setCurrentStep(prev => prev + 1);
        hasAnnouncedQuestion.current = false;
    } else {
        handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let totalScore = 0;
      let correctCount = 0;
      const wrongQuestions = [];

      const questionResults = questions.map(q => {
        const ans = answers[q.id] || {};
        const correctOpt = q.assignment_question_options?.find(o => o.is_correct);
        const isCorrect = ans.selected_option_id === correctOpt?.id;
        if (isCorrect) {
          totalScore += (q.points || 10);
          correctCount += 1;
        } else {
          // Kumpulkan soal yang salah untuk analisis kelemahan
          wrongQuestions.push({
            question: q.question_text,
            answer: q.assignment_question_options?.find(o => o.id === ans.selected_option_id)?.option_text || ""
          });
        }
        return { question_id: q.id, selected_option_id: ans.selected_option_id, is_correct: isCorrect };
      });

      // 1. HITUNG XP REALTIME
      const xpGained = correctCount * 20;
      const { data: currentProfile } = await supabase.from('profiles').select('xp, weak_topics').eq('id', profile.id).single();
      const currentXP = currentProfile?.xp || 0;
      const existingWeakTopics = currentProfile?.weak_topics || [];

      // 2. ANALISIS KELEMAHAN (AI WEAK TOPIC DETECTION)
      // Kita panggil Edge Function untuk mendeteksi topik dari soal-soal yang salah
      if (wrongQuestions.length > 0) {
        try {
          // Gabungkan teks soal yang salah untuk deteksi topik
          const wrongText = wrongQuestions.map(wq => `${wq.question} ${wq.answer}`).join(" ");

          const { data: detectResult } = await supabase.functions.invoke('weak-topics', {
            body: { action: "detect", question: wrongText, answer: "" },
            headers: { 'x-api-key': 'christian' }
          });

          if (detectResult?.topics && detectResult.topics.length > 0) {
            // Gabungkan dengan topik lemah yang sudah ada (Set untuk unik)
            const newWeakTopics = Array.from(new Set([...existingWeakTopics, ...detectResult.topics]));

            // Simpan ke database
            await supabase.from('profiles').update({ weak_topics: newWeakTopics }).eq('id', profile.id);
          }
        } catch (detectErr) {
          console.error("Gagal deteksi topik lemah:", detectErr);
        }
      }

      // 3. Simpan Submission
      const { data: sub, error: subError } = await supabase.from('submissions').insert({
        assignment_id: id,
        student_id: profile.id,
        status: 'graded',
        total_score: totalScore,
        submitted_at: new Date().toISOString(),
        started_at: new Date(Date.now() - (initialDuration - timeLeft) * 1000).toISOString()
      }).select().single();

      if (subError) throw subError;

      // 4. Simpan Detail Jawaban
      await supabase.from('submission_answers').insert(questionResults.map(res => ({ ...res, submission_id: sub.id })));

      // 5. UPDATE XP SECARA MANUAL
      await supabase.from('profiles').update({ xp: currentXP + xpGained }).eq('id', profile.id);

      // 6. Masukkan ke log XP
      if (xpGained > 0) {
        await supabase.from('xp_logs').insert({
           student_id: profile.id,
           action: `Selesai Quiz: ${task?.title}`,
           xp_gained: xpGained
        });
      }

      // 7. Refresh state lokal agar Dashboard & Peta Kelemahan terupdate
      await fetchProfile(profile.id);

      setShowConfetti(true);
      setSubmissionRecord(sub);

      const { data: ansDetails } = await supabase.from('submission_answers').select('*, assignment_questions(question_text, assignment_question_options(*))').eq('submission_id', sub.id);
      setSubmissionDetails(ansDetails || []);

      setStarted(false);
    } catch (err) {
      console.error("Gagal mengirim quiz:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} menit ${s} detik`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-slate-400">Memuat...</div>;

  if (submissionRecord) {
    const timeSpent = submissionRecord.submitted_at ?
      Math.floor((new Date(submissionRecord.submitted_at) - new Date(submissionRecord.started_at)) / 1000) : 0;

    return (
      <div className="min-h-screen bg-white flex flex-col items-center p-6 pt-12 overflow-y-auto pb-32">
        <ConfettiEffect active={showConfetti} />
        <span className="text-8xl mb-4">🏆</span>
        <h2 className="font-black text-slate-900 text-4xl mb-2 uppercase text-center">Hasil Quiz</h2>
        <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-center">{task?.title}</p>

        <div className="w-full max-w-2xl bg-indigo-50 rounded-[3rem] p-10 border-4 border-indigo-100 mb-12 text-center relative overflow-hidden shadow-xl">
          <div className="relative z-10">
            <p className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-1">Skor Akhir</p>
            <p className="text-9xl font-black text-indigo-600 mb-6">{submissionRecord.total_score}</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-white p-4 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                  <p className="font-black text-indigo-600 uppercase text-sm">{submissionRecord.status}</p>
               </div>
               <div className="bg-white p-4 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Durasi Kerja</p>
                  <p className="font-black text-indigo-600 text-sm">{formatTime(timeSpent)}</p>
               </div>
            </div>
            <p className="text-slate-600 font-black uppercase text-sm bg-white/50 py-3 rounded-2xl border border-indigo-100/50">
              ❓ {questions.length} Total Soal
            </p>
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-6 mb-16">
           <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight border-l-8 border-indigo-600 pl-4 mb-8">Analisis Soal</h3>
           {submissionDetails.map((detail, idx) => {
              const qText = detail.assignment_questions?.question_text;
              const options = detail.assignment_questions?.assignment_question_options || [];
              const selectedOpt = options.find(o => o.id === detail.selected_option_id);
              const correctOpt = options.find(o => o.is_correct);

              return (
                <div key={detail.id} className={`p-8 rounded-[2.5rem] border-4 ${detail.is_correct ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                   <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black uppercase text-slate-400">Soal {idx + 1}</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${detail.is_correct ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>
                         {detail.is_correct ? 'Benar ✅' : 'Salah ❌'}
                      </span>
                   </div>
                   <p className="font-black text-slate-800 text-lg mb-6 leading-tight">{qText}</p>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-2xl ${detail.is_correct ? 'bg-emerald-100/50' : 'bg-rose-100/50'}`}>
                         <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Jawaban Kamu</p>
                         <p className={`font-black ${detail.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>{selectedOpt?.option_text || '-'}</p>
                      </div>
                      {!detail.is_correct && (
                        <div className="p-4 bg-emerald-100/50 rounded-2xl">
                           <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Jawaban Benar</p>
                           <p className="font-black text-emerald-700">{correctOpt?.option_text}</p>
                        </div>
                      )}
                   </div>
                </div>
              );
           })}
        </div>

        <button
          onClick={() => navigate('/student/tasks')}
          className="w-full max-w-xs bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl uppercase tracking-widest hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all mb-10"
        >
          Selesai & Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans relative">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-6 sticky top-0 z-50 flex justify-between items-center">
        <button onClick={() => navigate(-1)} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        </button>
        <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{task?.title}</p>
            {started && <p className={`text-sm font-black ${timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-slate-900'}`}>⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>}
        </div>
        <BintangAvatar state={avatarState} size="xs" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {!started ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <div className="bg-white p-12 md:p-20 rounded-[4rem] shadow-sm border border-slate-100 mb-12">
                  <h2 className="text-5xl font-black text-slate-900 uppercase mb-6 tracking-tighter">{task?.title}</h2>
                  <p className="text-xl text-slate-500 font-bold mb-10">{task?.description || 'Siapkan dirimu!'}</p>
                  <button onClick={handleStart} data-gesture-item="true" className="px-20 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">Mulai 🚀</button>
                </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
               {questions.map((q, idx) => idx + 1 === currentStep && (
                 <div key={q.id} className="space-y-8">
                    <div className="bg-white p-8 md:p-16 rounded-[4rem] shadow-sm border border-slate-100 relative min-h-[400px]">
                       <span className="absolute top-8 left-8 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase">Soal {idx + 1} / {questions.length}</span>
                       <h3 className="text-3xl font-black text-slate-800 mt-10 mb-12">{q.question_text}</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.assignment_question_options?.map((opt, oi) => (
                                <button
                                    key={opt.id}
                                    data-gesture-item="true"
                                    onClick={() => handleAnswerChoice(oi)}
                                    className={`p-6 rounded-[2rem] border-2 text-left flex items-center gap-4 transition-all ${answers[q.id]?.selected_option_id === opt.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                                >
                                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-black ${answers[q.id]?.selected_option_id === opt.id ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {String.fromCharCode(65 + oi)}
                                    </span>
                                    <span className="font-bold">{opt.option_text}</span>
                                </button>
                            ))}
                       </div>
                    </div>
                    {/* TOMBOL KONTROL DI BAWAH SOAL */}
                    <div className="flex justify-center">
                        {isDeaf ? (
                          <button
                            onClick={handleNext}
                            data-gesture-item="true"
                            className="px-12 py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-sm border-b-4 border-indigo-800 hover:bg-indigo-700 transition-all shadow-lg active:translate-y-1"
                          >
                            {currentStep === questions.length ? "Selesaikan Quiz & Kirim 🏁" : "Lanjut ke Soal Berikutnya ➡️"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setStarted(false)}
                            data-gesture-item="true"
                            className="px-10 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase text-xs border-2 border-rose-100 hover:bg-rose-100 transition-all"
                          >
                            ⬅️ Kembali
                          </button>
                        )}
                    </div>
                 </div>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default StudentTaskDetail;
