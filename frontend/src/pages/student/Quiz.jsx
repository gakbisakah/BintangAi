import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import ConfettiEffect from '../../components/ConfettiEffect';
import { useVoice } from '../../hooks/useVoice';

const StudentQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, updateXP, fetchProfile } = useAuthStore();
  const { speak } = useVoice();

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
  const [timeLeft, setTimeLeft] = useState(60); // Default timer per question

  const isBlind = profile?.disability_type === 'tunanetra';
  const isTunarungu = profile?.disability_type === 'tunarungu';
  const timerRef = useRef(null);

  useEffect(() => {
    if (id && profile?.id) {
      fetchQuizData();
    }

    const handleKeyDown = (e) => {
      if (e.key >= '1' && e.key <= '4') {
        handleAnswer(parseInt(e.key) - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, profile?.id]);

  useEffect(() => {
    if (questions.length > 0 && !finished && !alreadyDone && !loading) {
      readCurrentQuestion();
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, questions, finished, alreadyDone, loading]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(60);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAnswer(-1); // Time out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const readCurrentQuestion = () => {
    if (!isBlind || !questions[currentIndex]) return;
    const q = questions[currentIndex];
    const optionsText = q.options.map((opt, i) => `Pilihan ${String.fromCharCode(65 + i)}: ${opt}`).join('. ');
    const fullText = `Pertanyaan nomor ${currentIndex + 1}. ${q.text}. Waktu kamu 60 detik. Berikut pilihannya. ${optionsText}.`;
    speak(fullText);
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
        setQuestions(data.questions);

        const { data: submission } = await supabase
          .from('submissions')
          .select('*')
          .eq('assignment_id', id)
          .eq('student_id', profile.id)
          .maybeSingle();

        if (submission && (submission.status === 'submitted' || submission.status === 'graded')) {
          setAlreadyDone(true);
          setExistingResult(submission);
          if (isBlind) speak(`Kamu sudah mengerjakan kuis ${data.assignments?.title} sebelumnya. Skor kamu adalah ${submission.total_score}.`);
        }
      }
    } catch (err) {
      console.error("Fetch quiz error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index) => {
    if (selectedAnswer !== null || finished || alreadyDone) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedAnswer(index);
    const isCorrect = index === questions[currentIndex].correctIndex;

    if (isCorrect) {
      setScore(prev => prev + 1);
      setShowConfetti(true);
      if (isBlind) speak("Jawaban kamu benar!");
      setTimeout(() => setShowConfetti(false), 2000);
    } else {
      if (isBlind) {
        if (index === -1) speak("Waktu habis.");
        else speak("Jawaban kamu kurang tepat.");
      }
    }

    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        finishQuiz();
      }
    }, 2500);
  };

  const finishQuiz = async () => {
    if (finished || alreadyDone) return;
    setFinished(true);

    const percentage = Math.round((score / questions.length) * 100);
    const xpGained = score * 30;

    if (isBlind) speak(`Kuis selesai! Kamu mendapatkan ${xpGained} XP. Kamu menjawab ${score} dari ${questions.length} soal dengan benar.`);

    try {
      await supabase.from('quiz_results').insert({
        quiz_id: quiz.id,
        student_id: profile.id,
        score: xpGained,
        answers: {
          correct_count: score,
          total_questions: questions.length,
          percentage: percentage
        }
      });

      await supabase.from('submissions').insert({
        assignment_id: id,
        student_id: profile.id,
        status: 'submitted',
        total_score: xpGained,
        submitted_at: new Date().toISOString()
      });

      await updateXP(xpGained);

      if (percentage < 70) {
        const currentWeakTopics = profile.weak_topics || [];
        const newTopic = quiz.assignments?.subject || quiz.assignments?.title || 'Umum';
        if (!currentWeakTopics.includes(newTopic)) {
          const updatedTopics = [...currentWeakTopics, newTopic].slice(-5);
          await supabase.from('profiles').update({ weak_topics: updatedTopics }).eq('id', profile.id);
        }
      } else {
        const currentWeakTopics = profile.weak_topics || [];
        const topicToRemove = quiz.assignments?.subject || quiz.assignments?.title;
        if (currentWeakTopics.includes(topicToRemove)) {
          const updatedTopics = currentWeakTopics.filter(t => t !== topicToRemove);
          await supabase.from('profiles').update({ weak_topics: updatedTopics }).eq('id', profile.id);
        }
      }

      await fetchProfile(profile.id);
    } catch (err) {
      console.error("Error finishing quiz:", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-black text-indigo-600 uppercase tracking-widest">Memulai Kuis...</p>
      </div>
    </div>
  );

  if (alreadyDone) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100"
        >
          <span className="text-8xl mb-8 block">✅</span>
          <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase">Quiz Sudah Selesai!</h2>
          <p className="text-slate-500 font-bold mb-8 uppercase text-xs tracking-[0.15em] leading-relaxed">
            Kamu sudah mengerjakan misi <br/>
            <span className="text-indigo-600">"{quiz?.assignments?.title || 'QuizKu'}"</span> sebelumnya.
          </p>

          <div className="bg-indigo-50 p-6 rounded-3xl mb-8">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Skor Kamu</p>
            <p className="text-5xl font-black text-indigo-600">{existingResult?.total_score || 0}</p>
          </div>

          <button
            onClick={() => navigate('/student/dashboard')}
            onMouseEnter={() => isBlind && speak('Tombol kembali ke beranda berada di bagian bawah tengah layar.')}
            className="w-full py-5 bg-indigo-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all uppercase tracking-widest"
          >
            Kembali ke Beranda
          </button>
        </motion.div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <ConfettiEffect active={showConfetti} />
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
          <span className="text-8xl mb-8 block">🏆</span>
          <h2 className="text-4xl font-black text-slate-900 mb-4">Kuis Selesai!</h2>
          <div className="bg-slate-50 p-8 rounded-[3rem] mb-8 border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">XP Kamu</p>
            <p className="text-6xl font-black text-indigo-600">+{score * 30}</p>
            <p className="mt-4 text-slate-600 font-bold uppercase text-xs tracking-widest">{score} Jawaban Benar dari {questions.length}</p>
            <p className="mt-1 text-indigo-500 font-black text-lg">{Math.round((score/questions.length)*100)}%</p>
          </div>
          <button
            onClick={() => navigate('/student/dashboard')}
            onMouseEnter={() => isBlind && speak('Kuis selesai. Klik tombol di bawah ini untuk kembali ke beranda.')}
            className="w-full py-5 bg-indigo-600 text-white font-black text-xl rounded-[2rem] shadow-xl shadow-indigo-100 active:scale-95 transition-all uppercase tracking-[0.2em]"
          >
            Kembali ke Beranda
          </button>
        </motion.div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="bg-white border-b border-slate-100 px-8 py-6 sticky top-0 z-10 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-indigo-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">QuizKu: {quiz?.assignments?.title || 'Latihan'}</h1>
        </div>

        <div className="flex items-center gap-4">
            <div className={`px-6 py-2 rounded-2xl border ${timeLeft < 10 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                <span className="text-xs font-black uppercase tracking-widest">{timeLeft}s</span>
            </div>
            <div className="bg-indigo-50 px-6 py-2 rounded-2xl border border-indigo-100">
                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Soal {currentIndex + 1} / {questions.length}</span>
            </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="w-full h-2 bg-slate-200 rounded-full mb-12 overflow-hidden">
          <motion.div
            className="h-full bg-indigo-600"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
          />
        </div>

        <div className="mb-12">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onMouseEnter={() => isBlind && speak(`Pertanyaan: ${currentQ?.text}`)}
            className="p-12 bg-white rounded-[4rem] shadow-sm border border-slate-100 relative overflow-hidden"
          >
            <div className="flex items-center gap-4 mb-6">
                <span className="text-3xl">❓</span>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Pertanyaan</span>
            </div>
            <h2 className={`font-black text-slate-800 leading-tight ${isTunarungu ? 'text-4xl' : 'text-3xl'}`}>
              {currentQ?.text}
            </h2>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {currentQ?.options.map((opt, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleAnswer(i)}
              onMouseEnter={() => isBlind && speak(`Pilihan ${String.fromCharCode(65+i)}: ${opt}`)}
              disabled={selectedAnswer !== null}
              className={`
                p-8 rounded-[3rem] text-left font-black transition-all flex items-center gap-6 border-2
                ${selectedAnswer === i
                  ? (i === currentQ.correctIndex ? 'bg-emerald-500 border-emerald-600 text-white shadow-xl shadow-emerald-100' : 'bg-rose-500 border-rose-600 text-white shadow-xl shadow-rose-100')
                  : selectedAnswer !== null && i === currentQ.correctIndex
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-white border-slate-50 text-slate-700 hover:border-indigo-200 shadow-sm'
                }
                ${isTunarungu ? 'text-2xl' : 'text-lg'}
              `}
            >
              <span className={`
                w-12 h-12 rounded-2xl flex items-center justify-center font-black
                ${selectedAnswer === i ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}
              `}>
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
            </motion.button>
          ))}
        </div>

        {currentIndex === questions.length - 1 && (
            <div className="mt-12 flex justify-center">
                 <button
                    onMouseEnter={() => isBlind && speak('Tombol kirim kuis berada di bagian tengah bawah setelah pilihan jawaban terakhir.')}
                    className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl"
                 >
                    Kirim Kuis
                 </button>
            </div>
        )}
      </main>
      <ConfettiEffect active={showConfetti} />
    </div>
  );
};

export default StudentQuiz;
