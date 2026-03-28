import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import { useVoice } from '../../hooks/useVoice';
import XPBar from '../../components/XPBar';
import StreakBadge from '../../components/StreakBadge';
import ParentSidebar from '../../components/ParentSidebar';

const ParentDashboard = () => {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { speak } = useVoice();
  const [childData, setChildData] = useState(null);
  const [childSubmissions, setChildSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportsList, setReportsList] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const lastSpokenRef = useRef("");

  const activeTab = searchParams.get('tab') || 'overview';

  // 1. Welcome Voice & Panduan
  useEffect(() => {
    if (profile) {
      speak(`Selamat datang Pak atau Ibu ${profile.full_name?.split(' ')[0]}. Anda berada di Dashboard Orang Tua untuk memantau perkembangan ${childData?.full_name || 'anak Anda'}.`);
    }
  }, [profile, childData, speak]);

  // 2. Perbaikan Automatis: Global Hover Reader
  useEffect(() => {
    const handleGlobalHover = (e) => {
      // Mencari elemen yang memiliki teks atau bermakna
      const target = e.target.closest('button, a, h1, h2, h3, h4, p, span, td, .streak-badge, .xp-container');

      if (target) {
        let text = target.ariaLabel || target.title || target.innerText;
        text = text?.trim();

        if (text && text !== lastSpokenRef.current) {
          // Hanya bacakan jika teks berbeda (mencegah spam suara)
          speak(text);
          lastSpokenRef.current = text;
        }
      } else {
        lastSpokenRef.current = "";
      }
    };

    window.addEventListener('mouseover', handleGlobalHover);
    return () => {
      window.removeEventListener('mouseover', handleGlobalHover);
      lastSpokenRef.current = "";
    };
  }, [speak]);

  const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, staggerChildren: 0.1 }
    }
  };

  useEffect(() => {
    if (profile?.linked_student_id) {
      fetchChildData();
      fetchReports();

      const profileChannel = supabase
        .channel(`child-profile-${profile.linked_student_id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.linked_student_id}` },
        (payload) => setChildData(payload.new))
        .subscribe();

      const submissionChannel = supabase
        .channel(`child-submissions-${profile.linked_student_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `student_id=eq.${profile.linked_student_id}` },
        () => fetchChildSubmissions())
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(submissionChannel);
      };
    }
  }, [profile?.linked_student_id]);

  const fetchChildData = async () => {
    setLoading(true);
    try {
      const { data: student } = await supabase.from('profiles').select('*').eq('id', profile.linked_student_id).single();
      if (student) setChildData(student);
      await fetchChildSubmissions();
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchChildSubmissions = async () => {
    const { data: subs } = await supabase.from('submissions').select('*, assignments(title)').eq('student_id', profile.linked_student_id).order('submitted_at', { ascending: false });
    if (subs) setChildSubmissions(subs);
  };

  const fetchReports = async () => {
    setReportLoading(true);
    try {
      const { data, error } = await supabase.from('student_reports').select('*, profiles!teacher_id(full_name)').eq('student_id', profile.linked_student_id).order('created_at', { ascending: false });
      if (!error) setReportsList(data || []);
    } catch (err) { console.error(err); } finally { setReportLoading(false); }
  };

  const handleDownloadPdf = () => window.print();
  const onTabChange = (tabId) => setSearchParams({ tab: tabId });

  if (!profile?.linked_student_id) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-[2rem] shadow-xl text-center border border-slate-200">
           <div className="text-5xl mb-6">🔗</div>
           <h2 className="text-2xl font-bold text-slate-900">Akun Belum Terhubung</h2>
           <p className="text-slate-600 mt-4 mb-8 text-base">Hubungkan profil anak Anda di halaman pengaturan untuk melihat laporan belajar.</p>
           <button onClick={() => navigate('/profile')} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Atur Sekarang</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex font-sans selection:bg-indigo-100">
      <ParentSidebar activeTab={activeTab} onTabChange={onTabChange} />

      <main className="flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto h-screen flex flex-col print:p-0">
        <div className="flex-1 print:hidden">
          <header className="mb-12">
             <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Halo, Pak/Bu {profile?.full_name?.split(' ')[0]}!</h2>
             <p className="text-slate-600 font-medium text-lg mt-2">Memantau progres belajar <span className="text-indigo-600 font-bold">{childData?.full_name}</span></p>
          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" variants={containerVariants} initial="hidden" animate="visible" className="space-y-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                       <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Pencapaian XP</h3>
                       <XPBar current={childData?.xp || 0} nextLevel={1000} level={Math.floor((childData?.xp || 0) / 1000) + 1} />
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                       <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Konsistensi Belajar</h3>
                       <StreakBadge days={childData?.streak || 0} />
                    </div>
                 </div>

                 <section className="bg-slate-900 p-10 rounded-[2.5rem] text-white relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                       <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-3xl shrink-0">🤖</div>
                       <div>
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mb-2">Analisis Sistem BintangAi</h4>
                          <p className="text-xl font-medium leading-relaxed italic text-indigo-50">
                             "{childData?.full_name} saat ini memiliki {childData?.xp || 0} XP. Terus pantau aktivitasnya untuk hasil yang maksimal!"
                          </p>
                       </div>
                    </div>
                 </section>

                 <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-slate-900">Nilai Quiz Terbaru</h3>
                      <button onClick={() => onTabChange('history')} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline">Lihat Semua</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {childSubmissions.slice(0, 3).map((sub) => (
                        <div key={sub.id} className="p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:border-indigo-300 transition-all">
                           <h4 className="font-bold text-slate-800 text-lg leading-snug h-14 line-clamp-2">{sub.assignments?.title}</h4>
                           <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-50">
                              <div>
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Skor</p>
                                <p className="text-4xl font-black text-slate-900">{sub.total_score || 0}</p>
                              </div>
                              <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${sub.total_score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {sub.total_score >= 70 ? 'Berhasil' : 'Remedi'}
                              </span>
                           </div>
                        </div>
                      ))}
                    </div>
                 </section>
              </motion.div>
            )}

            {activeTab === 'reports' && (
              <motion.div key="reports" variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                <h3 className="text-2xl font-bold text-slate-900 mb-8">Arsip Laporan Belajar</h3>
                {reportsList.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {reportsList.map((report) => (
                      <div key={report.id} className="bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 group hover:border-indigo-400 transition-all">
                        <div className="flex items-center gap-6 w-full">
                          <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-indigo-600 group-hover:text-white transition-all">📄</div>
                          <div>
                            <p className="font-bold text-slate-900 text-lg">Laporan {report.report_type}</p>
                            <p className="text-sm text-slate-500 font-semibold mt-1">
                              📅 {new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedReport(report); setShowPdfPreview(true); }}
                          className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition-all"
                        >
                          Buka Laporan
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-500 font-medium">Belum ada laporan dari guru.</div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
             <motion.div key="history" variants={containerVariants} initial="hidden" animate="visible" className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xl font-bold text-slate-900">Riwayat Quiz Lengkap</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-white border-b border-slate-100">
                           <th className="px-8 py-5 font-bold text-sm text-slate-500 uppercase tracking-widest">Judul Materi</th>
                           <th className="px-8 py-5 font-bold text-sm text-slate-500 uppercase tracking-widest text-center">Skor</th>
                           <th className="px-8 py-5 font-bold text-sm text-slate-500 uppercase tracking-widest text-right">Tanggal</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {childSubmissions.map(sub => (
                          <tr key={sub.id} className="hover:bg-indigo-50/30 transition-colors">
                             <td className="px-8 py-6 font-bold text-slate-800 text-base">{sub.assignments?.title}</td>
                             <td className="px-8 py-6 text-center font-black text-2xl text-slate-900">{sub.total_score}</td>
                             <td className="px-8 py-6 text-right text-sm font-bold text-slate-500">
                               {new Date(sub.submitted_at).toLocaleDateString('id-ID')}
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
                </div>
             </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Report Detail Modal */}
        <AnimatePresence>
          {showPdfPreview && selectedReport && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPdfPreview(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col"
              >
                {/* Header Modal */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Laporan {selectedReport.report_type}</h3>
                    <p className="text-slate-500 font-medium mt-1">
                      Oleh Guru: {selectedReport.profiles?.full_name || 'Guru BintangAi'} • {new Date(selectedReport.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPdfPreview(false)}
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* Content Modal */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12">
                  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 whitespace-pre-wrap text-slate-700 leading-relaxed text-lg">
                    {selectedReport.content}
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="p-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/50">
                  <button
                    onClick={handleDownloadPdf}
                    className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cetak Laporan
                  </button>
                  <button
                    onClick={() => setShowPdfPreview(false)}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    Selesai Membaca
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Printable Report (Hidden in UI) */}
        <div className="hidden print:block p-10 bg-white min-h-screen">
          {selectedReport && (
            <div className="max-w-4xl mx-auto">
              <header className="border-b-4 border-indigo-600 pb-8 mb-8 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Laporan Belajar</h1>
                  <p className="text-xl font-bold text-indigo-600">Sistem Kecerdasan BintangAi</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">Tanggal Laporan</p>
                  <p className="text-lg font-bold">{new Date(selectedReport.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </header>

              <section className="grid grid-cols-2 gap-8 mb-12">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nama Siswa</h4>
                  <p className="text-xl font-bold text-slate-900">{childData?.full_name}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Jenis Laporan</h4>
                  <p className="text-xl font-bold text-slate-900">Laporan {selectedReport.report_type}</p>
                </div>
              </section>

              <div className="bg-slate-50 p-10 rounded-[2rem] border border-slate-100 min-h-[500px]">
                <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-widest mb-6 border-b border-indigo-100 pb-4">Analisis & Rekomendasi AI</h3>
                <div className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                  {selectedReport.content}
                </div>
              </div>

              <footer className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center opacity-50">
                <p className="text-xs font-bold">Laporan ini dibuat otomatis oleh BintangAi untuk {profile?.full_name}.</p>
                <p className="text-xs font-bold italic">© 2026 BintangAi</p>
              </footer>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ParentDashboard;
