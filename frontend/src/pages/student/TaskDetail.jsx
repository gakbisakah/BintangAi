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
import { useGestureControl } from '../../hooks/useGestureControl';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';
import GestureCameraOverlay from '../../components/GestureCameraOverlay';

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
  const [currentStep, setCurrentStep] = useState(0); // 0: Intro, 1+: Questions
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionRecord, setSubmissionRecord] = useState(null);
  const [avatarState, setAvatarState] = useState('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState(null);
  const hasAnnouncedQuestion = useRef(false);

  const isBlind = profile?.disability_type === 'tunanetra';
  const isDeaf = profile?.disability_type === 'tunarungu';
  const isMute = profile?.disability_type === 'tunawicara';

  // ── VOICE COMMANDS ──
  const handleVoiceCommand = useCallback((t) => {
    if (!started) {
        if (t.includes('mulai') || t.includes('lanjut')) {
            handleStart();
            return 'start_quiz';
        }
    } else {
        const q = questions[currentStep - 1];
        if (!q) return;

        // Choose Answer
        if (t.includes('pilih a') || t.includes('jawaban a')) {
            handleAnswerChoice(0);
            return 'choose_a';
        }
        if (t.includes('pilih b') || t.includes('jawaban b')) {
            handleAnswerChoice(1);
            return 'choose_b';
        }
        if (t.includes('pilih c') || t.includes('jawaban c')) {
            handleAnswerChoice(2);
            return 'choose_c';
        }
        if (t.includes('pilih d') || t.includes('jawaban d')) {
            handleAnswerChoice(3);
            return 'choose_d';
        }

        if (t.includes('lanjut') || t.includes('berikutnya')) {
            handleNext();
            return 'next_question';
        }
        if (t.includes('baca soal') || t.includes('ulangi soal')) {
            announceQuestion(currentStep - 1);
            return 'repeat_question';
        }
    }
  }, [started, questions, currentStep]);

  useGlobalVoiceNav({ enabled: isBlind, onCommand: handleVoiceCommand });

  // ── GESTURE COMMANDS ──
  // Perbaikan: Hanya aktifkan kamera jika pengguna adalah Tunawicara (Mute)
  const { videoRef, canvasRef, isActive: camActive, gestureLabel, lastGesture } = useGestureControl({
    enabled: isMute && started,
    onGesture: (gesture, action) => {
        if (action === 'confirm') handleAnswerChoice(0); // Thumb up = A
        if (action === 'next') handleNext(); // Peace = Next
        if (action === 'dont_know') {
            handleNext();
        }
    }
  });

  useEffect(() => {
    if (id) fetchTaskData();
  }, [id]);

  useEffect(() => {
    let timer;
    if (started && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
            if (prev === 11 && isDeaf) {
                showSubtitle("Waktu hampir habis! 10 detik lagi!", "warning");
            }
            return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0 && started) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [started, timeLeft]);

  // Announce Question for Tunanetra
  const announceQuestion = (index) => {
    const q = questions[index];
    if (!q) return;
    const msg = `Soal ${index + 1} dari ${questions.length}. ${q.question_text}. `;
    const optionsMsg = q.assignment_question_options?.map((opt, i) =>
        `Pilihan ${String.fromCharCode(65 + i)}: ${opt.option_text}.`
    ).join(' ');

    speak(msg + optionsMsg);
    if (isDeaf) showSubtitle(msg, "info");
  };

  useEffect(() => {
    if (started && currentStep > 0 && !hasAnnouncedQuestion.current) {
        announceQuestion(currentStep - 1);
        hasAnnouncedQuestion.current = true;
    }
  }, [started, currentStep]);

  const fetchTaskData = async () => {
    setLoading(true);
    try {
      const { data: taskData } = await supabase.from('assignments').select('*, modules(title)').eq('id', id).maybeSingle();
      if (!taskData) { setError("Kuis tidak ditemukan."); return; }
      setTask(taskData);
      setTimeLeft(taskData.duration_minutes * 60 || 1800);

      const { data: qs } = await supabase.from('assignment_questions').select('*, assignment_question_options(*)').eq('assignment_id', id).order('order_index', { ascending: true });
      setQuestions(qs || []);

      const { data: existingSub } = await supabase.from('submissions').select('*').eq('assignment_id', id).eq('student_id', profile?.id).maybeSingle();
      if (existingSub) setSubmissionRecord(existingSub);
    } catch (err) { setError("Gagal memuat data kuis."); } finally { setLoading(false); }
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

    const choiceLabel = String.fromCharCode(65 + index);
    if (isBlind) speak(`Jawaban ${choiceLabel} dipilih.`);
    if (isDeaf) showSubtitle(`Jawaban ${choiceLabel} dipilih`, "success");

    // Auto next after 1.5s
    setTimeout(handleNext, 1500);
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
      const questionResults = questions.map(q => {
        const ans = answers[q.id] || {};
        const correctOpt = q.assignment_question_options?.find(o => o.is_correct);
        const isCorrect = ans.selected_option_id === correctOpt?.id;
        const pts = isCorrect ? (q.points || 10) : 0;
        totalScore += pts;
        return { question_id: q.id, selected_option_id: ans.selected_option_id, is_correct: isCorrect, points_earned: pts };
      });

      const { data: sub } = await supabase.from('submissions').insert({
        assignment_id: id, student_id: profile.id, status: 'graded', total_score: totalScore, submitted_at: new Date().toISOString()
      }).select().single();

      await supabase.from('submission_answers').insert(questionResults.map(res => ({ ...res, submission_id: sub.id })));
      if (totalScore > 0) await supabase.rpc('add_bonus_xp', { target_student_id: profile.id, amount: totalScore });

      if (isBlind) speak(`Quiz selesai. Skor kamu adalah ${totalScore}. Bagus sekali!`);
      if (isDeaf) showSubtitle(`Quiz Selesai! Skor: ${totalScore}`, "success");

      setShowConfetti(true);
      setSubmissionRecord(sub);
      setStarted(false);
      fetchProfile(profile.id);
    } catch (err) { alert("Gagal mengirim jawaban"); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-slate-400 uppercase tracking-widest">Menyiapkan Misi...</div>;

  if (submissionRecord && !submissionRecord.allow_retake) {
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
          <ConfettiEffect active={showConfetti} />
          <h2 className="text-4xl font-black text-slate-900 mb-4">Misi Selesai! ✨</h2>
          <div className="bg-white p-12 rounded-[4rem] shadow-xl mb-10">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Skor Kamu</p>
              <p className="text-7xl font-black text-indigo-600">{submissionRecord.total_score || 0}</p>
          </div>
          <button onClick={() => navigate('/student/dashboard')} className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest">Kembali ke Beranda</button>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans relative">
      {/* Perbaikan: Hanya render overlay kamera jika pengguna adalah Tunawicara */}
      {isMute && (
        <GestureCameraOverlay videoRef={videoRef} canvasRef={canvasRef} isActive={camActive} gestureLabel={gestureLabel} lastGesture={lastGesture} />
      )}

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
                    <div className="flex justify-between">
                        <button onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 1} className="font-black text-slate-400 uppercase text-xs">Kembali</button>
                        <button onClick={handleNext} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">{currentStep === questions.length ? 'Selesai' : 'Lanjut'}</button>
                    </div>
                 </div>
               ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Visual Flash for Deaf on Success/Error events if any */}
      {isDeaf && (
          <div className="fixed inset-0 pointer-events-none z-[100]">
              <AnimatePresence>
                  {timeLeft !== null && timeLeft < 10 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.2, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="absolute inset-0 bg-yellow-400" />
                  )}
              </AnimatePresence>
          </div>
      )}
    </div>
  );
};

export default StudentTaskDetail;
