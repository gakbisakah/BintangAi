// pages/student/Quiz.jsx — FULL FIXED ACCESSIBILITY VERSION
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
  const [markedHard, setMarkedHard] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const timerRef = useRef(null);
  const hasAnnouncedRef = useRef(false);
  const answersRef = useRef({});  // track per-question answer

  const currentQ = questions[currentIndex];

  // Auto read questions for blind
  useEffect(() => {
    if (isBlind && currentQ && !finished) {
      const timer = setTimeout(() => {
        const optionsText = currentQ.options.map((opt, i) => `Pilihan ${String.fromCharCode(65 + i)}: ${opt}`).join('. ');
        speak(`Soal ${currentIndex + 1} dari ${questions.length}. ${currentQ.text}. ${optionsText}`);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentQ, isBlind, finished, questions.length, speak]);

  // ── TUNANETRA: Extended voice commands ──
  useGlobalVoiceNav({
    enabled: isBlind,
    onCommand: (t, speakFn) => {
      if (!currentQ) return null;

      if (
        t.includes('baca soal') ||
        t.includes('ulangi') ||
        t.includes('bacakan') ||
        t.includes('soal berapa')
      ) {
        // Trigger manual read if needed, though useEffect handles auto-read
        const optionsText = currentQ.options.map((opt, i) => `Pilihan ${String.fromCharCode(65 + i)}: ${opt}`).join('. ');
        speakFn(`Soal ${currentIndex + 1}. ${currentQ.text}. ${optionsText}`);
        return 'read_question';
      }

      const answerMap = {
        'pilih a': 0, 'jawab a': 0, 'pilih jawaban a': 0, 'jawaban a': 0, 'huruf a': 0,
        'pilih b': 1, 'jawab b': 1, 'pilih jawaban b': 1, 'jawaban b': 1, 'huruf b': 1,
        'pilih c': 2, 'jawab c': 2, 'pilih jawaban c': 2, 'jawaban b': 2, 'huruf c': 2,
        'pilih d': 3, 'jawab d': 3, 'pilih jawaban d': 3, 'jawaban d': 3, 'huruf d': 3,
      };
      for (const [cmd, idx] of Object.entries(answerMap)) {
        if (t.includes(cmd)) {
          if (currentQ.options && idx < currentQ.options.length) {
            handleAnswer(idx);
          } else {
            speakFn(`Pilihan ${String.fromCharCode(65 + idx)} tidak ada di soal ini.`);
          }
          return 'answer';
        }
      }

      if (t.includes('lanjut') || t.includes('soal berikutnya') || t.includes('next')) {
        if (selectedAnswer !== null || answersRef.current[currentQ.id] !== undefined) {
          goNext();
        } else {
          speakFn('Pilih jawaban terlebih dahulu sebelum lanjut.');
        }
        return 'next';
      }

      if (t.includes('tandai sulit') || t.includes('tandai') || t.includes('sulit')) {
        setMarkedHard(prev => [...prev, currentIndex]);
        speakFn('Soal ditandai sebagai sulit.');
        return 'mark_hard';
      }

      if (t.includes('lewati') || t.includes('skip')) {
        goNext();
        speakFn('Soal dilewati.');
        return 'skip';
      }

      return null;
    }
  });

  // ── TUNAWICARA: Gesture answers ──
  // Perbaikan: Hanya aktifkan gesture control jika user adalah tunawicara (isMute)
  const {
    videoRef,
    canvasRef,
    isActive: camActive,
    gestureLabel,
    lastGesture,
    confidence,
    handDetected
  } = useGestureControl({
    enabled: isMute,
    onGesture: (gesture, action, text) => {
      if (!currentQ || finished) return;

      // Map gesture ke jawaban
      const gestureToAnswer = {
        'point_up': 0,      // ☝️ = A
        'peace': 1,         // ✌️ = B
        'three_fingers': 2, // 🤘 = C
        'four_fingers': 3   // 🖖 = D
      };

      if (gestureToAnswer[gesture] !== undefined && selectedAnswer === null) {
        const idx = gestureToAnswer[gesture];
        if (idx < currentQ.options.length) {
          if (isDeaf) showSubtitle(`${text} dipilih`, 'success');
          handleAnswer(idx);
        }
      }

      if (action === 'next') {
        if (selectedAnswer !== null) {
          goNext();
        } else if (isDeaf) {
          showSubtitle('Pilih jawaban terlebih dahulu', 'warning');
        }
      }

      if (action === 'back') {
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
          setSelectedAnswer(null);
          if (isDeaf) showSubtitle('Kembali ke soal sebelumnya', 'info');
        }
      }

      if (action === 'stop' || gesture === 'fist') {
        finishQuiz();
        if (isDeaf) showSubtitle('Quiz selesai!', 'success');
      }

      // Keep additional specific gestures if needed, but primary ones are above
      if (gesture === 'open_hand' && selectedAnswer === null) {
        goNext();
        if (isDeaf) showSubtitle('✋ Soal dilewati', 'info');
      }
    }
  });

  useEffect(() => {
    if (id && profile?.id) fetchQuizData();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [id, profile?.id]);

  useEffect(() => {
    if (!loading && quiz && questions.length > 0 && !hasAnnouncedRef.current) {
      hasAnnouncedRef.current = true;
      const introText = `${quiz.assignments?.title || 'Quiz'}.`;
      if (isBlind) {
        speak(introText);
      }
      if (isDeaf) {
        showSubtitle(introText, 'info');
      }
    }
  }, [loading, quiz, questions, isBlind, isDeaf, speak, showSubtitle]);

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
        if (prev === 10) {
          if (isBlind) speak('Waktu tersisa 10 detik!');
          if (isDeaf) showSubtitle('⚠️ 10 detik terakhir!', 'warning');
        }
        if (prev === 5) {
          if (isBlind) speak('Lima!');
          if (isDeaf) showSubtitle('⚠️ 5 detik!', 'warning');
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchQuizData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('quizzes')
        .select('*, assignments(subject, title)')
        .eq('assignment_id', id)
        .single();
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index) => {
    if (selectedAnswer !== null || finished || alreadyDone) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedAnswer(index);
    const isCorrect = index !== -1 && index === currentQ.correctIndex;

    if (index === -1) {
      if (isBlind) speak('Waktu habis untuk soal ini.');
      if (isDeaf) showSubtitle('⏰ Waktu Habis!', 'error');
    } else {
      const choiceLetter = String.fromCharCode(65 + index);
      if (isBlind) speak(`Jawaban ${choiceLetter} dipilih.`);
      if (isDeaf) showSubtitle(`Jawaban ${choiceLetter} dipilih`, 'info');
    }

    if (isCorrect) {
      setScore(prev => prev + 1);
      setCorrectCount(prev => prev + 1);
      if (isBlind) setTimeout(() => speak('Benar!'), 800);
      if (isDeaf) setTimeout(() => showSubtitle('✅ Jawaban Benar!', 'success'), 800);
    } else if (index !== -1) {
      if (isBlind) setTimeout(() => speak('Kurang tepat, lanjut soal berikutnya.'), 800);
      if (isDeaf) setTimeout(() => showSubtitle('❌ Kurang tepat', 'error'), 800);
    }

    answersRef.current[currentQ.id] = index;
    setAnsweredCount(prev => prev + 1);

    setTimeout(() => {
      goNext();
    }, 2200);
  };

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      if (isBlind) speak('Soal berikutnya...');
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    if (finished || alreadyDone || isSubmitting) return;
    setIsSubmitting(true);
    setFinished(true);

    const xpGained = score * 30;
    if (isBlind) speak(`Quiz selesai! Kamu menjawab benar ${score} dari ${questions.length} soal. Total ${xpGained} XP.`);
    if (isDeaf) showSubtitle(`🏆 Quiz Selesai! Benar: ${score}/${questions.length} | XP: +${xpGained}`, 'success');
    if (isMute) showSubtitle(`🏆 Selesai! ${score}/${questions.length} benar → +${xpGained} XP`, 'success');

    try {
      await supabase.from('submissions').insert({
        assignment_id: id,
        student_id: profile.id,
        status: 'submitted',
        total_score: xpGained,
        submitted_at: new Date().toISOString(),
      });
      await updateXP(xpGained);
      await fetchProfile(profile.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-400 uppercase tracking-widest">
        Memuat Quiz...
      </div>
    );
  }

  if (alreadyDone || finished) {
    const finalScore = finished ? score * 30 : existingResult?.total_score || 0;
    const finalCorrect = finished ? correctCount : 0;
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <ConfettiEffect active={showConfetti || finished} />
        <span className="text-8xl mb-8 block">🏆</span>
        <h2 className="font-black text-slate-900 text-4xl mb-4">QUIZ SELESAI!</h2>
        <div className="bg-indigo-50 p-10 rounded-[3rem] mb-6 border border-indigo-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            Total XP
          </p>
          <p className="font-black text-indigo-600 text-7xl">+{finalScore}</p>
          {finished && (
            <p className="mt-4 font-bold text-slate-600 text-lg">
              Benar: {finalCorrect} dari {questions.length} soal
            </p>
          )}
        </div>
        <button
          onClick={() => navigate('/student/dashboard')}
          onMouseEnter={() => isBlind && speak('Tombol kembali ke beranda')}
          className="w-full max-w-xs bg-indigo-600 text-white font-black py-6 rounded-[2rem] shadow-xl uppercase tracking-widest hover:bg-indigo-700 transition-all"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const timerPercent = (timeLeft / 60) * 100;
  const isTimeCritical = timeLeft < 10;

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Perbaikan: Hanya render overlay kamera jika pengguna adalah Tunawicara */}
      {isMute && (
        <GestureCameraOverlay
          videoRef={videoRef}
          canvasRef={canvasRef}
          isActive={camActive}
          gestureLabel={gestureLabel}
          lastGesture={lastGesture}
          confidence={confidence}
          handDetected={handDetected}
        />
      )}

      {/* TUNANETRA hint bar */}
      {isBlind && (
        <div className="fixed top-0 inset-x-0 z-50 bg-indigo-700 text-white text-center py-2 text-xs font-black">
          🎤 Katakan: "Baca Soal" · "Pilih A/B/C/D" · "Lanjut" · "Tandai Sulit"
        </div>
      )}

      {/* TUNAWICARA hint bar */}
      {isMute && (
        <div className="fixed top-0 inset-x-0 z-50 bg-purple-700 text-white text-center py-2 text-xs font-black">
          ✋ Gesture: ☝️=A · ✌️=B · 🤘=C · 🖖=D · ✊=Selesai · ✋=Lewati
        </div>
      )}

      <header
        className={`bg-white border-b border-slate-100 p-8 sticky z-10 flex justify-between items-center shadow-sm ${isBlind || isMute ? 'top-8' : 'top-0'}`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            onMouseEnter={() => isBlind && speak('Tombol kembali')}
            className="text-slate-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1
            className="font-black text-slate-900 uppercase text-xl"
            onMouseEnter={() => isBlind && speak(quiz?.assignments?.title || 'Quiz')}
          >
            {quiz?.assignments?.title || 'Quiz'}
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div
            className={`flex flex-col items-center px-6 py-2 rounded-2xl border-4 transition-colors ${
              isTimeCritical
                ? 'bg-rose-50 border-rose-500 text-rose-600 animate-pulse'
                : 'bg-indigo-50 border-indigo-100 text-indigo-600'
            }`}
            aria-label={`Waktu tersisa ${timeLeft} detik`}
          >
            <span className="text-2xl font-black">{timeLeft}s</span>
            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
              <motion.div
                animate={{ width: `${timerPercent}%` }}
                className={`h-full ${isTimeCritical ? 'bg-rose-500' : 'bg-indigo-600'}`}
              />
            </div>
          </div>
          <div
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-sm uppercase"
            onMouseEnter={() =>
              isBlind && speak(`Soal ${currentIndex + 1} dari ${questions.length}`)
            }
          >
            Soal {currentIndex + 1} / {questions.length}
          </div>
        </div>
      </header>

      {/* Deaf: red flash for time-critical */}
      {isDeaf && isTimeCritical && (
        <motion.div
          animate={{ opacity: [0, 0.25, 0] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="fixed inset-0 bg-rose-500 pointer-events-none z-40"
        />
      )}

      <main className={`max-w-4xl mx-auto px-6 py-12 ${isBlind || isMute ? 'mt-8' : ''}`}>
        {/* Progress */}
        <div className="w-full bg-slate-200 h-4 rounded-full mb-12 overflow-hidden border-2 border-white shadow-inner">
          <motion.div
            className="h-full bg-indigo-600"
            animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-12 bg-white rounded-[4rem] shadow-xl border-4 mb-12 ${
            markedHard.includes(currentIndex) ? 'border-amber-400' : 'border-slate-50'
          }`}
        >
          <div className="flex items-center gap-4 mb-8">
            <span className="text-4xl">❓</span>
            {markedHard.includes(currentIndex) && (
              <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">
                ⚠️ Ditandai Sulit
              </span>
            )}
          </div>
          <h2
            className={`font-black text-slate-800 leading-tight ${isDeaf ? 'text-5xl' : 'text-4xl'}`}
            onMouseEnter={() => isBlind && speak(currentQ?.text)}
          >
            {currentQ?.text}
          </h2>
        </motion.div>

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-8">
          {currentQ?.options.map((opt, i) => (
            <motion.button
              key={i}
              whileHover={{ y: -5 }}
              onClick={() => handleAnswer(index)}
              onMouseEnter={() =>
                isBlind && speak(`Pilihan ${String.fromCharCode(65 + i)}: ${opt}`)
              }
              disabled={selectedAnswer !== null}
              aria-label={`Pilihan ${String.fromCharCode(65 + i)}: ${opt}`}
              className={`p-8 rounded-[3rem] text-left font-black transition-all flex items-center gap-6 border-4 ${
                selectedAnswer === i
                  ? 'bg-indigo-600 border-indigo-700 text-white shadow-2xl'
                  : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-300 shadow-sm'
              } ${isDeaf ? 'text-3xl p-12' : 'text-xl'}`}
            >
              <span
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black ${
                  selectedAnswer === i ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
            </motion.button>
          ))}
        </div>

        {/* TUNANETRA: mark hard button */}
        {isBlind && (
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setMarkedHard(prev => [...prev, currentIndex]);
                speak('Soal ditandai sulit.');
              }}
              className="px-8 py-3 bg-amber-50 text-amber-600 rounded-2xl font-black text-xs uppercase border border-amber-100"
            >
              ⚠️ Tandai Sulit
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentQuiz;
