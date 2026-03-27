import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import TeacherSidebar from '../../components/TeacherSidebar';
import StudentSidebar from '../../components/StudentSidebar';
import ParentSidebar from '../../components/ParentSidebar';
import { useVoice } from '../../hooks/useVoice';

const Profile = () => {
  const { profile, logout, setProfile } = useAuthStore();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(profile?.role === 'guru' ? 'identitas' : profile?.role === 'ortu' ? 'link' : 'aksesibilitas');

  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [showId, setShowId] = useState(false);
  const { speak, startListening, stopListening, isListening } = useVoice();

  const isBlind = profile?.role === 'siswa' && profile?.disability_type === 'tunanetra';

  useEffect(() => {
    if (profile?.id) {
      const fetchLatestProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.id)
          .single();

        if (data && !error) {
          setProfile(data);
        }
      };

      fetchLatestProfile();
    }
    if (isBlind) {
        speak("Halaman Profil. Kamu bisa melihat informasi akun dan mengatur keamanan.");
    }
  }, [profile?.id, setProfile]);

  const handleLinkStudent = async () => {
    if (!studentIdInput || !studentPassword) return;
    setSaving(true);
    try {
      const { data: student, error: stError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', studentIdInput)
        .eq('role', 'siswa')
        .single();

      if (stError || !student) throw new Error("ID Siswa tidak ditemukan");

      const { error } = await supabase
        .from('profiles')
        .update({
          linked_student_id: student.id,
          student_password_hash: studentPassword
        })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile({ ...profile, linked_student_id: student.id });
      setMessage({ type: 'success', text: 'Berhasil Dihubungkan! 🎉' });
      setTimeout(() => navigate('/parent/dashboard'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
        const msg = 'Password minimal 6 karakter';
        setMessage({ type: 'error', text: msg });
        if (isBlind) speak(msg);
        return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      const msg = 'Password berhasil diubah!';
      setMessage({ type: 'success', text: msg });
      if (isBlind) speak(msg);
      setNewPassword('');
    } else {
      setMessage({ type: 'error', text: error.message });
      if (isBlind) speak(error.message);
    }
    setSaving(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert("ID Berhasil Disalin!");
    if (isBlind) speak("ID Berhasil Disalin.");
  };

  const handleVoiceCommand = (transcript) => {
    const command = transcript.toLowerCase();
    if (command.includes('beranda') || command.includes('dashboard')) {
        speak('Membuka Beranda');
        navigate('/student/dashboard');
    } else if (command.includes('keluar') || command.includes('logout')) {
        speak('Mengeluarkan akun.');
        logout();
        navigate('/auth');
    } else if (command.includes('keamanan')) {
        setActiveTab('keamanan');
        speak('Membuka tab keamanan.');
    } else if (command.includes('informasi') || command.includes('identitas')) {
        setActiveTab('aksesibilitas');
        speak('Membuka tab informasi profil.');
    }
  };

  const toggleMic = () => {
    if (isListening) stopListening();
    else startListening(handleVoiceCommand);
  };

  const handleHover = (text) => {
    if (isBlind) speak(text);
  };

  const tabs = profile?.role === 'ortu'
    ? [{ id: 'link', label: 'Hubungkan Anak', icon: '🔗' }, { id: 'keamanan', label: 'Keamanan', icon: '🔐' }]
    : profile?.role === 'guru'
    ? [{ id: 'identitas', label: 'Profil Guru', icon: '👨‍🏫' }, { id: 'keamanan', label: 'Keamanan', icon: '🛡️' }]
    : [
        { id: 'aksesibilitas', label: 'Profil Siswa', icon: '♿' },
        { id: 'id_siswa', label: 'ID Siswa', icon: '🆔' },
        { id: 'keamanan', label: 'Keamanan', icon: '🔐' }
      ];

  const renderContent = () => {
    return (
      <AnimatePresence mode="wait">
        {(activeTab === 'identitas' || activeTab === 'aksesibilitas') && (
          <motion.div
            key="identitas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-8 md:p-12 rounded-3xl border border-slate-100 shadow-sm space-y-8"
          >
             <div>
               <h3 className="text-xl font-bold text-slate-900 tracking-tight" onMouseEnter={() => handleHover('Informasi Profil')}>Informasi Profil</h3>
               <p className="text-sm text-slate-500 mt-1">Data identitas Anda di platform BintangAi.</p>
             </div>

             <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900" onMouseEnter={() => handleHover(`Nama lengkap: ${profile?.full_name}`)}>
                    {profile?.full_name}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nama SLB / Sekolah</label>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900" onMouseEnter={() => handleHover(`Nama sekolah: ${profile?.slb_name || 'Tidak ada'}`)}>
                    {profile?.slb_name || '-'}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    {profile?.role === 'guru' ? 'Kelas Diampu' : 'Kelas'}
                  </label>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900" onMouseEnter={() => handleHover(`Kelas: ${profile?.class_level || 'Tidak ada'}`)}>
                    {profile?.class_level || '-'}
                  </div>
                </div>

                {profile?.role === 'guru' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Kode Kelas (Siswa)</label>
                      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl font-bold text-indigo-600 flex justify-between items-center">
                        <span className="font-mono text-lg">{profile?.class_code}</span>
                        <button onClick={() => copyToClipboard(profile?.class_code)} className="text-xs underline">Salin</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mata Pelajaran</label>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900">
                        {profile?.subject || '-'}
                      </div>
                    </div>
                  </>
                )}

                {profile?.role === 'siswa' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Jenis Disabilitas</label>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 capitalize" onMouseEnter={() => handleHover(`Jenis disabilitas: ${profile?.disability_type?.replace('_', ' ') || 'Tidak ada'}`)}>
                        {profile?.disability_type?.replace('_', ' ') || '-'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Total XP</label>
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl font-bold text-amber-600" onMouseEnter={() => handleHover(`Total XP: ${profile?.xp || 0}`)}>
                        ✨ {profile?.xp || 0} XP
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Peran Akun</label>
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl font-bold text-indigo-600 capitalize" onMouseEnter={() => handleHover(`Peran akun: ${profile?.role}`)}>
                    {profile?.role} BintangAi
                  </div>
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === 'keamanan' && (
          <motion.div
            key="keamanan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-8 md:p-12 rounded-3xl border border-slate-100 shadow-sm space-y-8"
          >
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">🛡️</div>
               <div>
                 <h3 className="text-xl font-bold text-slate-900 tracking-tight" onMouseEnter={() => handleHover('Keamanan Akun')}>Keamanan Akun</h3>
                 <p className="text-sm text-slate-500">Kelola kata sandi dan akses akun Anda.</p>
               </div>
             </div>

             <div className="space-y-6 max-w-md pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password Baru</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    onMouseEnter={() => handleHover('Kotak masukkan password baru.')}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  />
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={saving}
                  onMouseEnter={() => handleHover('Tombol perbarui password.')}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? 'Memproses...' : 'Perbarui Password'}
                </button>
             </div>

             {message && (
                <p className={`text-sm font-bold ${message.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {message.text}
                </p>
             )}

             <div className="pt-10 border-t border-slate-100">
                <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex items-center justify-between gap-4" onMouseEnter={() => handleHover('Bagian untuk keluar akun.')}>
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Keluar Sesi</h4>
                    <p className="text-xs text-rose-600 font-medium">Akhiri sesi Anda di perangkat ini.</p>
                  </div>
                  <button
                    onClick={() => { logout(); navigate('/auth'); }}
                    onMouseEnter={() => handleHover('Tombol logout.')}
                    className="px-6 py-2.5 bg-rose-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-rose-700 transition-all"
                  >
                    Logout
                  </button>
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === 'id_siswa' && profile?.role === 'siswa' && (
          <motion.div
            key="id_siswa"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center space-y-8"
          >
             <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto">🆔</div>
             <div onMouseEnter={() => handleHover('ID Unik Siswa. Berikan kode ini kepada Orang Tua.')}>
               <h3 className="text-xl font-bold text-slate-900 tracking-tight uppercase">ID Unik Siswa</h3>
               <p className="text-slate-400 font-medium mt-2">Berikan kode ini kepada Orang Tua untuk menghubungkan akun.</p>
             </div>

             <div className="p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-6">
                <code className="text-xl md:text-2xl font-bold text-indigo-600 tracking-wider break-all block">
                  {showId ? profile.id : "••••••••-••••-••••-••••"}
                </code>
                <div className="flex justify-center gap-3">
                   <button
                    onClick={() => setShowId(!showId)}
                    onMouseEnter={() => handleHover('Tombol lihat ID.')}
                    className="px-6 py-2.5 bg-white text-slate-600 rounded-xl font-bold text-xs border border-slate-200 hover:bg-slate-50 transition-all"
                   >
                      {showId ? 'Sembunyikan' : 'Lihat'}
                   </button>
                   <button
                    onClick={() => copyToClipboard(profile.id)}
                    onMouseEnter={() => handleHover('Tombol salin ID.')}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                   >
                      Salin ID
                   </button>
                </div>
             </div>
          </motion.div>
        )}

        {activeTab === 'link' && profile?.role === 'ortu' && (
          <motion.div
            key="link"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 md:p-12 rounded-3xl border border-slate-100 shadow-sm space-y-8"
          >
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">🔗</div>
               <div>
                 <h3 className="text-xl font-bold text-slate-900 tracking-tight">Hubungkan Akun Anak</h3>
                 <p className="text-sm text-slate-500">Pantau perkembangan belajar anak dengan menghubungkan akun.</p>
               </div>
             </div>

             <div className="space-y-6 max-w-md pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">ID Unik Siswa</label>
                  <input
                    type="text"
                    value={studentIdInput}
                    onChange={e => setStudentIdInput(e.target.value)}
                    placeholder="Masukkan ID anak..."
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password Akun Anak</label>
                  <input
                    type="password"
                    value={studentPassword}
                    onChange={e => setStudentPassword(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    placeholder="Konfirmasi password anak"
                  />
                </div>
                <button
                  onClick={handleLinkStudent}
                  disabled={saving}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? 'Menghubungkan...' : 'Hubungkan Sekarang'}
                </button>
                {message && <p className={`text-center font-bold text-sm ${message.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`}>{message.text}</p>}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  if (profile?.role === 'guru' || profile?.role === 'siswa' || profile?.role === 'ortu') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex font-sans selection:bg-indigo-100">
        {profile.role === 'guru' ? <TeacherSidebar /> : profile.role === 'siswa' ? <StudentSidebar /> : <ParentSidebar />}

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

        <main className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto h-screen">
          <header className="mb-12">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight" onMouseEnter={() => handleHover('Pengaturan Profil')}>Pengaturan Profil</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Kelola identitas dan keamanan akun Anda.</p>
          </header>

          <div className="flex gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl w-fit mb-10 shadow-sm overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={() => handleHover(`Tab ${tab.label}`)}
                className={`whitespace-nowrap px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-w-4xl">
            {renderContent()}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <button onClick={() => { logout(); navigate('/auth'); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold">
        Session Expired - Kembali Masuk
      </button>
    </div>
  );
};

export default Profile;
