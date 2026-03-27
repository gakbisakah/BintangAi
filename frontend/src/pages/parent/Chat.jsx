import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import ParentSidebar from '../../components/ParentSidebar';

const ParentChat = () => {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (profile?.linked_student_id) fetchTeachers();
  }, [profile]);

  useEffect(() => {
    if (selectedTeacher) {
      getOrCreateConversation();
    }
  }, [selectedTeacher]);

  useEffect(() => {
    if (conversation) {
      fetchMessages();
      const subscription = supabase
        .channel(`convo-${conversation.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversation.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [conversation]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
        // 1. Dapatkan class_code anak
        const { data: student } = await supabase
            .from('profiles')
            .select('class_code')
            .eq('id', profile.linked_student_id)
            .single();

        if (student?.class_code) {
            // 2. Cari semua Guru di kelas tersebut
            const { data: teachersData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'guru')
                .eq('class_code', student.class_code);

            if (teachersData) {
                setTeachers(teachersData);
                // AUTO-SELECT guru pertama
                if (teachersData.length > 0 && !selectedTeacher) {
                    setSelectedTeacher(teachersData[0]);
                }
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const getOrCreateConversation = async () => {
    const { data: existing } = await supabase
      .from('direct_conversations')
      .select('*')
      .eq('teacher_id', selectedTeacher.id)
      .eq('parent_id', profile.id)
      .maybeSingle();

    if (existing) {
      setConversation(existing);
    } else {
      const { data: created } = await supabase
        .from('direct_conversations')
        .insert({
          teacher_id: selectedTeacher.id,
          parent_id: profile.id,
          student_id: profile.linked_student_id
        })
        .select()
        .single();
      if (created) setConversation(created);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: conversation.id,
      sender_id: profile.id,
      content: newMessage
    });

    if (!error) setNewMessage('');
  };

  const filteredTeachers = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans">
      <ParentSidebar />
      <aside className="w-96 bg-white border-r border-slate-100 flex flex-col h-screen overflow-hidden">
        <div className="p-8 border-b border-slate-50">
           <h1 className="text-2xl font-bold text-slate-900 mb-6">Konsultasi Guru</h1>
           <input
               type="text"
               placeholder="Cari..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none font-bold"
             />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
           {filteredTeachers.map(t => (
             <button
               key={t.id}
               onClick={() => {
                 setSelectedTeacher(t);
                 setMessages([]);
                 setConversation(null);
               }}
               className={`w-full p-4 rounded-2xl text-left transition-all flex items-center gap-4 ${selectedTeacher?.id === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50'}`}
             >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${selectedTeacher?.id === t.id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                   {t.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                   <p className={`font-bold truncate text-sm ${selectedTeacher?.id === t.id ? 'text-white' : 'text-slate-900'}`}>{t.full_name}</p>
                   <p className="text-[11px] font-bold truncate opacity-60">{t.subject || 'Guru Pengajar'}</p>
                </div>
             </button>
           ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen bg-white">
        {selectedTeacher ? (
          <>
            <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl font-bold">{selectedTeacher.full_name[0]}</div>
                  <div>
                     <h2 className="text-lg font-bold text-slate-900">{selectedTeacher.full_name}</h2>
                     <p className="text-emerald-500 font-bold text-[10px] uppercase">Online</p>
                  </div>
               </div>
            </header>
            <div className="flex-1 overflow-y-auto p-10 space-y-6 bg-[#FAFAFA]/50">
               {messages.map((msg) => (
                 <div key={msg.id} className={`flex ${msg.sender_id === profile.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-4 rounded-3xl text-sm font-medium shadow-sm ${msg.sender_id === profile.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                       {msg.content}
                    </div>
                 </div>
               ))}
               <div ref={scrollRef} />
            </div>
            <div className="p-8 bg-white border-t border-slate-100">
               <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tulis pesan..."
                    className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none"
                  />
                  <button type="submit" disabled={!newMessage.trim()} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></button>
               </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
             <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center text-4xl mb-8">💬</div>
             <h3 className="text-xl font-bold text-slate-900">Konsultasi Guru</h3>
             <p className="text-slate-400 text-sm mt-2">Memuat daftar guru...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ParentChat;
