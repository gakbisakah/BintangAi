// pages/student/Quiz.jsx — FULL FIXED VERSION WITH AUTO-SUBMIT & DETAILS
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import ConfettiEffect from '../../components/ConfettiEffect';
import GestureCameraOverlay from '../../components/GestureCameraOverlay';
import { useVoice } from '../../hooks/useVoice';
import { useGlobalVoiceNav } from '../../hooks/useGlobalVoiceNav';
import { useGestureControl } from '../../hooks/useGestureControl';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';
import { useAccessibility } from '../../hooks/useAccessibility';

const StudentQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, updateXP, fetchProfile } = useAuthStore();
  const { speak } = useVoice();
  const { showSubtitle } = useSubtitle();
  const { isBlind, isDeaf, isMute } = useAccessibility();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [existingResult, setExistingResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [resultsDetail, setResultsDetail] = useState([]);

  const timerRef = useRef(null);

  const currentQ = questions[currentIndex];

  // Auto read questions for blind
  useEffect(() => {
    if (isBlind && currentQ && !finished) {
      const timer = setTimeout(() => {
        const optionsText = currentQ.options.map((opt, i) => `Pilihan ${String.fromCharCode(65 + i)}: ${opt}`).join('. ');
        speak(`Soal ${currentIndex + 1} dari ${questions.length}. ${currentQ.text || currentQ.question}. ${optionsText}`);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentQ, isBlind, finished, questions.length, speak]);

  // Voice Command for Accessibility
  useGlobalVoiceNav({
    enabled: isBlind,
    onCommand: (t, speakFn) => {
      if (!currentQ || finished) return null;
      const text = t.toLowerCase();

      if (text.includes('baca soal') || text.includes('ulangi')) {
        const optionsText = currentQ.options.map((opt, i) => `Pilihan ${String.fromCharCode(65 + i)}: ${opt}`).join('. ');
        speakFn(`Soal ${currentIndex + 1}. ${currentQ.text || currentQ.question}. ${optionsText}`);
        return 'read';
      }

      const answerMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
      for (const [key, idx] of Object.entries(answerMap)) {
        if (text.includes(`pilih ${key}`) || text.includes(`jawab ${key}`)) {
          if (idx < currentQ.options.length) handleAnswer(idx);
          return 'answer';
        }
      }
      return null;
    }
  });

  // Gesture Control for Accessibility
  const {
    videoRef, canvasRef, isActive: camActive, gestureLabel, lastGesture, confidence, handDetected
  } = useGestureControl({
    enabled: isMute,
    onGesture: (gesture, action) => {
      if (!currentQ || finished) return;
      const gestureToAnswer = { 'point_up': 0, 'peace': 1, 'three_fingers': 2, 'four_fingers': 3 };
      if (gestureToAnswer[gesture] !== undefined && selectedAnswer === null) {
        handleAnswer(gestureToAnswer[gesture]);
      }
      if (action === 'stop' || gesture === 'fist') finishQuiz();
    }
  });

  useEffect(() => {
    if (id && profile?.id) fetchQuizData();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [id, profile?.id]);

  useEffect(() => {
    if (!finished && !alreadyDone && !loading) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex, questions, finished, alreadyDone, loading]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(60);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAnswer(-1); // timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchQuizData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*, assignments(subject, title)')
        .eq('assignment_id', id)
        .single();

      if (error) throw error;

      if (data) {
        setQuiz(data);
        setQuestions(data.questions || []);

        const { data: sub } = await supabase
          .from('submissions')
          .select('*')
          .eq('assignment_id', id)
          .eq('student_id', profile.id)
          .maybeSingle();

        if (sub?.status === 'submitted' || sub?.status === 'graded') {
          setAlreadyDone(true);
          setExistingResult(sub);
        }
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index) => {
    if (selectedAnswer !== null || finished || alreadyDone) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedAnswer(index);

    // Support correctIndex (number) or correct_answer (text or string index)
    const correctIdx = currentQ.correctIndex !== undefined ? currentQ.correctIndex : currentQ.correct_answer;
    const isCorrect = index !== -1 && (
      index === Number(correctIdx) ||
      currentQ.options[index] === currentQ.correct_answer
    );

    const resultItem = {
      question: currentQ.text || currentQ.question,
      userAnswer: index !== -1 ? currentQ.options[index] : 'Waktu Habis',
      correctAnswer: currentQ.options[Number(correctIdx)] || currentQ.correct_answer,
      isCorrect
    };

    setResultsDetail(prev => [...prev, resultItem]);

    if (isCorrect) {
      setScore(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
      if (isBlind) speak('Benar!');
      if (isDeaf) showSubtitle('✅ Benar!', 'success');
    } else {
      if (isBlind) speak(index === -1 ? 'Waktu habis.' : 'Kurang tepat.');
      if (isDeaf) showSubtitle(index === -1 ? '⏰ Waktu Habis!' : '❌ Salah', 'error');
    }

    // Automatis lanjut ke soal berikutnya (kecuali jika di soal terakhir)
    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        goNext();
      }, 1500);
    }
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (finished || alreadyDone || isSubmitting) return;
    setIsSubmitting(true);

    const xpGained = score * 20;
    const finalScore = Math.round((score / questions.length) * 100);

    try {
      const { error } = await supabase.from('submissions').insert({
        assignment_id: id,
        student_id: profile.id,
        status: 'submitted',
        total_score: finalScore,
        submitted_at: new Date().toISOString(),
      });

      if (error) throw error;

      await updateXP(xpGained);
      await fetchProfile(profile.id);

      setFinished(true);
      setShowConfetti(true);
      if (isBlind) speak(`Quiz selesai! Skor kamu ${finalScore}.`);
    } catch (err) {
      console.error('Error submitting quiz:', err);
      // Even if DB save fails, show results so student knows they finished
      setFinished(true);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400 uppercase tracking-widest">
      Memuat Quiz...
    </div>
  );

  if (isSubmitting) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
      <h2 className="font-black text-slate-900 text-2xl uppercase">Mengirim Jawaban...</h2>
    </div>
  );

  if (alreadyDone || finished) {
    const displayScore = finished ? Math.round((score / questions.length) * 100) : existingResult?.total_score || 0;
    const displayCorrect = finished ? score : '-';

    return (
      <div className="min-h-screen bg-white flex flex-col items-center p-6 pt-12 overflow-y-auto">
        <ConfettiEffect active={showConfetti} />
        <span className="text-8xl mb-4">🏆</span>
        <h2 className="font-black text-slate-900 text-4xl mb-2 uppercase text-center">Hasil Quiz</h2>
        <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-center">{quiz?.assignments?.title}</p>

        <div className="w-full max-w-2xl bg-indigo-50 rounded-[3rem] p-10 border-4 border-indigo-100 mb-8 text-center relative overflow-hidden shadow-xl">
          <div className="relative z-10">
            <p className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-1">Skor Akhir</p>
            <p className="text-9xl font-black text-indigo-600 mb-4">{displayScore}</p>
            <div className="flex justify-center gap-8 text-slate-600 font-black uppercase text-sm">
              <span className="px-6 py-3 bg-white rounded-2xl shadow-sm border border-indigo-100">✅ {displayCorrect} Benar</span>
              <span className="px-6 py-3 bg-white rounded-2xl shadow-sm border border-indigo-100">❓ {questions.length} Soal</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-200/20 rounded-full blur-3xl"></div>
        </div>

        {/* Results Detail */}
        {resultsDetail.length > 0 && (
          <div className="w-full max-w-2xl mb-12 space-y-4">
            <h3 className="font-black text-slate-800 text-xl mb-6 uppercase border-l-8 border-indigo-600 pl-4">Analisis Jawaban</h3>
            {resultsDetail.map((res, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={idx}
                className={`p-6 rounded-[2.5rem] border-4 ${res.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}
              >
                <p className="font-black text-slate-400 text-[10px] mb-2 uppercase tracking-widest">Soal {idx + 1}</p>
                <p className="font-black text-slate-800 text-lg mb-4 leading-tight">{res.question}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 rounded-2xl ${res.isCorrect ? 'bg-emerald-100/50' : 'bg-rose-100/50'}`}>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Jawaban Kamu</p>
                    <p className={`font-black ${res.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{res.userAnswer}</p>
                  </div>
                  {!res.isCorrect && (
                    <div className="p-4 bg-emerald-100/50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Jawaban Benar</p>
                      <p className="font-black text-emerald-700">{res.correctAnswer}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {alreadyDone && !finished && (
          <div className="mb-10 text-amber-600 font-black uppercase text-sm bg-amber-50 px-8 py-4 rounded-3xl border-2 border-amber-200 text-center max-w-md">
            ⚠️ Kamu sudah pernah mengerjakan quiz ini. Hasil yang ditampilkan adalah nilai terakhirmu.
          </div>
        )}

        <button
          onClick={() => navigate('/student/dashboard')}
          className="w-full max-w-xs bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl uppercase tracking-widest hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all mb-20"
        >
          Selesai & Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {isMute && (
        <GestureCameraOverlay videoRef={videoRef} canvasRef={canvasRef} isActive={camActive}
          gestureLabel={gestureLabel} lastGesture={lastGesture} confidence={confidence} handDetected={handDetected} />
      )}

      <header className={`bg-white border-b-4 border-slate-100 p-8 sticky z-20 flex justify-between items-center transition-all ${isBlind || isMute ? 'top-8' : 'top-0'}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all active:scale-90">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-black text-slate-900 uppercase text-xl leading-none mb-1">{quiz?.assignments?.title || 'Quiz'}</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{quiz?.assignments?.subject || 'Pelajaran'}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={`px-6 py-3 rounded-2xl border-4 font-black transition-all ${timeLeft < 10 ? 'bg-rose-50 border-rose-500 text-rose-600 animate-pulse' : 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
            <span className="text-3xl tabular-nums">{timeLeft}s</span>
          </div>
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-sm uppercase shadow-lg">
            Soal {currentIndex + 1} / {questions.length}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Progress Bar */}
        <div className="w-full bg-slate-200 h-6 rounded-full mb-12 overflow-hidden border-4 border-white shadow-inner">
          <motion.div
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 50 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="p-12 bg-white rounded-[4rem] shadow-2xl border-b-[12px] border-slate-100 mb-12 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <h2 className="font-black text-slate-800 text-4xl leading-tight">{currentQ?.text || currentQ?.question}</h2>
          </motion.div>
        </AnimatePresence>

        <div className="grid md:grid-cols-2 gap-6">
          {currentQ?.options.map((opt, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer(i)}
              disabled={selectedAnswer !== null}
              className={`p-8 rounded-[3rem] text-left font-black transition-all flex items-center gap-6 border-4 border-b-[10px] ${
                selectedAnswer === i
                  ? 'bg-indigo-600 border-indigo-800 text-white shadow-xl -translate-y-2'
                  : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-300 shadow-md'
              }`}
            >
              <span className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl ${selectedAnswer === i ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-xl flex-1">{opt}</span>
            </motion.button>
          ))}
        </div>

        {/* Tombol Submit di soal terakhir setelah menjawab */}
        {currentIndex === questions.length - 1 && selectedAnswer !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 text-center"
          >
            <button
              onClick={finishQuiz}
              className="w-full bg-emerald-600 text-white font-black py-8 rounded-[3rem] shadow-2xl uppercase tracking-widest text-2xl hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
            >
              <span>Selesaikan Quiz & Kirim</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default StudentQuiz;
