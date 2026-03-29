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
        const { data: ansDetails } = await supabase.from('submission_answers').select('*, assignment_questions(question_text, ai_explanation, ai_feedback_wrong, assignment_question_options(*))').eq('submission_id', existingSub.id);
        setSubmissionDetails(ansDetails || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
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
          wrongQuestions.push({
            question: q.question_text,
            answer: q.assignment_question_options?.find(o => o.id === ans.selected_option_id)?.option_text || ""
          });
        }
        return { question_id: q.id, selected_option_id: ans.selected_option_id, is_correct: isCorrect };
      });

      const xpGained = correctCount * 20;

      const { data: sub, error: subError } = await supabase.from('submissions').insert({
        assignment_id: id,
        student_id: profile.id,
        status: 'graded',
        total_score: totalScore,
        submitted_at: new Date().toISOString(),
        started_at: new Date(Date.now() - (initialDuration - timeLeft) * 1000).toISOString()
      }).select().single();

      if (subError) throw subError;

      await supabase.from('submission_answers').insert(questionResults.map(res => ({ ...res, submission_id: sub.id })));

      await supabase.rpc('add_xp', { amount: xpGained });

      if (wrongQuestions.length > 0) {
        const wrongText = wrongQuestions.slice(0, 3).map(wq => wq.question).join(". ");
        const { data: detectResult } = await supabase.functions.invoke('weak-topics', {
          body: { action: "detect", question: wrongText, answer: "" },
          headers: { 'x-api-key': 'christian' }
        });

        if (detectResult?.topics?.length > 0) {
          await supabase.functions.invoke('weak-topics', {
            body: { action: "add", student_id: profile.id, topics: detectResult.topics },
            headers: { 'x-api-key': 'christian' }
          });
        }
      }

      await fetchProfile(profile.id);

      setShowConfetti(true);
      setSubmissionRecord(sub);
      const { data: ansDetails } = await supabase.from('submission_answers').select('*, assignment_questions(question_text, ai_explanation, ai_feedback_wrong, assignment_question_options(*))').eq('submission_id', sub.id);
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

    const correctCount = submissionDetails.filter(d => d.is_correct).length;
    const wrongCount = submissionDetails.length - correctCount;

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-6 pt-12 overflow-y-auto pb-32 font-sans">
        <ConfettiEffect active={showConfetti} />

        <header className="w-full max-w-4xl flex flex-col items-center mb-12">
           <span className="text-8xl mb-6">🏆</span>
           <h2 className="font-black text-slate-900 text-5xl mb-2 uppercase text-center tracking-tighter">Hasil QuizKu</h2>
           <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-center text-sm">{task?.title}</p>
        </header>

        {/* Skor Section */}
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
           <div className="lg:col-span-7 bg-white rounded-[3.5rem] p-12 border border-slate-100 shadow-xl shadow-indigo-100/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full -mr-20 -mt-20 opacity-50" />
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 relative z-10">Skor Akhir Kamu</p>
              <p className="text-[10rem] font-black text-indigo-600 leading-none mb-8 relative z-10">{submissionRecord.total_score}</p>
              <div className="flex gap-3 relative z-10">
                 <span className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest">Lulus: Graded</span>
              </div>
           </div>

           <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center text-3xl font-black">✅</div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jawaban Benar</p>
                    <p className="text-3xl font-black text-slate-900">{correctCount} Soal</p>
                 </div>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
                 <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center text-3xl font-black">❌</div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jawaban Salah</p>
                    <p className="text-3xl font-black text-slate-900">{wrongCount} Soal</p>
                 </div>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Durasi Pengerjaan</p>
                 <p className="text-xl font-bold leading-tight">{formatTime(timeSpent)}</p>
              </div>
           </div>
        </div>

        {/* Detail Per Soal */}
        <div className="w-full max-w-4xl space-y-8 mb-20">
           <div className="flex items-center gap-4 mb-4">
              <div className="w-1 bg-indigo-600 h-8 rounded-full" />
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Analisis Setiap Soal</h3>
           </div>

           {submissionDetails.map((detail, idx) => {
              const q = detail.assignment_questions;
              return (
                <motion.div
                  key={detail.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`p-10 rounded-[3rem] border-2 shadow-sm ${detail.is_correct ? 'bg-white border-emerald-100' : 'bg-white border-rose-100'}`}
                >
                   <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-4">
                         <span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">{idx + 1}</span>
                         <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${detail.is_correct ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {detail.is_correct ? 'Jawaban Benar' : 'Jawaban Salah'}
                         </span>
                      </div>
                      <span className="font-black text-slate-300 text-xs">ID: {idx + 1}</span>
                   </div>

                   <p className="text-xl font-bold text-slate-800 mb-8 leading-relaxed">
                      {q?.question_text}
                   </p>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className={`p-6 rounded-2xl ${detail.is_correct ? 'bg-emerald-50/50' : 'bg-rose-50/50'}`}>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jawaban Kamu</p>
                         <p className={`font-black text-lg ${detail.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {q?.assignment_question_options?.find(o => o.id === detail.selected_option_id)?.option_text || 'Tidak dijawab'}
                         </p>
                      </div>
                      {!detail.is_correct && (
                        <div className="p-6 bg-emerald-50/50 rounded-2xl">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jawaban Benar</p>
                           <p className="font-black text-lg text-emerald-700">
                              {q?.assignment_question_options?.find(o => o.is_correct)?.option_text}
                           </p>
                        </div>
                      )}
                   </div>

                   {/* AI Feedback */}
                   <div className={`p-8 rounded-[2rem] flex gap-6 items-start ${detail.is_correct ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                      <span className="text-3xl">🤖</span>
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Catatan Kak BintangAi</p>
                         <p className="font-bold text-sm leading-relaxed italic">
                            {detail.is_correct ? q?.ai_explanation : q?.ai_feedback_wrong}
                         </p>
                      </div>
                   </div>
                </motion.div>
              );
           })}
        </div>

        <button
          onClick={() => navigate('/student/tasks')}
          className="w-full max-w-xs bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl uppercase tracking-widest hover:scale-105 transition-all active:scale-95 mb-10"
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
                  <button onClick={handleStart} className="px-20 py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">Mulai 🚀</button>
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
                    <div className="flex justify-center">
                        <button onClick={handleNext} className="px-12 py-5 bg-indigo-600 text-white rounded-3xl font-black uppercase text-sm border-b-4 border-indigo-800 hover:bg-indigo-700 transition-all shadow-lg active:translate-y-1">
                          {currentStep === questions.length ? "Selesaikan Quiz 🏁" : "Lanjut ➡️"}
                        </button>
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
