import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

const loadPdfJs = () => {
  return new Promise((resolve) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    document.head.appendChild(script);
  });
};

const TeacherUploadModule = () => {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [enrollKey, setEnrollKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const extractTextFromPdf = async (file) => {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const handleProcess = async () => {
    if (!file || !title) return;
    if (!isPublic && !enrollKey) return alert("Modul Private wajib memiliki Enroll Key.");

    setLoading(true);
    setStep(2);

    try {
      const extractedText = await extractTextFromPdf(file);
      if (!extractedText.trim()) throw new Error("PDF tidak terbaca atau kosong.");

      // Format tags from comma separated string to array
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('modules')
        .upload(`public/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('modules').getPublicUrl(`public/${fileName}`);

      const { error: dbError } = await supabase.from('modules').insert({
        title,
        pdf_url: publicUrl,
        content: extractedText,
        teacher_id: profile.id,
        is_public: isPublic,
        enroll_key: isPublic ? null : enrollKey,
        tags: tagArray // Added tags for Adaptive Recommendation
      });

      if (dbError) throw dbError;
      setStep(3);
    } catch (error) {
      alert('Kesalahan: ' + error.message);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-indigo-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-6 mb-12">
          <button
            onClick={() => navigate('/teacher/dashboard')}
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:text-indigo-600 shadow-sm transition-all"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
             </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Upload Modul</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Materi akan diekstrak dan siap dipelajari siswa.</p>
          </div>
        </header>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 md:p-12">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Judul Modul</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Mengenal Ekosistem Laut"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-2xl font-bold text-slate-900 outline-none transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Tag Topik (Pisahkan dengan koma)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Contoh: perkalian, pecahan, logika"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-2xl font-bold text-slate-900 outline-none transition-all"
                  />
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest ml-2 italic">* Digunakan untuk Rekomendasi Adaptif siswa</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Jenis Akses</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsPublic(true)}
                        className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all border ${isPublic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100'}`}
                      >
                        Public
                      </button>
                      <button
                        onClick={() => setIsPublic(false)}
                        className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all border ${!isPublic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100'}`}
                      >
                        Private
                      </button>
                    </div>
                  </div>
                  {!isPublic && (
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Enroll Key</label>
                      <input
                        type="text"
                        value={enrollKey}
                        onChange={(e) => setEnrollKey(e.target.value)}
                        placeholder="Buat kunci masuk..."
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-2xl font-bold text-slate-900 outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">File Modul (PDF)</label>
                  <div className={`relative group border-2 border-dashed rounded-3xl p-12 text-center transition-all ${file ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-100 hover:border-indigo-100 bg-slate-50/50'}`}>
                    <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm group-hover:scale-110 transition-transform">
                        {file ? '📄' : '📤'}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900">{file ? file.name : 'Pilih atau Seret PDF'}</p>
                        <p className="text-sm font-medium text-slate-400 mt-1">Format PDF, maksimal 10MB</p>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleProcess}
                  disabled={!file || !title || loading}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                   {loading ? 'Memproses...' : 'Upload Modul 🚀'}
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-20 text-center space-y-8"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Memproses Modul...</h2>
                  <p className="text-slate-400 font-medium mt-2 max-w-xs mx-auto">Sistem sedang mengekstrak teks dari PDF agar bisa dibaca AI nanti.</p>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-10 text-center space-y-8"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto">
                  ✅
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Modul Berhasil Diupload!</h2>
                  <p className="text-slate-500 font-medium mt-2">Siswa sekarang sudah bisa membaca dan meringkas materi ini.</p>
                </div>
                <button
                  onClick={() => navigate('/teacher/dashboard?tab=modules')}
                  className="w-full py-5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-lg"
                >
                  Kembali ke Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default TeacherUploadModule;
