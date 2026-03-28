// pages/Profile.jsx — FULL FIXED ACCESSIBILITY VERSION
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import TeacherSidebar from '../../components/TeacherSidebar';
import StudentSidebar from '../../components/StudentSidebar';
import ParentSidebar from '../../components/ParentSidebar';
import { useVoice } from '../../hooks/useVoice';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';
import { useGlobalVoiceNav } from '../../hooks/useGlobalVoiceNav';

const Profile = () => {
  const { profile, logout, setProfile } = useAuthStore();
  const navigate = useNavigate();
  const { speak, startListening, stopListening, isListening } = useVoice();
  const { showSubtitle } = useSubtitle();

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(
    profile?.role === 'guru'
      ? 'identitas'
      : profile?.role === 'ortu'
      ? 'link'
      : 'aksesibilitas'
  );

  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(null);

  const isBlind = profile?.role === 'siswa' && profile?.disability_type === 'tunanetra';
  const isDeaf = profile?.role === 'siswa' && profile?.disability_type === 'tunarungu';
  const isMute = profile?.role === 'siswa' && profile?.disability_type === 'tunawicara';

  // ── Accessibility Settings ──
  const [accSettings, setAccSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('accessibility_settings');
      return saved
        ? JSON.parse(saved)
        : {
            autoMode: true,
            voiceSpeed: 1.0,
            gestureSensitivity: 0.7,
            subtitleSize: 'medium',
            highContrast: false,
            fontSize: 100,
          };
    } catch {
      return {
        autoMode: true,
        voiceSpeed: 1.0,
        gestureSensitivity: 0.7,
        subtitleSize: 'medium',
        highContrast: false,
        fontSize: 100,
      };
    }
  });

  // ── Voice commands (blind) ──
  useGlobalVoiceNav({
    enabled: isBlind,
    onCommand: (t, speakFn) => {
      if (t.includes('keamanan') || t.includes('ganti password')) {
        setActiveTab('keamanan');
        speakFn('Membuka tab keamanan.');
        return 'tab_security';
      }
      if (t.includes('informasi') || t.includes('identitas') || t.includes('profil saya')) {
        setActiveTab('aksesibilitas');
        speakFn('Membuka tab profil.');
        return 'tab_profile';
      }
      if (t.includes('aksesibilitas') || t.includes('pengaturan akses')) {
        setActiveTab('pengaturan_akses');
        speakFn('Membuka tab pengaturan aksesibilitas.');
        return 'tab_access';
      }
      if (t.includes('id siswa') || t.includes('id akun')) {
        setActiveTab('id_siswa');
        speakFn('Membuka tab ID siswa.');
        return 'tab_id';
      }
      if (t.includes('keluar') || t.includes('logout')) {
        speakFn('Mengeluarkan akun.');
        logout();
        navigate('/auth');
        return 'logout';
      }
      if (t.includes('baca id') || t.includes('bacakan id')) {
        speakFn(`ID kamu adalah: ${profile?.id}`);
        return 'read_id';
      }
      return null;
    }
  });

  useEffect(() => {
    if (profile?.id) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single()
        .then(({ data, error }) => {
          if (data && !error) setProfile(data);
        });
    }

    if (isBlind) {
      setTimeout(
        () =>
          speak(
            'Halaman Profil. Tab tersedia: Profil Siswa, Pengaturan Akses, ID Siswa, Keamanan. ' +
              'Katakan nama tab untuk beralih.'
          ),
        700
      );
    }
    if (isDeaf) {
      showSubtitle('Halaman Profil. Atur preferensi visual kamu di sini.', 'info');
    }
  }, [profile?.id]);

  // Apply font size to root
  useEffect(() => {
    document.documentElement.style.fontSize = `${accSettings.fontSize}%`;
    if (accSettings.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [accSettings.fontSize, accSettings.highContrast]);

  const saveAccSettings = (newSettings) => {
    setAccSettings(newSettings);
    localStorage.setItem('accessibility_settings', JSON.stringify(newSettings));
    if (isBlind) speak('Pengaturan berhasil disimpan.');
    if (isDeaf) showSubtitle('Pengaturan disimpan! ✅', 'success');
  };

  const handleLinkStudent = async () => {
    if (!studentIdInput || !studentPassword) {
      setMessage({ type: 'error', text: 'ID Siswa dan password tidak boleh kosong.' });
      return;
    }
    setSaving(true);
    try {
      const { data: student, error: stError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', studentIdInput)
        .eq('role', 'siswa')
        .single();
      if (stError || !student) throw new Error('ID Siswa tidak ditemukan');

      const { error } = await supabase
        .from('profiles')
        .update({ linked_student_id: student.id, student_password_hash: studentPassword })
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
      if (isDeaf) showSubtitle('Password berhasil diubah! 🔐', 'success');
      setNewPassword('');
    } else {
      setMessage({ type: 'error', text: error.message });
      if (isBlind) speak(error.message);
    }
    setSaving(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      if (isBlind) speak('ID Berhasil Disalin.');
      else setMessage({ type: 'success', text: 'ID berhasil disalin!' });
    });
  };

  const handleHover = (text) => {
    if (isBlind) speak(text);
    if (isDeaf) showSubtitle(text.slice(0, 100), 'info');
  };

  const tabs =
    profile?.role === 'ortu'
      ? [
          { id: 'link', label: 'Hubungkan Anak', icon: '🔗' },
          { id: 'keamanan', label: 'Keamanan', icon: '🔐' },
        ]
      : profile?.role === 'guru'
      ? [
          { id: 'identitas', label: 'Profil Guru', icon: '👨‍🏫' },
          { id: 'keamanan', label: 'Keamanan', icon: '🛡️' },
        ]
      : [
          { id: 'aksesibilitas', label: 'Profil Siswa', icon: '👤' },
          { id: 'pengaturan_akses', label: 'Pengaturan Akses', icon: '⚙️' },
          { id: 'id_siswa', label: 'ID Siswa', icon: '🆔' },
          { id: 'keamanan', label: 'Keamanan', icon: '🔐' },
        ];

  const inputClass =
    'w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {profile?.role === 'guru' ? (
        <TeacherSidebar />
      ) : profile?.role === 'ortu' ? (
        <ParentSidebar />
      ) : (
        <StudentSidebar />
      )}

      <main className="flex-1 p-6 md:p-14 overflow-y-auto h-screen relative">
        {/* BLIND hint */}
        {isBlind && (
          <div className="mb-6 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest">
            🎤 Katakan: "Profil Saya" · "Pengaturan Akses" · "ID Siswa" · "Keamanan" · "Keluar"
          </div>
        )}

        <header className="mb-14 flex items-center justify-between">
          <div onMouseEnter={() => handleHover('Halaman Profil Pengguna')}>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">
              Profil Saya
            </h2>
            <p className="text-indigo-600 font-bold mt-2 uppercase text-[10px] tracking-[0.2em]">
              Atur akun dan preferensi aksesibilitas Anda.
            </p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/auth');
            }}
            onMouseEnter={() => handleHover('Tombol Keluar Akun')}
            aria-label="Keluar dari akun"
            className="px-8 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-rose-100 hover:bg-rose-600 hover:text-white transition-all"
          >
            Keluar
          </button>
        </header>

        {message && (
          <div
            className={`mb-6 p-4 rounded-2xl text-sm font-black text-center ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-rose-50 text-rose-700 border border-rose-100'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-10">
          {/* Tab list */}
          <aside className="lg:col-span-3 space-y-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  handleHover(`Tab ${tab.label} aktif`);
                }}
                onMouseEnter={() => handleHover(`Tab ${tab.label}`)}
                aria-label={`Tab ${tab.label}`}
                className={`w-full flex items-center gap-4 px-6 py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xl translate-x-2'
                    : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </aside>

          {/* Tab content */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              {/* ─── Profil Siswa ─── */}
              {activeTab === 'aksesibilitas' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-100 shadow-sm space-y-12"
                >
                  <div onMouseEnter={() => handleHover('Informasi Dasar Profil')}>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      Identitas Diri
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                      Data yang terdaftar di platform BintangAi.
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-10">
                    {[
                      { label: 'Nama Lengkap', value: profile?.full_name },
                      { label: 'Sekolah', value: profile?.slb_name || '-' },
                      { label: 'Kelas', value: profile?.class_level || '-' },
                      {
                        label: 'Jenis Disabilitas',
                        value: profile?.disability_type?.replace('_', ' ') || '-',
                        extra: 'capitalize',
                      },
                      {
                        label: 'Poin Belajar',
                        value: `⭐ ${profile?.xp || 0} XP`,
                        color: 'text-amber-500',
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="space-y-3"
                        onMouseEnter={() => handleHover(`${item.label}: ${item.value}`)}
                      >
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          {item.label}
                        </label>
                        <div
                          className={`p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-black text-slate-800 ${item.extra || ''} ${item.color || ''}`}
                        >
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─── Pengaturan Akses ─── */}
              {activeTab === 'pengaturan_akses' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-100 shadow-sm space-y-12"
                >
                  <div onMouseEnter={() => handleHover('Pengaturan Fitur Aksesibilitas')}>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      Preferensi Akses
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                      Sesuaikan bagaimana BintangAi membantu belajarmu.
                    </p>
                  </div>

                  <div className="space-y-10 max-w-2xl">
                    {/* Auto Mode */}
                    <div
                      className="flex items-center justify-between p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100"
                      onMouseEnter={() =>
                        handleHover(
                          `Mode Akses Otomatis: ${accSettings.autoMode ? 'aktif' : 'nonaktif'}`
                        )
                      }
                    >
                      <div>
                        <p className="font-black text-slate-800 text-sm uppercase tracking-tight">
                          Mode Akses Otomatis
                        </p>
                        <p className="text-xs font-bold text-indigo-600/70">
                          Fitur bantuan langsung aktif saat login.
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          saveAccSettings({ ...accSettings, autoMode: !accSettings.autoMode })
                        }
                        aria-label={`Mode otomatis: ${accSettings.autoMode ? 'aktif' : 'nonaktif'}`}
                        className={`w-16 h-9 rounded-full transition-all relative ${
                          accSettings.autoMode ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`absolute top-1.5 w-6 h-6 bg-white rounded-full transition-all ${
                            accSettings.autoMode ? 'left-8' : 'left-1.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* High Contrast */}
                    <div
                      className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100"
                      onMouseEnter={() => handleHover('Toggle mode kontras tinggi')}
                    >
                      <div>
                        <p className="font-black text-slate-800 text-sm uppercase tracking-tight">
                          Kontras Tinggi
                        </p>
                        <p className="text-xs font-bold text-slate-500/70">
                          Tampilan hitam-kuning untuk visibilitas maksimal.
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          saveAccSettings({
                            ...accSettings,
                            highContrast: !accSettings.highContrast,
                          })
                        }
                        className={`w-16 h-9 rounded-full transition-all relative ${
                          accSettings.highContrast ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`absolute top-1.5 w-6 h-6 bg-white rounded-full transition-all ${
                            accSettings.highContrast ? 'left-8' : 'left-1.5'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Voice Speed */}
                    <div
                      className="space-y-4"
                      onMouseEnter={() =>
                        handleHover(
                          `Kecepatan suara saat ini: ${accSettings.voiceSpeed} kali lipat`
                        )
                      }
                    >
                      <div className="flex justify-between items-center px-1">
                        <label className="font-black text-slate-800 text-xs uppercase tracking-widest">
                          Kecepatan Suara
                        </label>
                        <span className="text-indigo-600 font-black">
                          {accSettings.voiceSpeed}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={accSettings.voiceSpeed}
                        onChange={e =>
                          saveAccSettings({
                            ...accSettings,
                            voiceSpeed: parseFloat(e.target.value),
                          })
                        }
                        aria-label="Kecepatan suara"
                        className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
                        <span>0.5x (Lambat)</span>
                        <span>1.0x (Normal)</span>
                        <span>2.0x (Cepat)</span>
                      </div>
                    </div>

                    {/* Font Size */}
                    <div
                      className="space-y-4"
                      onMouseEnter={() =>
                        handleHover(`Ukuran font saat ini: ${accSettings.fontSize} persen`)
                      }
                    >
                      <div className="flex justify-between items-center px-1">
                        <label className="font-black text-slate-800 text-xs uppercase tracking-widest">
                          Ukuran Teks
                        </label>
                        <span className="text-indigo-600 font-black">{accSettings.fontSize}%</span>
                      </div>
                      <input
                        type="range"
                        min="80"
                        max="150"
                        step="10"
                        value={accSettings.fontSize}
                        onChange={e =>
                          saveAccSettings({
                            ...accSettings,
                            fontSize: parseInt(e.target.value),
                          })
                        }
                        aria-label="Ukuran teks"
                        className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    {/* Gesture Sensitivity */}
                    <div
                      className="space-y-4"
                      onMouseEnter={() =>
                        handleHover(
                          `Sensitivitas gesture: ${Math.round(accSettings.gestureSensitivity * 100)} persen`
                        )
                      }
                    >
                      <div className="flex justify-between items-center px-1">
                        <label className="font-black text-slate-800 text-xs uppercase tracking-widest">
                          Sensitivitas Gesture
                        </label>
                        <span className="text-indigo-600 font-black">
                          {Math.round(accSettings.gestureSensitivity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={accSettings.gestureSensitivity}
                        onChange={e =>
                          saveAccSettings({
                            ...accSettings,
                            gestureSensitivity: parseFloat(e.target.value),
                          })
                        }
                        aria-label="Sensitivitas gesture"
                        className="w-full h-3 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    {/* Subtitle Size */}
                    <div
                      className="space-y-4"
                      onMouseEnter={() => handleHover('Pengaturan ukuran subtitle visual')}
                    >
                      <label className="font-black text-slate-800 text-xs uppercase tracking-widest px-1">
                        Ukuran Subtitle Visual
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        {['small', 'medium', 'large'].map(size => (
                          <button
                            key={size}
                            onClick={() => saveAccSettings({ ...accSettings, subtitleSize: size })}
                            onMouseEnter={() =>
                              handleHover(
                                `Ukuran subtitle ${size === 'small' ? 'kecil' : size === 'medium' ? 'sedang' : 'besar'}`
                              )
                            }
                            className={`py-5 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${
                              accSettings.subtitleSize === size
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl'
                                : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100'
                            }`}
                          >
                            {size === 'small' ? 'Kecil' : size === 'medium' ? 'Sedang' : 'Besar'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── ID Siswa ─── */}
              {activeTab === 'id_siswa' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-100 shadow-sm text-center space-y-8"
                >
                  <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center text-4xl mx-auto mb-4">
                    🆔
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      ID Akun Belajar
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-2">
                      Berikan ID ini kepada Orang Tua agar dapat memantau progresmu.
                    </p>
                  </div>
                  <div
                    className="max-w-md mx-auto p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]"
                    onMouseEnter={() => handleHover(`ID kamu adalah: ${profile?.id}`)}
                  >
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      ID Unik Kamu
                    </p>
                    <p className="text-xl font-black text-indigo-600 tracking-tighter mb-8 break-all select-all">
                      {profile?.id}
                    </p>
                    <button
                      onClick={() => copyToClipboard(profile?.id)}
                      onMouseEnter={() => handleHover('Tombol salin ID akun')}
                      aria-label="Salin ID akun"
                      className="w-full py-5 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-lg"
                    >
                      Salin ID Akun
                    </button>
                  </div>
                  {message && (
                    <p
                      className={`text-xs font-black uppercase ${
                        message.type === 'success' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {message.text}
                    </p>
                  )}
                </motion.div>
              )}

              {/* ─── Profil Guru (identitas) ─── */}
              {activeTab === 'identitas' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-100 shadow-sm space-y-12"
                >
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    Profil Guru
                  </h3>
                  <div className="grid md:grid-cols-2 gap-10">
                    {[
                      { label: 'Nama Lengkap', value: profile?.full_name },
                      { label: 'Sekolah (SLB)', value: profile?.slb_name || '-' },
                      { label: 'Kelas', value: profile?.class_level || '-' },
                      { label: 'Mata Pelajaran', value: profile?.subject || '-' },
                      { label: 'Kode Kelas', value: profile?.class_code || '-', color: 'text-indigo-600' },
                    ].map((item, i) => (
                      <div key={i} className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          {item.label}
                        </label>
                        <div
                          className={`p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-black text-slate-800 ${item.color || ''}`}
                        >
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ─── Hubungkan Anak (ortu) ─── */}
              {activeTab === 'link' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-100 shadow-sm space-y-12"
                >
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      Hubungkan Anak
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                      Masukkan ID siswa untuk memantau perkembangannya.
                    </p>
                  </div>
                  <div className="space-y-8 max-w-md">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        ID Siswa (Anak)
                      </label>
                      <input
                        type="text"
                        value={studentIdInput}
                        onChange={e => setStudentIdInput(e.target.value)}
                        placeholder="Tempel ID profil anak..."
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Password Verifikasi
                      </label>
                      <input
                        type="password"
                        value={studentPassword}
                        onChange={e => setStudentPassword(e.target.value)}
                        placeholder="Password untuk verifikasi..."
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleLinkStudent}
                      disabled={saving}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Menghubungkan...' : 'Hubungkan Akun Anak'}
                    </button>
                    {message && (
                      <p
                        className={`text-xs font-black uppercase text-center ${
                          message.type === 'success' ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {message.text}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── Keamanan ─── */}
              {activeTab === 'keamanan' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-100 shadow-sm space-y-12"
                >
                  <div onMouseEnter={() => handleHover('Pengaturan Keamanan Akun')}>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      Keamanan
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                      Ganti kata sandi untuk menjaga keamanan akunmu.
                    </p>
                  </div>
                  <div className="space-y-8 max-w-md">
                    <div
                      className="space-y-3"
                      onMouseEnter={() => handleHover('Kotak masukkan password baru')}
                    >
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Password Baru
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Minimal 6 karakter..."
                        aria-label="Password baru"
                        className={inputClass}
                      />
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={saving}
                      onMouseEnter={() => handleHover('Tombol perbarui password')}
                      className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Memproses...' : 'Simpan Password Baru'}
                    </button>
                    {message && (
                      <p
                        className={`text-center font-black text-xs uppercase tracking-widest ${
                          message.type === 'error' ? 'text-rose-500' : 'text-emerald-500'
                        }`}
                      >
                        {message.text}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;