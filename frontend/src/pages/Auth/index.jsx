import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('siswa');
  const [disabilityType, setDisabilityType] = useState('tidak_ada');
  const [slbName, setSlbName] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [classCode, setClassCode] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(null);
  const [studentIdInput, setStudentIdInput] = useState('');

  const navigate = useNavigate();
  const { setUser, setProfile, fetchProfile } = useAuthStore();

  useEffect(() => {
    setMessage(null);
  }, [isLogin]);

  useEffect(() => {
    if (role !== 'siswa') {
      setDisabilityType('tidak_ada');
    }
    setSlbName('');
    setClassLevel('');
    setClassCode('');
    setSubject('');
  }, [role]);

  const validateEmail = (email) => email.toLowerCase().trim().endsWith('@gmail.com');

  const generateClassCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const cleanEmail = email.toLowerCase().trim();

    if (!validateEmail(cleanEmail)) {
      const errMsg = "Gunakan email @gmail.com";
      setMessage(errMsg);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });

        if (error) throw new Error("Email atau kata sandi salah");

        setUser(data.user);
        const profileData = await fetchProfile(data.user.id);

        if (!profileData) {
            const metadata = data.user.user_metadata || {};
            const fallbackProfile = {
                id: data.user.id,
                full_name: metadata.full_name || cleanEmail.split('@')[0],
                role: metadata.role || 'siswa',
                disability_type: metadata.disability_type || 'tidak_ada',
                slb_name: metadata.slb_name || '',
                class_level: metadata.class_level || '',
                class_code: metadata.class_code || '',
                subject: metadata.subject || '',
                xp: 0
            };
            setProfile(fallbackProfile);
            navigate(fallbackProfile.role === 'guru' ? '/teacher/dashboard' : fallbackProfile.role === 'ortu' ? '/parent/dashboard' : '/student/dashboard');
        } else {
            const targetPath = profileData.role === 'guru' ? '/teacher/dashboard' :
                               profileData.role === 'ortu' ? '/parent/dashboard' :
                               '/student/dashboard';
            navigate(targetPath);
        }

      } else {
        let linkedId = null;
        let finalClassCode = classCode;
        let finalSlbName = slbName;
        let finalClassLevel = classLevel;

        if (role === 'ortu') {
          if (!studentIdInput) throw new Error("ID Siswa tidak boleh kosong");
          const { data: child, error: childError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', studentIdInput.trim())
            .maybeSingle();

          if (childError || !child) throw new Error("ID Siswa tidak ditemukan!");
          linkedId = child.id;
        }

        if (role === 'guru') {
          finalClassCode = generateClassCode();
          if (!slbName) throw new Error("Nama SLB wajib diisi untuk Guru");
          if (!classLevel) throw new Error("Kelas yang diampu wajib diisi untuk Guru");
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              full_name: fullName,
              role,
              disability_type: disabilityType,
              slb_name: finalSlbName,
              class_level: finalClassLevel,
              class_code: finalClassCode,
              subject: subject,
              linked_student_id: linkedId
            }
          }
        });

        if (error) throw new Error(error.message);

        if (data.user) {
          setMessage(role === 'guru' ? `Daftar berhasil! Kode Kelas Anda: ${finalClassCode}` : "Daftar berhasil! Silakan masuk.");
          setIsLogin(true);
        }
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const subjects = [
    "Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS", "Seni Budaya", "PJOK", "Lainnya"
  ];

  const classLevels = ["1 SD", "2 SD", "3 SD", "4 SD", "5 SD", "6 SD"];

  const labelStyles = "text-sm font-bold text-slate-700 mb-2 block ml-1 tracking-tight";
  const inputStyles = "w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/5 outline-none font-semibold transition-all text-slate-900 placeholder:text-slate-400 shadow-sm";

  return (
    <div className="min-h-screen flex font-sans bg-[#F8FAFC] selection:bg-indigo-100">
      {/* Left Side: Branding & Info */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url("https://images.pexels.com/photos/1586981/pexels-photo-1586981.jpeg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-white/20 z-10 backdrop-blur-[2px]" />

        <div className="relative z-20 w-full flex flex-col justify-between p-16">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-4 cursor-pointer group w-fit"
          >
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30 group-hover:scale-110 transition-all duration-500">
              <span className="text-white font-black text-3xl">B</span>
            </div>
            <span className="text-3xl font-black tracking-tight text-slate-900">
              Bintang<span className="text-indigo-600">Ai</span>
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-xl"
          >
            <div
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold mb-8 uppercase tracking-wider bg-indigo-600 text-white shadow-xl shadow-indigo-600/20"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Platform Belajar Inklusif
            </div>
            <h2 className="text-6xl font-black mb-8 leading-[1.1] text-slate-900 tracking-tight">
              Platform course berbasis <span className="text-indigo-600">AI</span> untuk anak <span className="text-indigo-600">Istimewa</span>.
            </h2>
            <p className="text-xl font-medium text-slate-700 leading-relaxed">
              Belajar mandiri dengan visual adaptif, dan bimbingan AI yang memahami kebutuhan setiap bintang.
            </p>
          </motion.div>

          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            © 2026 BINTANGAI • EMPOWERING INCLUSIVITY
          </div>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-slate-50">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
              {isLogin ? 'Selamat Datang Kembali' : 'Bergabung Bersama Kami'}
            </h1>
            <p className="text-slate-500 font-medium text-lg">
              {isLogin ? 'Masuk untuk melanjutkan petualangan' : 'Mulai perjalanan belajarmu hari ini'}
            </p>
          </div>

          <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full -mr-20 -mt-20 opacity-40 blur-2xl" />

            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`mb-8 p-5 rounded-2xl text-sm font-bold text-center ${
                    message.includes('berhasil') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}
                >
                  {message}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleAuth} className="space-y-6 relative z-10">
              {!isLogin && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div>
                    <label className={labelStyles}>Nama Lengkap 👤</label>
                    <input
                      type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className={inputStyles} placeholder="Masukkan nama lengkap Anda"
                    />
                  </div>

                  <div>
                    <label className={labelStyles}>Peran Belajar 🎓</label>
                    <select
                      value={role} onChange={(e) => setRole(e.target.value)}
                      className={inputStyles}
                    >
                      <option value="siswa">Siswa Istimewa</option>
                      <option value="guru">Guru Pembimbing</option>
                      <option value="ortu">Orang Tua</option>
                    </select>
                  </div>

                  {role === 'guru' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <label className={labelStyles}>Nama Sekolah (SLB) 🏫</label>
                      <input
                        type="text" required value={slbName} onChange={(e) => setSlbName(e.target.value)}
                        className={inputStyles} placeholder="Contoh: SLB Negeri 1 Jakarta"
                      />
                    </motion.div>
                  )}

                  {role === 'siswa' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div>
                        <label className={labelStyles}>Kebutuhan Khusus ✨</label>
                        <select
                          value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)}
                          className={inputStyles}
                        >
                          <option value="tidak_ada">Umum / Tanpa Hambatan</option>
                          <option value="tunanetra">Tunanetra (Hambatan Penglihatan)</option>
                          <option value="tunarungu">Tunarungu (Hambatan Pendengaran)</option>
                          <option value="tunawicara">Tunawicara (Hambatan Bicara)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelStyles}>Kode Kelas dari Guru 🔑</label>
                        <input
                          type="text" required value={classCode} onChange={(e) => setClassCode(e.target.value)}
                          className={inputStyles} placeholder="Masukkan 6 digit kode kelas"
                        />
                      </div>
                    </motion.div>
                  )}

                  {role === 'guru' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelStyles}>Kelas 📖</label>
                        <select
                          value={classLevel} onChange={(e) => setClassLevel(e.target.value)}
                          className={inputStyles} required
                        >
                          <option value="">Pilih Kelas</option>
                          {classLevels.map(cl => <option key={cl} value={cl}>{cl}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelStyles}>Mapel 🎯</label>
                        <select
                          value={subject} onChange={(e) => setSubject(e.target.value)}
                          className={inputStyles} required
                        >
                          <option value="">Pilih Mapel</option>
                          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              <div>
                <label className={labelStyles}>Alamat Email ✉️</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className={inputStyles} placeholder="nama@gmail.com"
                />
              </div>

              <div className="relative">
                <label className={labelStyles}>Kata Sandi 🔒</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                    className={inputStyles} placeholder="Minimal 8 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-2"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {role === 'ortu' && !isLogin && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className={labelStyles}>ID Unik Siswa (Anak) 🔗</label>
                  <input
                    type="text" required value={studentIdInput} onChange={(e) => setStudentIdInput(e.target.value)}
                    className={inputStyles} placeholder="Tempel ID profil anak Anda"
                  />
                </motion.div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-5 bg-indigo-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 mt-6"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </div>
                ) : (isLogin ? 'Masuk Sekarang' : 'Daftar Akun')}
              </button>
            </form>

            <div className="mt-10 text-center border-t border-slate-100 pt-8">
              <p className="text-slate-500 font-medium mb-2">
                {isLogin ? 'Belum punya akun?' : 'Sudah memiliki akun?'}
              </p>
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
              >
                {isLogin ? 'Buat Akun Baru Gratis' : 'Masuk ke Akun Anda'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
