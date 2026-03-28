// pages/student/Playground.jsx — FULL FIXED ACCESSIBILITY VERSION
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import StudentSidebar from '../../components/StudentSidebar';
import BintangAvatar from '../../components/BintangAvatar';
import { useVoice } from '../../hooks/useVoice';
import { useGlobalVoiceNav } from '../../hooks/useGlobalVoiceNav';
import { useGestureControl } from '../../hooks/useGestureControl';
import GestureCameraOverlay from '../../components/GestureCameraOverlay';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';

const Playground = () => {
  const { profile } = useAuthStore();
  const { askTutor, getWeakTopics, loading: aiLoading } = useAI();
  const { speak, startListening, stopListening, isListening } = useVoice();
  const { showSubtitle } = useSubtitle();

  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [avatarState, setAvatarState] = useState('idle');
  const [weakTopics, setWeakTopics] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const [voiceInputActive, setVoiceInputActive] = useState(false);
  const scrollRef = useRef(null);

  const isBlind = profile?.disability_type === 'tunanetra';
  const isDeaf = profile?.disability_type === 'tunarungu';
  const isMute = profile?.disability_type === 'tunawicara';

  // ── TUNANETRA: voice commands ──
  useGlobalVoiceNav({
    enabled: isBlind,
    onCommand: (t, speakFn) => {
      // "Tanya ..." or "kirim ..."
      const sendPhrases = ['kirim ', 'tanya ', 'pertanyaan ', 'jelaskan ', 'apa itu ', 'bagaimana '];
      for (const phrase of sendPhrases) {
        if (t.startsWith(phrase)) {
          const question = t.slice(phrase.length).trim();
          if (question.length > 2) {
            handleAskAI(question);
            return 'send';
          }
        }
      }
      // "baca jawaban" → baca jawaban AI terakhir
      if (t.includes('baca jawaban') || t.includes('dengarkan') || t.includes('ulang jawaban')) {
        const lastAI = [...messages].reverse().find(m => m.role === 'ai');
        if (lastAI) speakFn(lastAI.text);
        else speakFn('Belum ada jawaban dari AI.');
        return 'read_answer';
      }
      // "hapus" or "reset"
      if (t.includes('hapus') || t.includes('reset') || t.includes('mulai ulang')) {
        setMessages([]);
        setInitialized(false);
        speakFn('Percakapan direset.');
        return 'reset';
      }
      return null;
    }
  });

  // ── TUNAWICARA: Gesture commands ──
  const { videoRef, canvasRef, isActive: camActive, gestureLabel, lastGesture } =
    useGestureControl({
      enabled: isMute,
      onGesture: (gesture, action, text) => {
        if (action === 'ask_ai' || gesture === 'point_up') {
          const msg = 'Saya ingin bertanya tentang materi ini';
          handleAskAI(msg);
          showSubtitle(`☝️ Mengirim: "${msg}"`, 'ai');
        }
        if (action === 'dont_know' || gesture === 'fist') {
          const msg = 'Saya tidak paham. Bisa dijelaskan dengan cara lain?';
          handleAskAI(msg);
          showSubtitle(`✊ Tidak paham → mengirim pertanyaan`, 'warning');
        }
        if (action === 'confirm' || gesture === 'thumbs_up') {
          const msg = 'Terima kasih! Saya mengerti sekarang';
          handleAskAI(msg);
          showSubtitle(`👍 Mengerti → memberi konfirmasi`, 'success');
        }
        if (gesture === 'thumbs_down') {
          const msg = 'Saya tidak setuju atau ada yang salah';
          handleAskAI(msg);
          showSubtitle(`👎 Tidak setuju`, 'warning');
        }
        if (gesture === 'open_hand') {
          showSubtitle('✋ Tahan — stop', 'info');
        }
      }
    });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'ai') {
        if (isBlind) setTimeout(() => speak(last.text), 400);
        if (isDeaf) showSubtitle(last.text.slice(0, 200), 'ai');
      }
    }
  }, [messages, isTyping]);

  useEffect(() => {
    setAvatarState(isTyping ? 'thinking' : 'idle');
  }, [isTyping]);

  useEffect(() => {
    if (profile?.id && !initialized) initChat();
  }, [profile?.id, initialized]);

  const initChat = async () => {
    setIsTyping(true);
    try {
      const { topics } = await getWeakTopics(profile.id);
      setWeakTopics(topics || []);
      const name = profile.full_name?.split(' ')[0] || 'Teman';
      const level = Math.floor((profile.xp || 0) / 1000) + 1;

      let welcome = `Halo ${name}! Kak Bintang siap membantu belajar kamu. `;
      if (topics?.length > 0) {
        welcome += `Kak Bintang ingat kamu sempat kesulitan di topik ${topics[0]}. Mau kita bahas bareng? 😊✨`;
      } else {
        welcome += `Ada yang mau ditanyakan? Aku siap bantu! 😊`;
      }

      if (isBlind) {
        welcome +=
          ' Mode suara aktif. Katakan pertanyaanmu dan aku akan menjawab dengan suara.';
      }
      if (isMute) {
        welcome +=
          ' Gunakan gesture untuk berinteraksi: ☝️ untuk bertanya, ✊ jika tidak paham, 👍 jika sudah mengerti.';
      }

      const msg = { role: 'ai', text: welcome, id: Date.now(), timestamp: new Date() };
      setMessages([msg]);
      setInitialized(true);

      if (isBlind) setTimeout(() => speak(welcome), 600);
      if (isDeaf) setTimeout(() => showSubtitle(welcome.slice(0, 150), 'ai'), 500);
    } catch {
      setMessages([
        {
          role: 'ai',
          text: 'Halo! Kak Bintang siap membantu. Ada pertanyaan?',
          id: Date.now(),
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAskAI = async (forcedInput) => {
    const query = (forcedInput || input).trim();
    if (!query || isTyping) return;

    setMessages(prev => [
      ...prev,
      { role: 'user', text: query, id: Date.now(), timestamp: new Date() }
    ]);
    setInput('');
    setIsTyping(true);
    setAvatarState('thinking');

    if (isDeaf) showSubtitle('🤖 Kak Bintang sedang berpikir...', 'ai');
    if (isBlind) speak('Memproses pertanyaanmu...');

    try {
      const response = await askTutor(query, weakTopics);
      const answer =
        response.answer ||
        'Maaf, Kak Bintang sedang istirahat sebentar. Coba lagi ya! 😊';
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: answer, id: Date.now() + 1, timestamp: new Date() }
      ]);
      setAvatarState('happy');
      setTimeout(() => setAvatarState('idle'), 3000);
    } catch {
      const errMsg = 'Waduh, koneksi Kak Bintang terputus. Coba lagi ya!';
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: errMsg, id: Date.now() + 2, timestamp: new Date() }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Voice mic for blind mode
  const handleVoiceMic = () => {
    if (voiceInputActive) {
      stopListening();
      setVoiceInputActive(false);
      speak('Mikrofon dimatikan.');
    } else {
      setVoiceInputActive(true);
      speak('Mikrofon aktif. Bicara sekarang.');
      startListening(transcript => {
        if (transcript) {
          setInput(transcript);
          setTimeout(() => handleAskAI(transcript), 300);
        }
        setVoiceInputActive(false);
      });
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <StudentSidebar />
      {isMute && (
        <GestureCameraOverlay
          videoRef={videoRef}
          canvasRef={canvasRef}
          isActive={camActive}
          gestureLabel={gestureLabel}
          lastGesture={lastGesture}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden">
        {/* Header */}
        <header
          className={`border-b border-slate-100 px-6 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10 ${isDeaf ? 'h-28' : 'h-20'}`}
        >
          <div className="flex items-center gap-3">
            <BintangAvatar state={avatarState} size="sm" />
            <div>
              <h1
                className={`font-bold text-slate-800 leading-tight ${isDeaf ? 'text-2xl' : 'text-lg'}`}
              >
                BintangAi Tutor
              </h1>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isTyping ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                <span
                  className={`font-semibold text-slate-400 uppercase tracking-wider ${isDeaf ? 'text-sm' : 'text-[11px]'}`}
                >
                  {isTyping ? 'Berpikir...' : 'Online'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isBlind && (
              <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase">
                🎤 Mode Suara
              </div>
            )}
            {isDeaf && (
              <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase">
                👁️ Mode Visual
              </div>
            )}
            {isMute && (
              <div className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-black uppercase">
                ✋ Mode Gesture
              </div>
            )}
            <button
              onClick={() => {
                if (window.confirm('Reset percakapan?')) {
                  setMessages([]);
                  setInitialized(false);
                }
              }}
              onMouseEnter={() => isBlind && speak('Tombol hapus percakapan')}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
            >
              <span className="text-xs font-bold uppercase tracking-tighter">Clear</span>
            </button>
          </div>
        </header>

        {/* Mode hint bars */}
        {isBlind && (
          <div className="bg-indigo-50 px-6 py-3 border-b border-indigo-100">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">
              Katakan pertanyaanmu → AI menjawab dengan suara | "Baca Jawaban" | "Reset"
            </p>
          </div>
        )}
        {isMute && (
          <div className="bg-purple-50 px-6 py-3 border-b border-purple-100 flex gap-6">
            <span className="text-xs font-black text-purple-600">
              ☝️ = Ingin Tanya | ✊ = Tidak Paham | 👍 = Mengerti | 👎 = Tidak Setuju
            </span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scroll-smooth px-4 md:px-8 py-6 space-y-6">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  } mb-6 items-end gap-3`}
                >
                  {msg.role === 'ai' && (
                    <div
                      className={`rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 ${
                        isDeaf ? 'w-12 h-12' : 'w-8 h-8'
                      }`}
                    >
                      <span className={isDeaf ? 'text-xl' : 'text-sm'}>🤖</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div
                      className={`rounded-2xl shadow-sm cursor-pointer ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-700 rounded-bl-none'
                      } ${isDeaf ? 'px-6 py-5 text-xl' : 'px-4 py-3 text-sm md:text-base'}`}
                      onClick={() => {
                        if (msg.role === 'ai' && isBlind) speak(msg.text);
                        if (msg.role === 'ai' && isDeaf) showSubtitle(msg.text.slice(0, 200), 'ai');
                      }}
                      onMouseEnter={() => isBlind && speak(msg.text.slice(0, 200))}
                      title={isBlind ? 'Klik untuk diucapkan' : ''}
                    >
                      {msg.text}
                    </div>
                    <p
                      className={`mt-1 text-slate-400 ${
                        msg.role === 'user' ? 'text-right' : 'text-left'
                      } ${isDeaf ? 'text-sm' : 'text-[10px]'}`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <div
                className={`flex items-center gap-2 text-slate-400 italic ml-11 ${
                  isDeaf ? 'text-base' : 'text-xs'
                }`}
              >
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <span
                      key={i}
                      className={`bg-slate-300 rounded-full animate-bounce ${
                        isDeaf ? 'w-3 h-3' : 'w-1.5 h-1.5'
                      }`}
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
                Kak Bintang sedang mengetik...
              </div>
            )}
            <div ref={scrollRef} className="h-2" />
          </div>
        </div>

        {/* Input area */}
        <div
          className={`bg-white border-t border-slate-100 shrink-0 ${isDeaf ? 'p-6' : 'p-4 md:p-6'}`}
        >
          {/* BLIND: big voice button */}
          {isBlind ? (
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
              <button
                onClick={handleVoiceMic}
                aria-label={voiceInputActive ? 'Stop mikrofon' : 'Aktifkan mikrofon'}
                className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-all ${
                  voiceInputActive
                    ? 'bg-rose-500 animate-pulse scale-110'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {voiceInputActive ? (
                  <svg
                    className="w-10 h-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                    />
                  </svg>
                ) : (
                  <svg className="w-10 h-10" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                  </svg>
                )}
              </button>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">
                {voiceInputActive
                  ? '🔴 Mendengarkan... Bicara sekarang'
                  : 'Tekan untuk bertanya dengan suara'}
              </p>
              {input && (
                <div className="bg-indigo-50 px-4 py-2 rounded-xl text-sm font-bold text-indigo-700 max-w-lg text-center">
                  "{input}"
                </div>
              )}
            </div>
          ) : isMute ? (
            /* MUTE: gesture buttons + text fallback */
            <div className="max-w-4xl mx-auto">
              <div className="mb-3 flex gap-3 flex-wrap justify-center">
                {[
                  { g: '☝️', l: 'Ingin Bertanya', msg: 'Saya ingin bertanya tentang materi ini' },
                  { g: '✊', l: 'Tidak Paham', msg: 'Saya tidak paham. Bisa dijelaskan dengan cara lain?' },
                  { g: '👍', l: 'Sudah Mengerti', msg: 'Terima kasih, saya sudah mengerti!' },
                  { g: '👎', l: 'Ada yang Salah', msg: 'Saya rasa ada yang kurang tepat.' },
                ].map(({ g, l, msg: m }) => (
                  <button
                    key={g}
                    onClick={() => handleAskAI(m)}
                    className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-100 rounded-2xl hover:bg-purple-100 transition-all"
                  >
                    <span className="text-2xl">{g}</span>
                    <span className="text-xs font-bold text-purple-700">{l}</span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                  placeholder="Atau ketik pertanyaan di sini..."
                  className={`w-full pl-5 pr-14 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 ${
                    isDeaf ? 'py-6 text-xl' : 'py-4'
                  }`}
                />
                <button
                  onClick={() => handleAskAI()}
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            /* DEFAULT: text input */
            <div className="max-w-4xl mx-auto relative">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                placeholder="Tanya apa saja tentang pelajaranmu..."
                className={`w-full pl-5 pr-14 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 ${
                  isDeaf ? 'py-6 text-xl' : 'py-4'
                }`}
              />
              <button
                onClick={() => handleAskAI()}
                disabled={!input.trim() || isTyping}
                className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-all"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
          )}
          <p
            className={`text-center text-slate-400 mt-3 font-medium ${
              isDeaf ? 'text-sm' : 'text-[10px]'
            }`}
          >
            Kak BintangAi • Pendamping Belajar Digital
          </p>
        </div>
      </main>
    </div>
  );
};

export default Playground;