// pages/student/Playground.jsx — FULL FIXED ACCESSIBILITY VERSION WITH VOICE TO TEXT
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import StudentSidebar from '../../components/StudentSidebar';
import BintangAvatar from '../../components/BintangAvatar';
import { useAccessibility } from '../../hooks/useAccessibility';
import { useVoiceCommandTunanetra } from '../../hooks/useVoiceCommandTunanetra';
import { useSubtitle } from '../../components/DeafSubtitleOverlay';
import { useVoice } from '../../hooks/useVoice';

const Playground = () => {
  const { profile } = useAuthStore();
  const { askTutor, getWeakTopics, loading: aiLoading } = useAI();
  const { isBlind, isDeaf, isMute } = useAccessibility();
  const { showSubtitle } = useSubtitle();
  const { speak } = useVoice(); // Use for TTS only

  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [avatarState, setAvatarState] = useState('idle');
  const [weakTopics, setWeakTopics] = useState([]);
  const [initialized, setInitialized] = useState(false);

  // Real-time voice state
  const [liveText, setLiveText] = useState('');
  const scrollRef = useRef(null);

  const handleVoiceAction = (command, text) => {
    if (command === 'ok') {
      const cleanQuery = text.replace(/\b(ok|oke|kirim|selesai|mantap)\b/gi, '').trim();
      if (cleanQuery.length > 2) {
        handleAskAI(cleanQuery);
      }
      stopListening();
    }
  };

  const {
    isListening,
    startListening,
    stopListening,
    interimTranscript,
    transcript
  } = useVoiceCommandTunanetra({
    onCommand: handleVoiceAction,
    onTranscript: (text, isFinal) => {
      setLiveText(text);
    },
    onListeningChange: (listening) => {
      if (!listening && liveText.length > 2) {
        // Logic handled by onCommand for 'ok'
      }
    }
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'ai') {
        if (isBlind) speak(last.text);
        if (isDeaf) showSubtitle(last.text.slice(0, 200), 'ai');
      }
    }
  }, [messages]);

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

      let welcome = `Halo ${name}! Kak Bintang siap membantu belajar kamu. `;
      if (topics?.length > 0) {
        welcome += `Kak Bintang ingat kamu sempat kesulitan di topik ${topics[0]}. Mau kita bahas bareng? 😊✨`;
      } else {
        welcome += `Ada yang mau ditanyakan? Aku siap bantu! 😊`;
      }

      if (isBlind) {
        welcome += ' Tekan tombol mikrofon ungu di tengah layar untuk bertanya. Katakan OK jika sudah selesai bicara.';
      }

      const msg = { role: 'ai', text: welcome, id: Date.now(), timestamp: new Date() };
      setMessages([msg]);
      setInitialized(true);

      if (isBlind) setTimeout(() => speak(welcome), 600);
    } catch {
      setMessages([{ role: 'ai', text: 'Halo! Kak Bintang siap membantu.', id: Date.now(), timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAskAI = async (forcedInput) => {
    const query = (forcedInput || input).trim();
    if (!query || isTyping) return;

    setMessages(prev => [...prev, { role: 'user', text: query, id: Date.now(), timestamp: new Date() }]);
    setInput('');
    setIsTyping(true);
    setAvatarState('thinking');

    try {
      const response = await askTutor(query, weakTopics);
      const answer = response.answer || 'Maaf, Kak Bintang sedang istirahat sebentar.';
      setMessages(prev => [...prev, { role: 'ai', text: answer, id: Date.now() + 1, timestamp: new Date() }]);
      setAvatarState('happy');
      setTimeout(() => setAvatarState('idle'), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <StudentSidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden">
        {/* Header */}
        <header className="border-b border-slate-100 px-6 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10 h-20">
          <div className="flex items-center gap-3">
            <BintangAvatar state={avatarState} size="sm" />
            <div>
              <h1 className="font-bold text-slate-800 text-lg">BintangAi Tutor</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px]">
                  {isTyping ? 'Berpikir...' : 'Online'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isBlind && (
              <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase">
                🎤 Mode Suara Aktif
              </div>
            )}
          </div>
        </header>

        {/* Live Subtitle Box for Blind (Tampil saat merekam) */}
        {isBlind && isListening && (
          <div className="bg-indigo-600 px-6 py-6 shadow-xl z-20 flex flex-col items-center gap-4 transition-all duration-500 border-b-4 border-indigo-800">
            <div className="flex items-center gap-4">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                <span className="relative block w-4 h-4 rounded-full bg-red-600" />
              </div>
              <p className="text-lg font-black text-white uppercase tracking-widest">
                🔴 Mendengarkan... Bicara sekarang. Katakan "OK" untuk mengirim
              </p>
            </div>

            <div className="w-full max-w-3xl bg-black/30 backdrop-blur-lg rounded-[2rem] p-8 border-2 border-white/30 shadow-inner">
              <p className="text-3xl font-bold text-center text-white leading-relaxed">
                {liveText || 'Menunggu suara...'}
              </p>
            </div>
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
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6 items-end gap-3`}
                >
                  {msg.role === 'ai' && (
                    <div className="rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100 w-8 h-8">
                      <span className="text-sm">🤖</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div
                      className={`rounded-2xl shadow-sm ${
                        msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-700 rounded-bl-none'
                      } px-4 py-3 text-sm md:text-base`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={scrollRef} className="h-2" />
          </div>
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-slate-100 p-6 md:p-8 shrink-0">
          {isBlind ? (
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
              <button
                onClick={isListening ? stopListening : startListening}
                className={`w-36 h-36 rounded-full flex flex-col items-center justify-center text-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-all duration-300 ${
                  isListening ? 'bg-red-500 scale-110' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105'
                }`}
              >
                {isListening ? (
                  <div className="flex flex-col items-center gap-1">
                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    <span className="text-xs font-black uppercase">Berhenti</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <svg className="w-16 h-16" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                    </svg>
                    <span className="text-xs font-black uppercase">Tekan Bicara</span>
                  </div>
                )}
              </button>
              <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] text-center">
                {isListening ? 'SEDANG MENDENGARKAN...' : 'Klik tombol di atas untuk bertanya'}
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto relative">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                placeholder="Tanya apa saja tentang pelajaranmu..."
                className="w-full pl-6 pr-16 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
              />
              <button
                onClick={() => handleAskAI()}
                disabled={!input.trim() || aiLoading}
                className="absolute right-3 top-3 bottom-3 w-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Playground;
