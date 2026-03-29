import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';

const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

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

  const [aiConfig, setAiConfig] = useState({ subject: 'matematika', gradeLevel: 4, difficulty: 'medium', types: ['multiple_choice'], count: 5, topic: '' });
  const [taskData, setTaskData] = useState({ title: '', description: '', deadlineDate: '', deadlineTime: '', duration: '', isPublic: true, enrollKey: '' });
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (editId) fetchExistingTask();
    else {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      setTaskData(prev => ({ ...prev, deadlineDate: tomorrow.toISOString().split('T')[0], deadlineTime: "23:59" }));
    }
  }, [editId]);

  const fetchExistingTask = async () => {
    setLoading(true);
    try {
      const { data: task } = await supabase.from('assignments').select('*, assignment_questions(*, assignment_question_options(*))').eq('id', editId).single();
      if (task) {
        const d = new Date(task.deadline);
        setTaskData({ title: task.title || '', description: task.description || '', deadlineDate: d.toISOString().split('T')[0], deadlineTime: d.toTimeString().split(' ')[0].slice(0, 5), duration: task.duration_minutes?.toString() || '', isPublic: task.is_public !== false, enrollKey: task.enroll_key || '' });
        const formattedQs = (task.assignment_questions || []).map(q => ({ id: q.id, type: q.question_type, text: q.question_text, points: q.points, correctAnswer: q.rubric_text || q.correct_answer, feedbackCorrect: q.ai_explanation || '', feedbackWrong: q.ai_feedback_wrong || '', difficulty: q.difficulty_level || 'medium', options: (q.assignment_question_options || []).map(o => ({ id: o.id, text: o.option_text, isCorrect: o.is_correct })) }));
        setQuestions(formattedQs);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleGenerateAI = async () => {
    if (!aiConfig.topic.trim() && !aiConfig.subject) return alert("Pilih Mapel atau isi Topik.");
    setAiLoading(true);
    try {
      const selectedSub = subjects.find(s => s.id === aiConfig.subject);
      let finalTopic = aiConfig.topic.trim() || selectedSub?.name || 'Umum';
      const response = await generateAIQuiz({ topic: finalTopic, grade_level: aiConfig.gradeLevel, question_types: aiConfig.types, total_questions: aiConfig.count, difficulty: aiConfig.difficulty, title: taskData.title, instructions: taskData.description, duration_minutes: parseInt(taskData.duration) || 30 });
      if (response?.success && response.quiz) {
        const quiz = response.quiz.quiz || response.quiz;
        setTaskData(prev => ({ ...prev, title: prev.title || quiz.quiz_title || quiz.title, description: prev.description || quiz.instructions, duration: prev.duration || (quiz.duration_minutes || quiz.duration)?.toString() || '30' }));
        const formatted = (quiz.questions || []).map((q) => {
          const isPG = q.type === 'multiple_choice';
          return { id: generateId(), type: isPG ? 'pilihan_ganda' : 'esai', text: q.question || q.text || '', points: q.points || (isPG ? 10 : 20), correctAnswer: isPG ? (q.options && q.correct_answer_index !== undefined ? q.options[q.correct_answer_index] : (q.correctText || '')) : (q.correct_answer || q.correct || ''), feedbackCorrect: q.explanation || q.feedback_correct || '', feedbackWrong: q.feedback_wrong || '', difficulty: aiConfig.difficulty, options: isPG ? (q.options || []).map((opt, i) => ({ id: generateId(), text: opt, isCorrect: i === (q.correct_answer_index ?? q.correct) })) : [] };
        });
        setQuestions(formatted); setShowAIModal(false); alert(`✅ Berhasil!`);
      }
    } catch (err) { alert("Gagal: " + err.message); } finally { setAiLoading(false); }
  };

  const generateFeedbackForQuestion = async (q) => {
    if (!q.correctAnswer) return alert("Isi kunci jawaban dulu");
    setGeneratingFeedback(q.id);
    try {
      const feedback = await generateManualFeedback({ question: q.text, correctAnswer: q.correctAnswer, questionType: q.type });
      if (feedback?.feedback_correct) { updateQuestion(q.id, { feedbackCorrect: feedback.feedback_correct, feedbackWrong: feedback.feedback_wrong || q.feedbackWrong }); alert("✨ Feedback AI berhasil dibuat!"); }
    } catch (err) { alert("Gagal buat feedback"); } finally { setGeneratingFeedback(null); }
  };

  const addQuestion = (type) => { setQuestions([...questions, { id: generateId(), type, text: '', points: type === 'pilihan_ganda' ? 10 : 20, correctAnswer: '', feedbackCorrect: '', feedbackWrong: '', difficulty: 'medium', options: type === 'pilihan_ganda' ? [{ id: generateId(), text: '', isCorrect: false }, { id: generateId(), text: '', isCorrect: false }, { id: generateId(), text: '', isCorrect: false }, { id: generateId(), text: '', isCorrect: false }] : [] }]); };
  const updateQuestion = (id, updates) => { setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q)); };

  const handleSubmit = async () => {
    if (!profile || !profile.id) return alert("Sesi habis.");
    if (!taskData.title.trim()) return alert("Isi judul.");
    if (questions.length === 0) return alert("Tambah soal.");
    setLoading(true);
    try {
      const payload = { title: taskData.title.trim(), description: taskData.description.trim(), deadline: `${taskData.deadlineDate}T${taskData.deadlineTime}:00`, duration_minutes: parseInt(taskData.duration) || null, ai_grading_enabled: true, show_explanation: true, is_public: taskData.isPublic, enroll_key: taskData.isPublic ? null : taskData.enrollKey?.trim(), teacher_id: profile.id };
      let assignmentId = editId;
      if (editId) {
        const { error } = await supabase.from('assignments').update(payload).eq('id', editId); if (error) throw error;
        await supabase.from('assignment_questions').delete().eq('assignment_id', editId);
      } else {
        const { data, error } = await supabase.from('assignments').insert(payload).select().single(); if (error) throw error; assignmentId = data.id;
      }
      for (const q of questions) {
        const { data: insertedQ, error: qErr } = await supabase.from('assignment_questions').insert({ assignment_id: assignmentId, question_type: q.type, question_text: q.text.trim(), points: q.points, ai_explanation: q.feedbackCorrect, ai_feedback_wrong: q.feedbackWrong, difficulty_level: q.difficulty, rubric_text: q.type === 'esai' ? q.correctAnswer : null, correct_answer: q.type === 'pilihan_ganda' ? q.correctAnswer : null }).select().single();
        if (qErr) throw qErr;
        if (q.type === 'pilihan_ganda' && insertedQ) {
          const { error: optErr } = await supabase.from('assignment_question_options').insert(q.options.map((o, i) => ({ question_id: insertedQ.id, option_text: o.text.trim(), is_correct: o.is_correct || o.isCorrect, order_index: i })));
          if (optErr) throw optErr;
        }
      }
      alert("✅ Berhasil!"); navigate('/teacher/dashboard?tab=assignments');
    } catch (err) { alert("Error: " + err.message); } finally { setLoading(false); }
  };

  const getDifficultyColor = (d) => { const map = { easy: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', hard: 'bg-red-100 text-red-700' }; return map[d] || 'bg-gray-100 text-gray-700'; };
  const currentSubject = subjects.find(s => s.id === aiConfig.subject) || { icon: '✨', color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center gap-5">
            <button onClick={() => navigate('/teacher/dashboard')} className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all group"><svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg></button>
            <div><h1 className="text-4xl font-black text-slate-900 tracking-tight">{editId ? 'Edit' : 'Buat'} QuizKu</h1><p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Lengkapi data untuk menerbitkan tugas</p></div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowAIModal(true)} className="px-8 py-4 bg-white border-2 border-indigo-600 text-indigo-600 font-black text-xs uppercase rounded-2xl hover:bg-indigo-50 transition-all flex items-center gap-3"><span>✨</span> AI</button>
            <button onClick={handleSubmit} disabled={loading} className="px-8 py-4 bg-indigo-600 text-white font-black text-xs uppercase rounded-2xl shadow-xl hover:scale-105 transition-all">{loading ? '...' : 'Terbitkan'}</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul QuizKu</label><input type="text" value={taskData.title} onChange={e => setTaskData({...taskData, title: e.target.value})} placeholder="Contoh: Perkalian Dasar" className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] font-bold text-slate-800 outline-none focus:border-indigo-500/20 focus:bg-white transition-all" /></div>
                <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Akses</label>
                  <div className="flex gap-3">
                    <button onClick={() => setTaskData({...taskData, isPublic: true})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase ${taskData.isPublic ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>🌍 Public</button>
                    <button onClick={() => setTaskData({...taskData, isPublic: false})} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase ${!taskData.isPublic ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>🔒 Private</button>
                  </div>
                </div>
              </div>
              <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instruksi</label><textarea value={taskData.description} onChange={e => setTaskData({...taskData, description: e.target.value})} rows={3} placeholder="Berikan petunjuk pengerjaan..." className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] font-bold text-slate-800 outline-none focus:border-indigo-500/20 focus:bg-white transition-all resize-none" /></div>
            </div>

            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id} className="bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 space-y-6 relative group">
                  <div className="flex justify-between items-center"><span className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">{i+1}</span><button onClick={() => setQuestions(questions.filter(x => x.id !== q.id))} className="text-slate-300 hover:text-rose-500 transition-colors">🗑️</button></div>
                  <textarea value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} placeholder="Tuliskan pertanyaan..." className="w-full bg-transparent font-bold text-lg text-slate-800 outline-none resize-none" rows={2} />
                  <input value={q.correctAnswer} onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })} placeholder="Kunci Jawaban" className="w-full p-5 bg-indigo-50/30 border-2 border-indigo-100/50 rounded-2xl font-black text-indigo-600 outline-none" />
                  {q.type === 'pilihan_ganda' && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {q.options.map((opt, oi) => (
                        <div key={opt.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${opt.isCorrect ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-transparent'}`}>
                          <button onClick={() => updateQuestion(q.id, { options: q.options.map((o, idx) => ({ ...o, isCorrect: idx === oi })) })} className={`w-10 h-10 rounded-xl font-black ${opt.isCorrect ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>{String.fromCharCode(65+oi)}</button>
                          <input value={opt.text} onChange={e => updateQuestion(q.id, { options: q.options.map((o, idx) => idx === oi ? { ...o, text: e.target.value } : o) })} placeholder="..." className="bg-transparent font-bold text-slate-700 outline-none w-full" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-4">
                <button onClick={() => addQuestion('pilihan_ganda')} className="flex-1 py-5 bg-white border-2 border-dashed border-slate-200 rounded-[2rem] font-black text-xs uppercase tracking-widest text-slate-400">+ PG</button>
                <button onClick={() => addQuestion('esai')} className="flex-1 py-5 bg-white border-2 border-dashed border-slate-200 rounded-[2rem] font-black text-xs uppercase tracking-widest text-slate-400">+ Isian</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-10 space-y-8 sticky top-6">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Waktu</h4>
              <div className="space-y-6">
                <div className="space-y-3"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Batas</label><input type="date" value={taskData.deadlineDate} onChange={e => setTaskData({...taskData, deadlineDate: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-100" /></div>
                <div className="space-y-3"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Durasi</label><input type="number" value={taskData.duration} onChange={e => setTaskData({...taskData, duration: e.target.value})} placeholder="Menit" className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:border-indigo-100" /></div>
              </div>
              <div className="pt-8 border-t border-slate-50 flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Soal</span><span className="font-black text-slate-900">{questions.length}</span></div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !aiLoading && setShowAIModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden p-8 md:p-10 space-y-6">
              <div className="text-center space-y-2">
                <div className={`w-12 h-12 ${currentSubject.bg} ${currentSubject.text} rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-inner`}>{currentSubject.icon}</div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Generate Soal dengan AI</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pilih konfigurasi, AI akan buat otomatis</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  {subjects.map(s => (
                    <button key={s.id} onClick={() => setAiConfig({...aiConfig, subject: s.id})} className={`p-2.5 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${aiConfig.subject === s.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white border-slate-100 text-slate-400'}`}>{s.name}</button>
                  ))}
                </div>
                <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Kelas</label>
                  <select value={aiConfig.gradeLevel} onChange={e => setAiConfig({...aiConfig, gradeLevel: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none border-none">
                    {[1,2,3,4,5,6].map(g => <option key={g} value={g}>Kelas {g} SD</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Jumlah</label>
                  <input type="number" value={aiConfig.count} onChange={e => setAiConfig({...aiConfig, count: parseInt(e.target.value)})} className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none border-none" />
                </div>
                <div className="col-span-2 space-y-1.5"><label className="text-[8px] font-black text-slate-400 uppercase ml-1">Topik Spesifik</label>
                  <input type="text" value={aiConfig.topic} onChange={e => setAiConfig({...aiConfig, topic: e.target.value})} placeholder="Contoh: Perkalian, Ekosistem, dll" className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none border-none" />
                </div>
                <div className="col-span-2 flex gap-2">
                  {['multiple_choice', 'essay'].map(t => (
                    <button key={t} onClick={() => setAiConfig({...aiConfig, types: aiConfig.types.includes(t) ? aiConfig.types.filter(x => x !== t) : [...aiConfig.types, t]})} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase ${aiConfig.types.includes(t) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{t === 'multiple_choice' ? '📋 PG' : '✍️ Isian'}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAIModal(false)} className="flex-1 py-3.5 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase">Batal</button>
                <button onClick={handleGenerateAI} disabled={aiLoading} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl">{aiLoading ? '...' : 'Generate'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherCreateTask;
