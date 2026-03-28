// pages/student/Modules.jsx — FULL FIXED ACCESSIBILITY VERSION
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import StudentSidebar from '../../components/StudentSidebar';
import AILoadingSkeleton from '../../components/AILoadingSkeleton';
import { useVoice } from '../../hooks/useVoice';
import { useGlobalVoiceNav } from '../../hooks/useGlobalVoiceNav';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';

const StudentModules = () => {
  const { profile } = useAuthStore();
  const { getWeakTopics } = useAI();
  const { showSubtitle } = useSubtitle();
  const { speak, stopSpeaking } = useVoice();

  const [modules, setModules] = useState([]);
  const [recommendedModules, setRecommendedModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [bookmarks, setBookmarks] = useState([]);

  const isBlind = profile?.disability_type === 'tunanetra';
  const isDeaf = profile?.disability_type === 'tunarungu';

  // ── TUNANETRA: Smart Narrator Commands ──
  useGlobalVoiceNav({
    enabled: isBlind,
    onCommand: (t, speakFn) => {
      if (!selectedModule) {
        // navigasi modul by name
        const found = modules.find(m =>
          t.includes(m.title.toLowerCase().slice(0, 10))
        );
        if (found) {
          selectModule(found);
          return 'open_module';
        }
        return null;
      }

      if (t.includes('ringkas') || t.includes('ringkasan') || t.includes('rangkum')) {
        handleSummarize();
        return 'summarize';
      }
      if (t.includes('jelaskan pelan') || t.includes('baca pelan')) {
        speakFn(
          `Membacakan ${selectedModule.title} dengan tempo pelan. ` +
            selectedModule.content,
          0.75
        );
        return 'explain_slow';
      }
      if (t.includes('bacakan') || t.includes('baca materi') || t.includes('ulangi')) {
        readFullModule();
        return 'read_full';
      }
      if (
        t.includes('simpan bagian ini') ||
        t.includes('bookmark') ||
        t.includes('tandai')
      ) {
        handleSaveBookmark();
        return 'bookmark';
      }
      if (t.includes('berhenti') || t.includes('stop baca') || t.includes('diam')) {
        stopSpeaking();
        speakFn('Pembacaan dihentikan.');
        return 'stop';
      }
      if (t.includes('daftar modul') || t.includes('baca daftar')) {
        if (modules.length > 0) {
          speakFn(
            `Tersedia ${modules.length} materi. ` +
              modules
                .slice(0, 5)
                .map((m, i) => `${i + 1}: ${m.title}`)
                .join('. ')
          );
        } else {
          speakFn('Belum ada materi tersedia.');
        }
        return 'list_modules';
      }
      return null;
    }
  });

  useEffect(() => {
    fetchModules();
    if (isBlind) {
      setTimeout(() => {
        speak(
          'Halaman Materi Modul. Pilih modul di daftar kiri untuk mulai belajar. ' +
            'Katakan Daftar Modul untuk mendengar semua judul. ' +
            'Katakan Ringkas untuk mendapatkan ringkasan AI. ' +
            'Katakan Jelaskan Pelan untuk penjelasan lambat.'
        );
      }, 800);
    }
    if (isDeaf) {
      showSubtitle('Halaman Materi Modul. Pilih modul di kiri.', 'info');
    }
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    const { data: allModules } = await supabase
      .from('modules')
      .select('*')
      .order('created_at', { ascending: false });
    if (allModules) setModules(allModules);

    try {
      const { topics } = await getWeakTopics();
      if (topics?.length > 0) {
        const { data: recs } = await supabase
          .from('modules')
          .select('*')
          .overlaps('tags', topics)
          .limit(3);
        if (recs?.length > 0) setRecommendedModules(recs);
      }
    } catch {}
    setLoading(false);
  };

  const selectModule = (m) => {
    setSelectedModule(m);
    setAiResult(m.summary || '');
    if (isBlind) {
      speak(
        `Membuka ${m.title}. ` +
          'Katakan Ringkas untuk ringkasan AI, atau Bacakan untuk membaca seluruh materi.'
      );
    }
    if (isDeaf) showSubtitle(`Membuka: ${m.title}`, 'info');
  };

  const handleSummarize = async () => {
    if (!selectedModule) return;

    // Jika sudah ada ringkasan di db
    if (selectedModule.summary) {
      setAiResult(selectedModule.summary);
      if (isBlind) speak('Ringkasan: ' + selectedModule.summary.slice(0, 500));
      if (isDeaf) showSubtitle('Ringkasan dimuat!', 'success');
      return;
    }

    setAiLoading(true);
    if (isDeaf) showSubtitle('🤖 Kak Bintang sedang meringkas...', 'ai');
    if (isBlind) speak('Sedang membuat ringkasan, mohon tunggu.');

    try {
      // Panggil AI via Supabase edge function
      const { data, error } = await supabase.functions.invoke('ai-tutor', {
        body: {
          message: `Ringkaskan materi berikut dalam 3-5 kalimat mudah dipahami siswa SD: ${selectedModule.content?.slice(0, 2000)}`,
          nama: profile?.full_name?.split(' ')[0] || 'Siswa',
          kelas: profile?.class_level || 4,
          weak_topics: [],
        },
        headers: { 'x-api-key': 'christian' }
      });

      const summaryResult = error
        ? 'Maaf, ringkasan tidak tersedia saat ini.'
        : data?.answer || data?.reply || 'Ringkasan tidak tersedia.';

      setAiResult(summaryResult);

      if (isBlind) speak('Ringkasan selesai: ' + summaryResult);
      if (isDeaf) showSubtitle(summaryResult.slice(0, 150), 'ai');

      // simpan summary ke modul agar tidak perlu generate ulang
      setSelectedModule(prev => ({ ...prev, summary: summaryResult }));
      setModules(prev =>
        prev.map(m => (m.id === selectedModule.id ? { ...m, summary: summaryResult } : m))
      );
    } catch {
      const fallback = 'Maaf, ringkasan tidak tersedia saat ini.';
      setAiResult(fallback);
      if (isBlind) speak(fallback);
    } finally {
      setAiLoading(false);
    }
  };

  const readFullModule = () => {
    if (!selectedModule) return;
    const text = `Materi: ${selectedModule.title}. ${selectedModule.content?.slice(0, 2000)}`;
    speak(text, 1.0);
    if (isDeaf) showSubtitle(`Membaca: ${selectedModule.title}`, 'info');
  };

  const handleSaveBookmark = () => {
    if (!selectedModule) return;
    const bm = {
      id: Date.now(),
      moduleTitle: selectedModule.title,
      timestamp: new Date().toLocaleString('id-ID'),
    };
    setBookmarks(prev => [bm, ...prev]);
    if (isBlind) speak('Bagian ini telah disimpan ke daftar bookmark kamu.');
    if (isDeaf) showSubtitle('📌 Materi di-bookmark!', 'success');
  };

  const handleHover = (text) => {
    if (isBlind) speak(text);
    if (isDeaf) showSubtitle(text.slice(0, 100), 'info');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans selection:bg-indigo-100 pb-12">
      <StudentSidebar />

      {/* TUNANETRA voice hint bar */}
      {isBlind && (
        <div className="fixed top-0 inset-x-0 z-50 bg-indigo-700 text-white text-center py-2 text-xs font-black uppercase tracking-widest">
          🎤 Suara Aktif | Katakan: "Daftar Modul" · "Ringkas" · "Bacakan" · "Jelaskan Pelan" · "Bookmark"
        </div>
      )}

      <main
        className={`flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto h-screen relative ${isBlind ? 'pt-14' : ''}`}
      >
        <header className="mb-14">
          <h2
            className={`font-black text-slate-900 tracking-tight uppercase ${isDeaf ? 'text-4xl' : 'text-3xl'}`}
            onMouseEnter={() => handleHover('Halaman Materi Modul')}
          >
            Materi Modul
          </h2>
          <p className="text-indigo-600 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">
            {isBlind
              ? 'AI Narator Aktif. Katakan "Ringkas", "Bacakan", atau "Jelaskan Pelan"'
              : 'Gunakan asisten AI untuk membantu pemahaman materi.'}
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-10">
          {/* Module list */}
          <div className="lg:col-span-4 space-y-10">
            {recommendedModules.length > 0 && (
              <section
                className="bg-amber-50 p-8 rounded-[2.5rem] border-2 border-amber-100 border-dashed"
                onMouseEnter={() => handleHover('Rekomendasi materi untukmu')}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">✨</span>
                  <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest">
                    Khusus Untukmu
                  </h3>
                </div>
                <div className="space-y-4">
                  {recommendedModules.map(m => (
                    <button
                      key={m.id}
                      onClick={() => selectModule(m)}
                      onMouseEnter={() => handleHover(`Rekomendasi: ${m.title}`)}
                      className="w-full text-left p-5 bg-white rounded-2xl border border-amber-200 hover:border-amber-500 hover:shadow-lg transition-all"
                    >
                      <p className="font-bold text-slate-800 text-sm truncate">{m.title}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="space-y-6">
              <h3
                className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2"
                onMouseEnter={() => handleHover('Daftar semua materi')}
              >
                Semua Materi
              </h3>
              <div className="space-y-3">
                {loading
                  ? [1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="h-20 bg-white rounded-3xl border border-slate-100 animate-pulse"
                      />
                    ))
                  : modules.map(m => (
                      <button
                        key={m.id}
                        onClick={() => selectModule(m)}
                        onMouseEnter={() => handleHover(`Materi: ${m.title}`)}
                        aria-label={`Buka materi: ${m.title}`}
                        className={`w-full text-left p-6 rounded-[2.5rem] border-2 transition-all group ${
                          selectedModule?.id === m.id
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl'
                            : 'bg-white border-slate-50 text-slate-700 hover:border-indigo-100 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                              selectedModule?.id === m.id
                                ? 'bg-white/20'
                                : 'bg-indigo-50 text-indigo-600'
                            }`}
                          >
                            📄
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-black truncate ${isDeaf ? 'text-lg' : 'text-sm'}`}
                            >
                              {m.title}
                            </p>
                            <p
                              className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                                selectedModule?.id === m.id
                                  ? 'text-indigo-200'
                                  : 'text-slate-400'
                              }`}
                            >
                              {m.subject || 'Materi'}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
              </div>
            </div>

            {/* Bookmarks */}
            {bookmarks.length > 0 && (
              <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  📌 Bookmark ({bookmarks.length})
                </h3>
                <div className="space-y-2">
                  {bookmarks.map(bm => (
                    <div key={bm.id} className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {bm.moduleTitle}
                      </p>
                      <p className="text-[10px] text-slate-400">{bm.timestamp}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Module content */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {selectedModule ? (
                <motion.div
                  key={selectedModule.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-8"
                >
                  <div
                    className={`bg-white p-10 md:p-14 rounded-[4rem] border shadow-sm relative ${
                      isDeaf ? 'border-blue-200' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                      <h2
                        className={`font-black text-slate-900 tracking-tight uppercase flex-1 ${
                          isDeaf ? 'text-4xl' : 'text-2xl'
                        }`}
                        onMouseEnter={() => handleHover(selectedModule.title)}
                      >
                        {selectedModule.title}
                      </h2>
                      <div className="flex gap-3 flex-wrap">
                        <button
                          onClick={handleSummarize}
                          disabled={aiLoading}
                          aria-label="Ringkas materi dengan AI"
                          onMouseEnter={() => handleHover('Tombol ringkas materi dengan AI')}
                          className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50"
                        >
                          {aiLoading ? '🔄 Proses...' : '✨ Ringkas AI'}
                        </button>
                        <button
                          onClick={readFullModule}
                          aria-label="Bacakan seluruh materi"
                          onMouseEnter={() => handleHover('Tombol bacakan seluruh materi')}
                          className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                        >
                          🔊 Bacakan
                        </button>
                        <button
                          onClick={handleSaveBookmark}
                          aria-label="Simpan bookmark"
                          onMouseEnter={() => handleHover('Tombol simpan bookmark')}
                          className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all"
                          title="Simpan bagian ini"
                        >
                          📌
                        </button>
                        <button
                          onClick={stopSpeaking}
                          aria-label="Stop pembacaan"
                          onMouseEnter={() => handleHover('Tombol stop pembacaan')}
                          className="p-4 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl hover:bg-rose-100 transition-all"
                          title="Stop pembacaan"
                        >
                          ⏹
                        </button>
                      </div>
                    </div>

                    <div
                      className={`prose prose-indigo max-w-none text-slate-600 font-bold leading-relaxed whitespace-pre-wrap h-[550px] overflow-y-auto pr-6 ${
                        isDeaf ? 'text-2xl space-y-10' : 'text-base'
                      }`}
                    >
                      {selectedModule.content?.split('\n\n').map((para, i) => (
                        <p
                          key={i}
                          className={isDeaf ? 'border-l-8 border-blue-100 pl-8 mb-10' : 'mb-4'}
                          onMouseEnter={() => handleHover(para.slice(0, 100))}
                        >
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* AI Result */}
                  {(aiLoading || aiResult) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-600 p-12 rounded-[4rem] text-white shadow-2xl"
                    >
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">
                          🤖
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-80">
                          Ringkasan Pintar Kak Bintang
                        </h3>
                      </div>
                      {aiLoading ? (
                        <AILoadingSkeleton />
                      ) : (
                        <div
                          className={`font-black leading-relaxed italic ${
                            isDeaf ? 'text-3xl' : 'text-xl'
                          }`}
                          onMouseEnter={() => handleHover('Ringkasan AI: ' + aiResult.slice(0, 100))}
                        >
                          {aiResult}
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-16 bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
                  <div className="w-28 h-28 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-10 animate-bounce">
                    📖
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase">
                    Pilih Materimu
                  </h3>
                  <p className="text-slate-400 font-bold mt-4 max-w-xs mx-auto text-xs uppercase tracking-widest">
                    {isBlind
                      ? 'Katakan "Daftar Modul" untuk mendengar pilihan materi.'
                      : 'Klik judul di sebelah kiri untuk mulai belajar.'}
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentModules;