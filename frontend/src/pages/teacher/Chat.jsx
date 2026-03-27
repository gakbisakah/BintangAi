import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import TeacherSidebar from '../../components/TeacherSidebar';

const TeacherChat = () => {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (profile?.id) fetchData();
  }, [profile]);

  useEffect(() => {
    if (selectedConvo && !selectedConvo.is_new) {
      fetchMessages();
      const subscription = supabase
        .channel(`convo-${selectedConvo.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${selectedConvo.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } else if (selectedConvo?.is_new) {
        setMessages([]);
    }
  }, [selectedConvo]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Ambil percakapan yang sudah ada
      const { data: convos } = await supabase
        .from('direct_conversations')
        .select('*, parent:profiles!direct_conversations_parent_id_fkey(id, full_name), student:profiles!direct_conversations_student_id_fkey(full_name)')
        .eq('teacher_id', profile.id);

      // 2. Ambil semua Siswa di kelas guru ini
      const { data: classStudents } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'siswa')
        .eq('class_code', profile.class_code);

      const studentIds = classStudents?.map(s => s.id) || [];

      if (studentIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // 3. Ambil Orang Tua yang terhubung dengan siswa-siswa tersebut
      // Perbaikan Query: Menggunakan nama kolom foreign key untuk self-join
      const { data: allParents, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, linked_student_id')
        .eq('role', 'ortu')
        .in('linked_student_id', studentIds);

      if (pError) throw pError;

      const merged = (allParents || []).map(p => {
          const existing = convos?.find(c => c.parent_id === p.id);
          const studentInfo = classStudents.find(s => s.id === p.linked_student_id);

          return {
              id: existing?.id || `new-${p.id}`,
              parent_id: p.id,
              parent: { id: p.id, full_name: p.full_name },
              student: { full_name: studentInfo?.full_name || 'Siswa' },
              is_new: !existing,
              student_id: p.linked_student_id
          };
      });

      setConversations(merged);

      if (merged.length > 0 && !selectedConvo) {
          setSelectedConvo(merged[0]);
      }
    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', selectedConvo.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvo) return;

    let convoId = selectedConvo.id;

    if (selectedConvo.is_new) {
        const { data: newConvo, error: convoErr } = await supabase
            .from('direct_conversations')
            .insert({
                teacher_id: profile.id,
                parent_id: selectedConvo.parent_id,
                student_id: selectedConvo.student_id
            })
            .select()
            .single();

        if (convoErr) return alert(convoErr.message);
        convoId = newConvo.id;
        setSelectedConvo({ ...selectedConvo, id: convoId, is_new: false });

        // Update list agar tidak dianggap "new" lagi
        setConversations(prev => prev.map(c => c.parent_id === selectedConvo.parent_id ? { ...c, id: convoId, is_new: false } : c));
    }

    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: convoId,
      sender_id: profile.id,
      content: newMessage
    });

    if (!error) setNewMessage('');
  };

  const filteredConversations = conversations.filter(convo =>
    convo.parent?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    convo.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      <TeacherSidebar activeTab="" />
      <aside className="w-96 bg-white border-r border-slate-100 flex flex-col h-screen overflow-hidden">
        <div className="p-8 border-b border-slate-50">
           <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Pesan Ortu</h1>
           <input
               type="text"
               placeholder="Cari nama orang tua atau siswa..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-300 transition-all"
             />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
           {filteredConversations.map(convo => (
             <button
               key={convo.id}
               onClick={() => setSelectedConvo(convo)}
               className={`w-full p-4 rounded-2xl text-left transition-all flex items-center gap-4 ${selectedConvo?.parent_id === convo.parent_id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50'}`}
             >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${selectedConvo?.parent_id === convo.parent_id ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                   {convo.parent?.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                   <p className={`font-bold truncate text-sm ${selectedConvo?.parent_id === convo.parent_id ? 'text-white' : 'text-slate-900'}`}>{convo.parent?.full_name}</p>
                   <p className={`text-[10px] font-bold truncate ${selectedConvo?.parent_id === convo.parent_id ? 'text-white/70' : 'text-slate-400'}`}>Anak: {convo.student?.full_name}</p>
                </div>
             </button>
           ))}
           {!loading && filteredConversations.length === 0 && (
             <div className="p-8 text-center text-slate-400 text-xs font-bold">Tidak ada orang tua ditemukan.</div>
           )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen bg-white">
        {selectedConvo ? (
          <>
            <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl font-bold">{selectedConvo.parent?.full_name[0]}</div>
                  <div>
                     <h2 className="text-lg font-bold text-slate-900">{selectedConvo.parent?.full_name}</h2>
                     <p className="text-slate-400 font-bold text-[10px] uppercase">Orang Tua {selectedConvo.student?.full_name}</p>
                  </div>
               </div>
            </header>
            <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-[#F8FAFC]">
               {messages.map((msg) => (
                 <div key={msg.id} className={`flex ${msg.sender_id === profile.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-5 py-3.5 rounded-3xl text-sm shadow-sm max-w-md ${msg.sender_id === profile.id ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'}`}>
                       {msg.content}
                       <p className={`text-[8px] mt-1 font-bold ${msg.sender_id === profile.id ? 'text-white/50 text-right' : 'text-slate-300'}`}>
                         {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </p>
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
                    placeholder="Tulis pesan ke orang tua..."
                    className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-300 transition-all"
                  />
                  <button type="submit" disabled={!newMessage.trim()} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  </button>
               </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
             <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center text-4xl mb-8">💬</div>
             <h3 className="text-xl font-bold text-slate-900">Pilih Percakapan</h3>
             <p className="text-slate-400 text-sm mt-2">Pilih salah satu orang tua di samping untuk memulai diskusi.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default TeacherChat;
