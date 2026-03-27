// Playground.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useAI } from '../../hooks/useAI';
import StudentSidebar from '../../components/StudentSidebar';
import BintangAvatar from '../../components/BintangAvatar';

const Playground = () => {
  const { profile } = useAuthStore();
  const { askTutor, getWeakTopics, loading: aiLoading } = useAI();
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState('');
  const [avatarState, setAvatarState] = useState('idle');
  const [weakTopics, setWeakTopics] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef(null);

  // Auto scroll ke pesan terbaru
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    setAvatarState(isTyping ? 'thinking' : 'idle');
  }, [isTyping]);

  useEffect(() => {
    if (profile?.id && !initialized) {
      initChat();
    }
  }, [profile?.id, initialized]);

  const initChat = async () => {
    setIsTyping(true);
    try {
      const { topics } = await getWeakTopics(profile.id);
      setWeakTopics(topics || []);
      const firstName = profile.full_name?.split(' ')[0] || "Teman";

      let welcomeText = `Halo ${firstName}! Kak Bintang siap membantu belajar kamu. Ada yang mau ditanyakan? 😊`;
      if (topics && topics.length > 0) {
        const topicMap = { 
          matematika: 'Matematika 📐', 
          ipa: 'IPA 🔬', 
          ips: 'IPS 🌏', 
          english: 'English 🇬🇧' 
        };
        welcomeText = `Halo ${firstName}! Kak Bintang ingat kamu sempat kesulitan di ${topicMap[topics[0]] || topics[0]}. Mau kita belajar bareng? 😊✨`;
      }

      setMessages([{ 
        role: 'ai', 
        text: welcomeText, 
        id: Date.now(), 
        timestamp: new Date() 
      }]);
      setInitialized(true);
    } catch (error) {
      console.error("Init chat error:", error);
      setMessages([{ 
        role: 'ai', 
        text: "Halo! Kak Bintang siap membantu. Ada pertanyaan?", 
        id: Date.now(), 
        timestamp: new Date() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAskAI = async () => {
    if (!input.trim() || isTyping) return;
    
    const query = input.trim();
    setMessages(prev => [...prev, { 
      role: 'user', 
      text: query, 
      id: Date.now(), 
      timestamp: new Date() 
    }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await askTutor(query, weakTopics);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: response.answer || "Maaf, Kak Bintang sedang berpikir keras. Coba lagi ya!",
        id: Date.now() + 1,
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error("AI request error:", err);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: "Waduh, koneksi Kak Bintang terputus. Coba lagi ya!", 
        id: Date.now() + 2, 
        timestamp: new Date() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <StudentSidebar />

      <main className="flex-1 flex flex-col min-w-0 bg-white relative">
        <header className="h-20 px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <BintangAvatar state={avatarState} size="sm" />
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">BintangAi Tutor</h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isTyping ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {isTyping ? 'Berpikir...' : 'Online'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm('Reset percakapan?')) {
                setMessages([]);
                initChat();
              }
            }}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-tighter">Clear</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth px-4 md:px-8 py-6 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
          <div className="max-w-4xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6 items-end gap-3`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                      <span className="text-sm">🤖</span>
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm md:text-base shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-100 text-slate-700 rounded-bl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <p className={`text-[10px] mt-1 text-slate-400 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <div className="flex items-center gap-2 text-slate-400 text-xs italic ml-11">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
                Kak Bintang sedang mengetik...
              </div>
            )}
            <div ref={scrollRef} className="h-2" />
          </div>
        </div>

        <div className="p-4 md:p-6 bg-white border-t border-slate-100 shrink-0">
          <div className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              placeholder="Tanya apa saja..."
              className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
            <button
              onClick={handleAskAI}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-2 bottom-2 w-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3 font-medium tracking-tight">
            Kak BintangAi • Pendamping Belajar Digital
          </p>
        </div>
      </main>
    </div>
  );
};

export default Playground;