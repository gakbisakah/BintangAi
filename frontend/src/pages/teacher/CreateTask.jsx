import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';

const TeacherCreateTask = () => {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { generateAIQuiz, generateManualFeedback, loading: aiHookLoading } = useAI();

  const [loading, setLoading] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('manual');
  const [generatingFeedback, setGeneratingFeedback] = useState(null);

  const subjects = [
    { id: 'matematika', name: 'Matematika', icon: '🔢', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    { id: 'ipa', name: 'IPA', icon: '🔬', color: 'green', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    { id: 'ips', name: 'IPS', icon: '🌏', color: 'orange', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    { id: 'english', name: 'English', icon: '🇬🇧', color: 'purple', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' }
  ];

  const [aiConfig, setAiConfig] = useState({
    subject: 'matematika',
    gradeLevel: 4,
    difficulty: 'medium',
    types: ['multiple_choice'],
    count: 5,
    topic: ''
  });

  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    deadlineDate: '',
    deadlineTime: '',
    duration: '',
    isPublic: true,
    enrollKey: ''
  });

  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (editId) fetchExistingTask();
    else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setTaskData(prev => ({
        ...prev,
        deadlineDate: tomorrow.toISOString().split('T')[0],
        deadlineTime: "23:59"
      }));
    }
  }, [editId]);

  const fetchExistingTask = async () => {
    setLoading(true);
    try {
      const { data: task } = await supabase
        .from('assignments')
        .select('*, assignment_questions(*, assignment_question_options(*))')
        .eq('id', editId)
        .single();

      if (task) {
        const d = new Date(task.deadline);
        setTaskData({
          title: task.title || '',
          description: task.description || '',
          deadlineDate: d.toISOString().split('T')[0],
          deadlineTime: d.toTimeString().split(' ')[0].slice(0, 5),
          duration: task.duration_minutes?.toString() || '',
          isPublic: task.is_public !== false,
          enrollKey: task.enroll_key || ''
        });

        const formattedQs = (task.assignment_questions || []).map(q => ({
          id: q.id,
          type: q.question_type,
          text: q.question_text,
          points: q.points,
          correctAnswer: q.rubric_text || q.correct_answer,
          feedbackCorrect: q.ai_explanation || '',
          feedbackWrong: q.ai_feedback_wrong || '',
          difficulty: q.difficulty_level || 'medium',
          options: (q.assignment_question_options || []).map(o => ({
            id: o.id, text: o.option_text, isCorrect: o.is_correct
          }))
        }));
        setQuestions(formattedQs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    // Validasi: Topik atau Mata Pelajaran harus ada
    if (!aiConfig.topic.trim() && !aiConfig.subject) {
      alert("Mohon pilih Mata Pelajaran atau isi Topik soal.");
      return;
    }

    if (aiConfig.types.length === 0) {
      alert("Pilih minimal satu tipe soal (PG atau Isian).");
      return;
    }

    setAiLoading(true);
    try {
      const selectedSub = subjects.find(s => s.id === aiConfig.subject);

      // Tentukan topik akhir. Jika ada topik spesifik, gunakan itu.
      // Jika topik kosong, gunakan nama mata pelajaran.
      let finalTopic = aiConfig.topic.trim();
      if (!finalTopic) {
        finalTopic = selectedSub?.name || 'Umum';
      } else if (selectedSub && !finalTopic.toLowerCase().includes(selectedSub.name.toLowerCase())) {
        // Tambahkan context mata pelajaran jika user mengisi topik spesifik
        finalTopic = `${finalTopic} (Mata Pelajaran: ${selectedSub.name})`;
      }

      const response = await generateAIQuiz({
        topic: finalTopic,
        grade_level: aiConfig.gradeLevel,
        question_types: aiConfig.types,
        total_questions: aiConfig.count,
        difficulty: aiConfig.difficulty,
        title: taskData.title,
        instructions: taskData.description,
        duration_minutes: parseInt(taskData.duration) || 30
      });

      if (response?.success && response.quiz) {
        const { quiz } = response;

        // Update meta data quiz jika masih kosong
        setTaskData(prev => ({
          ...prev,
          title: prev.title || quiz.quiz_title || quiz.title,
          description: prev.description || quiz.instructions,
          duration: prev.duration || (quiz.duration_minutes || quiz.duration)?.toString() || '30'
        }));

        // Mapping response dari AI (Edge Function) ke format state aplikasi
        const formatted = (quiz.questions || []).map((q) => {
          const isPG = q.type === 'multiple_choice';
          return {
            id: crypto.randomUUID(),
            type: isPG ? 'pilihan_ganda' : 'esai',
            text: q.question || q.text || '',
            points: q.points || (isPG ? 10 : 20),
            // Kunci jawaban untuk PG diambil dari teks di array options berdasarkan index
            correctAnswer: isPG
              ? (q.options && q.correct_answer_index !== undefined ? q.options[q.correct_answer_index] : (q.correctText || ''))
              : (q.correct_answer || q.correct || ''),
            feedbackCorrect: q.explanation || q.feedback_correct || '',
            feedbackWrong: q.feedback_wrong || '',
            difficulty: aiConfig.difficulty,
            options: isPG ? (q.options || []).map((opt, i) => ({
              id: crypto.randomUUID(),
              text: opt,
              isCorrect: i === (q.correct_answer_index ?? q.correct)
            })) : []
          };
        });

        setQuestions(formatted);
        setShowAIModal(false);
        alert(`✅ Berhasil membuat ${formatted.length} soal!`);
      } else {
        throw new Error(response?.message || "Gagal mendapatkan respon dari AI");
      }
    } catch (err) {
      console.error("AI Generation Error:", err);
      alert("Gagal generate soal: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const generateFeedbackForQuestion = async (q) => {
    if (!q.correctAnswer) return alert("Isi kunci jawaban dulu");

    setGeneratingFeedback(q.id);
    try {
      const feedback = await generateManualFeedback({
        question: q.text,
        correctAnswer: q.correctAnswer,
        questionType: q.type
      });

      if (feedback?.feedback_correct) {
        updateQuestion(q.id, {
          feedbackCorrect: feedback.feedback_correct,
          feedbackWrong: feedback.feedback_wrong || q.feedbackWrong
        });
        alert("✨ Feedback AI berhasil dibuat!");
      }
    } catch (err) {
      alert("Gagal buat feedback");
    } finally {
      setGeneratingFeedback(null);
    }
  };

  const addQuestion = (type) => {
    setQuestions([...questions, {
      id: crypto.randomUUID(),
      type,
      text: '',
      points: type === 'pilihan_ganda' ? 10 : 20,
      correctAnswer: '',
      feedbackCorrect: '',
      feedbackWrong: '',
      difficulty: 'medium',
      options: type === 'pilihan_ganda' ? [
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false }
      ] : []
    }]);
  };

  const updateQuestion = (id, updates) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const handleSubmit = async () => {
    if (!profile || !profile.id) {
        alert("Sesi Anda telah berakhir. Silakan muat ulang halaman atau login kembali.");
        return;
    }

    if (!taskData.title.trim()) return alert("Isi judul QuizKu");
    if (questions.length === 0) return alert("Tambah minimal 1 soal");

    setLoading(true);
    try {
      const payload = {
        title: taskData.title.trim(),
        description: taskData.description.trim(),
        deadline: `${taskData.deadlineDate}T${taskData.deadlineTime}:00`,
        duration_minutes: parseInt(taskData.duration) || null,
        ai_grading_enabled: true,
        show_explanation: true,
        is_public: taskData.isPublic,
        enroll_key: taskData.isPublic ? null : taskData.enrollKey?.trim(),
        teacher_id: profile.id
      };

      let assignmentId = editId;

      if (editId) {
        const { error: updateErr } = await supabase.from('assignments').update(payload).eq('id', editId);
        if (updateErr) throw updateErr;
        await supabase.from('assignment_questions').delete().eq('assignment_id', editId);
      } else {
        const { data, error: insertErr } = await supabase.from('assignments').insert(payload).select().single();
        if (insertErr) throw insertErr;
        if (!data) throw new Error("Gagal membuat tugas");
        assignmentId = data.id;
      }

      for (const q of questions) {
        const { data: insertedQ, error: qErr } = await supabase
          .from('assignment_questions')
          .insert({
            assignment_id: assignmentId,
            question_type: q.type,
            question_text: q.text.trim(),
            points: q.points,
            ai_explanation: q.feedbackCorrect,
            ai_feedback_wrong: q.feedbackWrong,
            difficulty_level: q.difficulty,
            rubric_text: q.type === 'esai' ? q.correctAnswer : null,
            correct_answer: q.type === 'pilihan_ganda' ? q.correctAnswer : null
          })
          .select()
          .single();

        if (qErr) throw qErr;

        if (q.type === 'pilihan_ganda' && insertedQ) {
          const { error: optErr } = await supabase.from('assignment_question_options').insert(
            q.options.map((o, i) => ({
              question_id: insertedQ.id,
              option_text: o.text.trim(),
              is_correct: o.is_correct || o.isCorrect,
              order_index: i
            }))
          );
          if (optErr) throw optErr;
        }
      }

      alert(editId ? "✅ QuizKu diperbarui!" : "🎉 QuizKu diterbitkan!");
      navigate('/teacher/dashboard?tab=assignments');
    } catch (err) {
      console.error("Submit error:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (d) => {
    const map = { easy: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', hard: 'bg-red-100 text-red-700' };
    return map[d] || 'bg-gray-100 text-gray-700';
  };

  const currentSubject = subjects.find(s => s.id === aiConfig.subject) || {
    icon: '✨', color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200'
  };

  if (!profile) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="text-center">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Menyiapkan Ruang Guru...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/teacher/dashboard')} className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">{editId ? 'Edit QuizKu' : 'Buat QuizKu'}</h1>
              <p className="text-slate-500 text-sm">Matematika • IPA • IPS • English | Kelas 1-6</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAIModal(true)} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2">
              <span>✨</span> Generate AI
            </button>
            <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 bg-white border-2 border-indigo-600 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50">
              {loading ? 'Menyimpan...' : (editId ? 'Simpan' : 'Terbitkan')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm w-fit">
          {['manual', 'preview'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-indigo-600'}`}>
              {tab === 'manual' ? '📝 Buat Manual' : `👁️ Preview (${questions.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'manual' ? (
          <div className="space-y-6">
            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Judul QuizKu</label>
                  <input type="text" value={taskData.title} onChange={e => setTaskData({...taskData, title: e.target.value})} placeholder="Contoh: Ujian Matematika Kelas 4" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Akses</label>
                  <div className="flex gap-2">
                    <button onClick={() => setTaskData({...taskData, isPublic: true})} className={`flex-1 py-3 rounded-xl font-bold text-sm ${taskData.isPublic ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>🌍 Public</button>
                    <button onClick={() => setTaskData({...taskData, isPublic: false})} className={`flex-1 py-3 rounded-xl font-bold text-sm ${!taskData.isPublic ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>🔒 Private</button>
                  </div>
                </div>
              </div>

              {!taskData.isPublic && (
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Enroll Key</label>
                  <input type="text" value={taskData.enrollKey} onChange={e => setTaskData({...taskData, enrollKey: e.target.value})} placeholder="Kunci akses untuk siswa" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
                </div>
              )}

              <div className="mt-4 space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Instruksi</label>
                <textarea value={taskData.description} onChange={e => setTaskData({...taskData, description: e.target.value})} rows={2} placeholder="Petunjuk pengerjaan..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Deadline</label>
                  <input type="date" value={taskData.deadlineDate} onChange={e => setTaskData({...taskData, deadlineDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Waktu</label>
                  <input type="time" value={taskData.deadlineTime} onChange={e => setTaskData({...taskData, deadlineTime: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Durasi (menit)</label>
                  <input type="number" value={taskData.duration} onChange={e => setTaskData({...taskData, duration: e.target.value})} placeholder="Opsional" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Soal Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Bank Soal</h2>
                <div className="flex gap-2">
                  <button onClick={() => addQuestion('pilihan_ganda')} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm">+ Pilihan Ganda</button>
                  <button onClick={() => addQuestion('esai')} className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl font-bold text-sm">+ Esai</button>
                </div>
              </div>

              <AnimatePresence>
                {questions.map((q, i) => (
                  <motion.div key={q.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold">{i+1}</span>
                          <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold">{q.type === 'pilihan_ganda' ? 'Pilihan Ganda' : 'Esai'}</span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${getDifficultyColor(q.difficulty)}`}>
                            {q.difficulty === 'easy' ? 'Mudah' : q.difficulty === 'medium' ? 'Sedang' : 'Sulit'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="number" value={q.points} onChange={e => updateQuestion(q.id, { points: e.target.value })} className="w-16 p-2 bg-slate-50 rounded-lg text-center font-bold" />
                          <button onClick={() => setQuestions(questions.filter(x => x.id !== q.id))} className="text-slate-400 hover:text-red-500">🗑️</button>
                        </div>
                      </div>

                      <textarea value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} placeholder="Tulis soal..." rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:border-indigo-500" />

                      <input value={q.correctAnswer} onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })} placeholder="🔑 Kunci Jawaban" className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl outline-none" />

                      {q.type === 'pilihan_ganda' && (
                        <div className="grid md:grid-cols-2 gap-3">
                          {(q.options || []).map((opt, oi) => (
                            <div key={opt.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                              <button onClick={() => updateQuestion(q.id, { options: q.options.map((o, idx) => ({ ...o, isCorrect: idx === oi })) })} className={`w-8 h-8 rounded-lg font-bold ${opt.isCorrect ? 'bg-green-500 text-white' : 'bg-white border border-slate-200'}`}>
                                {String.fromCharCode(65+oi)}
                              </button>
                              <input value={opt.text} onChange={e => updateQuestion(q.id, { options: q.options.map((o, idx) => idx === oi ? { ...o, text: e.target.value } : o) })} placeholder={`Opsi ${String.fromCharCode(65+oi)}`} className="flex-1 bg-transparent outline-none" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="relative">
                          <textarea value={q.feedbackCorrect} onChange={e => updateQuestion(q.id, { feedbackCorrect: e.target.value })} placeholder="✨ Feedback jika benar" rows={2} className="w-full p-3 bg-green-50 border border-green-100 rounded-xl outline-none pr-10" />
                          <button onClick={() => generateFeedbackForQuestion(q)} disabled={generatingFeedback === q.id} className="absolute bottom-3 right-3 p-1.5 bg-green-500 text-white rounded-lg text-xs">
                            {generatingFeedback === q.id ? '⏳' : '✨'}
                          </button>
                        </div>
                        <textarea value={q.feedbackWrong} onChange={e => updateQuestion(q.id, { feedbackWrong: e.target.value })} placeholder="💡 Feedback jika salah" rows={2} className="w-full p-3 bg-orange-50 border border-orange-100 rounded-xl outline-none" />
                      </div>

                      <div className="flex justify-end">
                        <select value={q.difficulty} onChange={e => updateQuestion(q.id, { difficulty: e.target.value })} className="px-3 py-1.5 bg-slate-50 rounded-lg text-sm">
                          <option value="easy">📘 Mudah</option>
                          <option value="medium">📙 Sedang</option>
                          <option value="hard">📕 Sulit</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {questions.length === 0 && (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
                  <div className="text-5xl mb-3">📝</div>
                  <p className="text-slate-500">Belum ada soal. Klik tombol di atas untuk menambah soal.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-xl font-bold mb-4">Preview Soal</h3>
            {questions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">Belum ada soal</div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={q.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">{i+1}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">{q.type === 'pilihan_ganda' ? 'PG' : 'Esai'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getDifficultyColor(q.difficulty)}`}>
                            {q.difficulty === 'easy' ? 'Mudah' : q.difficulty === 'medium' ? 'Sedang' : 'Sulit'}
                          </span>
                          <span className="text-xs text-slate-500">{q.points} poin</span>
                        </div>
                        <p className="text-slate-700 font-medium">{q.text}</p>
                        <p className="text-sm text-green-600 mt-1">✓ {q.correctAnswer}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !aiLoading && setShowAIModal(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
              <div className="relative p-6 space-y-5">
                <div className="text-center">
                  <div className={`w-16 h-16 bg-${currentSubject.bg.replace('bg-', '')} text-${currentSubject.text.replace('text-', '')} rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3`}>
                    {currentSubject.icon}
                  </div>
                  <h3 className="text-xl font-bold">Generate Soal dengan AI</h3>
                  <p className="text-slate-500 text-sm">Pilih konfigurasi, AI akan buat soal + feedback otomatis</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">📚 Mata Pelajaran</label>
                    <div className="grid grid-cols-2 gap-2">
                      {subjects.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setAiConfig({...aiConfig, subject: aiConfig.subject === s.id ? null : s.id})}
                          className={`p-2 rounded-xl text-sm font-medium transition-all border ${aiConfig.subject === s.id ? `${s.bg} ${s.text} border-${s.color}-300 shadow-sm` : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                        >
                          {s.icon} {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">🎓 Kelas</label>
                    <select value={aiConfig.gradeLevel} onChange={e => setAiConfig({...aiConfig, gradeLevel: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-indigo-500">
                      {[1,2,3,4,5,6].map(g => <option key={g} value={g}>Kelas {g} SD</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">📖 Topik <span className="text-slate-400 font-normal italic">(Bisa kosong jika Mapel dipilih)</span></label>
                    <input
                      type="text"
                      value={aiConfig.topic}
                      onChange={e => setAiConfig({...aiConfig, topic: e.target.value})}
                      placeholder="Contoh: Perkalian, Ekosistem, dll"
                      className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">⚡ Kesulitan</label>
                    <select value={aiConfig.difficulty} onChange={e => setAiConfig({...aiConfig, difficulty: e.target.value})} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-indigo-500">
                      <option value="easy">Mudah</option>
                      <option value="medium">Sedang</option>
                      <option value="hard">Sulit</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">📊 Jumlah Soal</label>
                    <input type="number" value={aiConfig.count} onChange={e => setAiConfig({...aiConfig, count: Math.min(15, Math.max(1, parseInt(e.target.value) || 5))})} min={1} max={15} className="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-indigo-500" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">📝 Tipe Soal</label>
                    <div className="flex gap-2">
                      {['multiple_choice', 'essay'].map(t => (
                        <button key={t} onClick={() => setAiConfig({...aiConfig, types: aiConfig.types.includes(t) ? aiConfig.types.filter(x => x !== t) : [...aiConfig.types, t]})} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${aiConfig.types.includes(t) ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                          {t === 'multiple_choice' ? '📋 PG' : '✍️ Isian'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button onClick={() => setShowAIModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-all text-slate-600">Batal</button>
                  <button
                    onClick={handleGenerateAI}
                    disabled={aiLoading}
                    className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${aiLoading ? 'bg-slate-400' : `bg-${currentSubject.color}-600 hover:bg-${currentSubject.color}-700`}`}
                  >
                    {aiLoading ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Memproses...</> : '✨ Generate Soal'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherCreateTask;
