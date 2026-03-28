import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Landing = () => {
  const navigate = useNavigate();
  const [showAbout, setShowAbout] = useState(false);

  const features = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
        </svg>
      ),
      title: "Voice First",
      desc: "Navigasi dan belajar sepenuhnya menggunakan perintah suara yang natural."
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      ),
      title: "AI Adaptive",
      desc: "Sistem cerdas yang menyesuaikan materi dengan kebutuhan belajar unikmu."
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      title: "Inklusif",
      desc: "Didesain khusus untuk teman-teman dengan berbagai kemampuan aksesibilitas."
    }
  ];

  const philosophy = [
    {
      title: "⭐ “BintangAi” = Suara Setiap Anak Berharga",
      desc: "Setiap anak SLB (tunanetra, tunarungu, tunawicara) memiliki suara dan potensi unik yang perlu didengar dan didukung.",
      highlight: "Memberikan suara bagi mereka yang terbatas dalam komunikasi."
    },
    {
      title: "🌌 Terang Melalui Suara",
      desc: "Relevan untuk Tunanetra & hambatan komunikasi. Walaupun ada keterbatasan, teknologi suara membantu mereka tetap mandiri.",
      highlight: "Suara adalah jendela pengetahuan bagi mereka."
    },
    {
      title: "🤖 AI = Pendamping Cerdas",
      desc: "AI membantu melalui suara (text-to-speech), visual (tunarungu), and komunikasi (tunawicara).",
      highlight: "AI adalah alat bantu setiap anak untuk berkomunikasi dan belajar."
    },
    {
      title: "🎓 BintangAi sebagai Platform",
      desc: "Bukan sekadar materi, tapi platform yang memberikan kepercayaan diri melalui interaksi suara dan AI.",
      highlight: "Setiap pembelajaran adalah langkah menuju kemandirian."
    }
  ];

  const buttonPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100";
  const buttonSecondary = "bg-white text-slate-600 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50";

  return (
    <div className="min-h-screen transition-all duration-300 bg-[#FAFAFA] text-slate-900 selection:bg-indigo-100 font-sans">
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md border-b transition-all duration-300 bg-white/80 border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" title="Logo Bintang Ai">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-indigo-600">
              <span className="font-bold text-xl text-white">B</span>
            </div>
            <span className="text-2xl font-black tracking-tighter text-slate-900">
              Bintang<span className="text-indigo-600">Ai</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/auth')}
              className="text-sm font-bold transition-colors text-slate-600 hover:text-indigo-600"
            >
              Masuk
            </button>
            <button
              onClick={() => navigate('/auth')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${buttonPrimary}`}
            >
              Daftar
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black mb-8 uppercase tracking-widest border transition-colors bg-indigo-50 text-indigo-600 border-indigo-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-indigo-400"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Platform Belajar Inklusif
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 max-w-5xl mx-auto leading-[1.1]">
              Platform course berbasis <span className="text-indigo-600">AI</span> untuk anak <span className="text-indigo-600">Istimewa</span>.
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed font-medium transition-colors text-slate-500">
              Belajar mandiri dengan visual adaptif, dan bimbingan AI yang memahami kebutuhan setiap bintang.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <button
              onClick={() => navigate('/auth')}
              className={`group px-10 py-5 font-black rounded-2xl transition-all flex items-center gap-3 text-lg ${buttonPrimary}`}
            >
              Mulai Belajar Sekarang
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 group-hover:translate-x-1 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
            <button
              onClick={() => setShowAbout(true)}
              className={`px-10 py-5 font-black rounded-2xl transition-all text-lg border ${buttonSecondary}`}
            >
              Tentang Kami
            </button>
          </motion.div>
        </div>

        <div className="absolute top-1/4 left-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-purple-200/20 rounded-full blur-[120px] -z-10"></div>
      </main>

      <section className="py-32 border-y transition-colors duration-300 bg-white border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-16">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group p-10 rounded-[2.5rem] transition-all border border-transparent hover:bg-slate-50 hover:border-slate-100"
              >
                <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform bg-indigo-50 text-indigo-600">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-black mb-6 uppercase tracking-tight">{feature.title}</h3>
                <p className="text-lg leading-relaxed font-medium text-slate-500">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Modal */}
      <AnimatePresence>
        {showAbout && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAbout(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border bg-white text-slate-900"
            >
              <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar">
                <header className="mb-12 text-center">
                  <h2 className="text-3xl font-black uppercase tracking-tight mb-2 text-slate-900">
                    Tentang Bintang<span className="text-indigo-600">Ai</span>
                  </h2>
                  <p className="font-bold uppercase text-[10px] tracking-widest text-slate-400">Filosofi, Alur, dan Peran Pengguna</p>
                </header>

                <div className="space-y-16">
                  {/* Philosophy Section */}
                  <section>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold bg-indigo-600 text-white">⭐</div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Makna BintangAi untuk SLB</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {philosophy.map((item, idx) => (
                        <div key={idx} className="p-6 rounded-3xl border bg-slate-50 border-slate-100">
                          <p className="font-bold mb-2 text-slate-800">{item.title}</p>
                          <p className="text-xs font-medium mb-3 leading-relaxed text-slate-500">{item.desc}</p>
                          <p className="text-[10px] font-bold italic text-indigo-600">👉 {item.highlight}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Workflow Section */}
                  <section>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold bg-indigo-600 text-white">🚀</div>
                      <h3 className="text-xl font-black uppercase tracking-tight">Alur Platform</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[
                        { step: 'Upload', desc: 'Guru mengunggah modul pelajaran (PDF).' },
                        { step: 'Analisis', desc: 'Siswa menggunakan AI untuk memahami materi.' },
                        { step: 'Belajar', desc: 'Tantangan QuizKu dengan panduan AI Tutor.' },
                        { step: 'Pantau', desc: 'Laporan perkembangan untuk Guru & Orang Tua.' }
                      ].map((s, i) => (
                        <div key={i} className="p-5 rounded-2xl border bg-indigo-50/50 border-indigo-100">
                          <p className="font-black text-[10px] uppercase mb-2 text-indigo-600">Tahap {i+1}</p>
                          <p className="font-bold text-sm mb-1 text-slate-800">{s.step}</p>
                          <p className="text-[10px] font-medium leading-relaxed text-slate-500">{s.desc}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="mt-16 text-center">
                  <button
                    onClick={() => setShowAbout(false)}
                    className={`px-12 py-4 font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 ${buttonPrimary}`}
                  >
                    Tutup & Mulai Belajar ✨
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 text-center transition-colors duration-300">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 text-slate-400">
          @2026 BintangAi. Developed oleh Christian Johannes Hutahaean Dan Glen Rejeki Sitorus
        </p>
      </footer>
    </div>
  );
};

export default Landing;
