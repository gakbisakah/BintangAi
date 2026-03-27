import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import StudentSidebar from '../../components/StudentSidebar';
import AILoadingSkeleton from '../../components/AILoadingSkeleton';
import { useVoice } from '../../hooks/useVoice';

const StudentModules = () => {
  const { profile } = useAuthStore();
  const { summarize, getWeakTopics } = useAI();
  const [modules, setModules] = useState([]);
  const [recommendedModules, setRecommendedModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const { speak, startListening, stopListening, isListening } = useVoice();

  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const paragraphs = selectedModule?.content?.split('\n\n').filter(p => p.trim() !== '') || [];

  const isBlind = profile?.disability_type === 'tunanetra';
  const isTunarungu = profile?.disability_type === 'tunarungu';

  useEffect(() => {
    fetchModules();
    if (isBlind) {
        speak("Halaman Materi Modul. Gunakan mikrofon untuk mencari atau membaca modul.");
    }
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    const { data: allModules } = await supabase.from('modules').select('*').order('created_at', { ascending: false });
    if (allModules) setModules(allModules);

    try {
      const { topics } = await getWeakTopics();
      if (topics && topics.length > 0) {
        const { data: recs } = await supabase
          .from('modules')
          .select('*')
          .overlaps('tags', topics)
          .limit(3);

        if (recs && recs.length > 0) {
          setRecommendedModules(recs);
        }
      }
    } catch (e) {
      console.warn("Gagal fetch rekomendasi:", e);
    }
    setLoading(false);
  };

  const handleSummarize = async () => {
    if (!selectedModule) return;
    if (selectedModule.summary) {
      setAiResult(selectedModule.summary);
      if (isBlind) speak("Berikut adalah ringkasan modul ini: " + selectedModule.summary);
      return;
    }
    setAiLoading(true);
    try {
      const summaryResult = await summarize(selectedModule.content);
      setAiResult(summaryResult);
      if (isBlind) speak("Ringkasan berhasil dibuat: " + summaryResult);
      await supabase.from('modules').update({ summary: summaryResult }).eq('id', selectedModule.id);
      setSelectedModule({ ...selectedModule, summary: summaryResult });
    } catch (err) {
      console.error("Summarize error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const readFullModule = () => {
    if (!selectedModule) return;
    speak(`Membacakan modul: ${selectedModule.title}. ${selectedModule.content}`);
  };

  const handleVoiceCommand = (transcript) => {
    const command = transcript.toLowerCase();
    if (command.includes('baca modul') || command.includes('bacakan')) {
      readFullModule();
    } else if (command.includes('ringkas') || command.includes('rangkum')) {
      handleSummarize();
    } else if (command.includes('cari modul')) {
        speak('Sebutkan judul modul yang ingin dicari.');
    } else {
        const found = modules.find(m => command.includes(m.title.toLowerCase()));
        if (found) {
            setSelectedModule(found);
            speak(`Membuka modul ${found.title}. Katakan baca modul untuk mendengarkan isinya.`);
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

      <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto custom-scrollbar h-screen">
        <header className="mb-12">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight" onMouseEnter={() => handleHover('Materi Pelajaran')}>Materi Pelajaran</h2>
          <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">
            Pilih modul dan gunakan AI untuk merangkum materi.
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
            {recommendedModules.length > 0 && (
              <section className="bg-indigo-50/50 p-6 rounded-[3rem] border border-indigo-100 border-dashed" onMouseEnter={() => handleHover('Modul yang disarankan untukmu')}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">✨</span>
                  <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Disarankan Untukmu</h3>
                </div>
                <div className="space-y-3">
                  {recommendedModules.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModule(m);
                        setCurrentParagraphIndex(0);
                        setAiResult(m.summary || '');
                      }}
                      onMouseEnter={() => handleHover(`Modul rekomendasi: ${m.title}`)}
                      className="w-full text-left p-4 bg-white rounded-2xl border border-indigo-100 hover:border-indigo-500 hover:shadow-md transition-all group"
                    >
                      <p className="font-bold text-slate-800 text-xs truncate group-hover:text-indigo-600">{m.title}</p>
                      <div className="flex gap-1 mt-2">
                        {m.tags?.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-[8px] font-black rounded-lg uppercase">{tag}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-4" onMouseEnter={() => handleHover('Semua Modul')}>Semua Modul</h3>
              <div className="space-y-3">
                {loading ? (
                  [1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-3xl border border-slate-100 animate-pulse" />)
                ) : (
                  modules.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModule(m);
                        setCurrentParagraphIndex(0);
                        setAiResult(m.summary || '');
                      }}
                      onMouseEnter={() => handleHover(`Modul: ${m.title}`)}
                      className={`w-full text-left p-6 rounded-[2.5rem] border-2 transition-all duration-300 group ${
                        selectedModule?.id === m.id
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                        : 'bg-white border-slate-50 text-slate-700 hover:border-indigo-100 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-colors ${selectedModule?.id === m.id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                          📄
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black tracking-tight truncate text-sm">{m.title}</p>
                          <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${selectedModule?.id === m.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                             Materi {m.subject || 'Umum'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {selectedModule ? (
                <motion.div
                  key={selectedModule.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-100 shadow-sm relative">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight flex-1 uppercase" onMouseEnter={() => handleHover(`Judul modul: ${selectedModule.title}`)}>{selectedModule.title}</h2>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSummarize}
                          disabled={aiLoading}
                          onMouseEnter={() => handleHover('Tombol Ringkas AI')}
                          className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                          {aiLoading ? '🔄 Meringkas...' : '✨ Ringkas AI'}
                        </button>
                        {isBlind && (
                            <button
                                onClick={readFullModule}
                                onMouseEnter={() => handleHover('Tombol Bacakan Modul')}
                                className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl"
                            >
                                🔊 Baca Semua
                            </button>
                        )}
                      </div>
                    </div>

                    <div
                        className={`prose prose-indigo max-w-none text-slate-600 font-bold leading-relaxed whitespace-pre-wrap h-[500px] overflow-y-auto pr-4 custom-scrollbar ${isTunarungu ? 'text-lg space-y-8' : 'text-sm'}`}
                        onMouseEnter={() => handleHover('Isi modul. Kamu bisa meminta saya membacakannya.')}
                    >
                      {paragraphs.map((para, idx) => (
                        <motion.p
                          key={idx}
                          className={`p-4 rounded-xl transition-all ${isTunarungu ? 'border-l-4 border-indigo-200 pl-6 mb-8' : ''}`}
                        >
                          {para}
                        </motion.p>
                      ))}
                    </div>

                    {selectedModule.pdf_url && (
                      <div className="mt-8 pt-8 border-t border-slate-50">
                        <a
                          href={selectedModule.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          onMouseEnter={() => handleHover('Tautan dokumen asli PDF')}
                          className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-2 uppercase tracking-widest"
                        >
                          📥 Lihat Dokumen Asli (PDF)
                        </a>
                      </div>
                    )}
                  </div>

                  {(aiLoading || aiResult) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-indigo-600 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden"
                      onMouseEnter={() => handleHover('Hasil ringkasan dari asisten AI.')}
                    >
                      <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl">🤖</div>
                          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">Ringkasan BintangAi</h3>
                        </div>

                        {aiLoading ? (
                          <AILoadingSkeleton />
                        ) : (
                          <div className={`font-bold leading-relaxed whitespace-pre-wrap italic ${isTunarungu ? 'text-xl' : 'text-base'}`}>
                            {aiResult}
                          </div>
                        )}
                      </div>
                      <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-[4rem] border border-slate-100 shadow-sm border-dashed">
                  <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8">📖</div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pilih Modul</h3>
                  <p className="text-slate-400 font-bold mt-2 max-w-xs mx-auto text-xs uppercase tracking-widest">Klik salah satu judul di samping.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="mt-24 py-10 border-t border-slate-100 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-80">
            @2026 BintangAi. Developed for Inclusive Education.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default StudentModules;
