import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import StudentSidebar from '../../components/StudentSidebar';
import { useVoice } from '../../hooks/useVoice';

const StudentCollaboration = () => {
  const { profile } = useAuthStore();
  const navigate = useNavigate();

  const [myGroups, setMyGroups] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('mine');

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinError, setJoinError] = useState('');

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const { speak, startListening, stopListening, isListening } = useVoice();

  const isBlind = profile?.disability_type === 'tunanetra';

  useEffect(() => {
    fetchMyGroups();
    fetchAllGroups();
    if (isBlind) {
        speak("Halaman Kolaborasi. Kamu bisa mengobrol dengan teman kelompokmu. Gunakan mikrofon untuk mengirim pesan suara.");
    }
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      fetchMessages(selectedGroup.id);
      const subscription = supabase
        .channel(`student-group-${selectedGroup.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${selectedGroup.id}` },
          payload => {
            setMessages(prev => [...prev, payload.new]);
            if (isBlind && payload.new.sender_id !== profile.id) {
                speak(`Pesan baru dari ${payload.new.sender_id}: ${payload.new.content}`);
            }
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(subscription); };
    }
  }, [selectedGroup]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const fetchMyGroups = async () => {
    const { data } = await supabase
      .from('study_groups')
      .select('*, group_members!inner(student_id)')
      .eq('group_members.student_id', profile.id);
    if (data) setMyGroups(data);
  };

  const fetchAllGroups = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('study_groups')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAllGroups(data);
    setLoading(false);
  };

  const fetchMessages = async (groupId) => {
    const { data } = await supabase
      .from('group_messages')
      .select('*, profiles:sender_id(full_name, role)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleSendMessage = async (text) => {
    const content = text || newMessage;
    if (!content.trim() || !selectedGroup) return;

    const { error } = await supabase.from('group_messages').insert({
      group_id: selectedGroup.id,
      sender_id: profile.id,
      content: content
    });

    if (!error) {
        setNewMessage('');
        if (isBlind) speak("Pesan terkirim.");
    }
  };

  const handleJoinGroup = async (e) => {
    if (e) e.preventDefault();
    setJoinError('');

    if (joiningGroup.password && joinPassword !== joiningGroup.password) {
      setJoinError('Kata sandi kelompok salah!');
      if (isBlind) speak('Kata sandi salah.');
      return;
    }

    if (joiningGroup.requires_approval) {
      const { data: existingRequest } = await supabase
        .from('group_join_requests')
        .select('id')
        .eq('group_id', joiningGroup.id)
        .eq('student_id', profile.id)
        .maybeSingle();

      if (existingRequest) {
        setJoinError('Kamu sudah mengirim permintaan sebelumnya.');
        if (isBlind) speak('Sudah pernah mengirim permintaan.');
        return;
      }

      const { error } = await supabase.from('group_join_requests').insert({
        group_id: joiningGroup.id,
        student_id: profile.id
      });

      if (error) {
        setJoinError('Gagal mengirim permintaan. Coba lagi.');
      } else {
        alert('Permintaan terkirim! Tunggu persetujuan guru.');
        if (isBlind) speak('Permintaan terkirim.');
        setShowJoinModal(false);
      }
    } else {
      const isAlreadyMember = myGroups.some(g => g.id === joiningGroup.id);
      if (isAlreadyMember) {
        setShowJoinModal(false);
        setActiveTab('mine');
        setSelectedGroup(joiningGroup);
        return;
      }

      const { error } = await supabase.from('group_members').insert({
        group_id: joiningGroup.id,
        student_id: profile.id
      });

      if (!error) {
        await fetchMyGroups();
        setShowJoinModal(false);
        setActiveTab('mine');
        setSelectedGroup(joiningGroup);
        if (isBlind) speak(`Berhasil bergabung ke kelompok ${joiningGroup.name}`);
      } else if (error.code === '23505') {
        await fetchMyGroups();
        setShowJoinModal(false);
        setActiveTab('mine');
        const updatedGroup = allGroups.find(g => g.id === joiningGroup.id);
        setSelectedGroup(updatedGroup || joiningGroup);
      } else {
        setJoinError('Gagal bergabung. Coba lagi.');
        console.error(error);
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (window.confirm(`Keluar dari kelompok ${selectedGroup.name}?`)) {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('student_id', profile.id);

      if (!error) {
        setSelectedGroup(null);
        fetchMyGroups();
        if (isBlind) speak(`Keluar dari kelompok.`);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `groups/${selectedGroup.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('collaboration-files')
      .upload(filePath, file);

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('collaboration-files').getPublicUrl(filePath);
      await supabase.from('group_messages').insert({
        group_id: selectedGroup.id,
        sender_id: profile.id,
        content: '[Gambar]',
        image_url: publicUrl
      });
    }
  };

  const handleVoiceCommand = (transcript) => {
    const command = transcript.toLowerCase();
    if (command.includes('kirim pesan')) {
        const text = command.replace('kirim pesan', '').trim();
        if (text) handleSendMessage(text);
        else speak('Sebutkan isi pesan yang ingin dikirim.');
    } else if (command.includes('baca pesan')) {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            speak(`Pesan terakhir dari ${lastMsg.profiles?.full_name}: ${lastMsg.content}`);
        } else {
            speak('Belum ada pesan di kelompok ini.');
        }
    } else if (command.includes('pilih kelompok')) {
        speak('Sebutkan nama kelompok.');
    } else {
        const found = myGroups.find(g => command.includes(g.name.toLowerCase()));
        if (found) {
            setSelectedGroup(found);
            speak(`Membuka kelompok ${found.name}`);
        }
    }
  };

  const toggleMic = () => {
    if (isListening) stopListening();
    else startListening(handleVoiceCommand);
  };

  const handleHover = (text) => {
    if (isBlind) speak(text);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans selection:bg-indigo-100">
      <StudentSidebar />

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

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="px-10 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between shrink-0">
           <div onMouseEnter={() => handleHover('Halaman Kolaborasi Siswa')}>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Kolaborasi Siswa</h2>
              <p className="text-slate-500 font-medium text-xs mt-1">Belajar dan berdiskusi bersama teman sekelas.</p>
           </div>
           {selectedGroup && (
             <div className="flex items-center gap-3">
               <div
                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-indigo-100"
                onMouseEnter={() => handleHover(`Kamu sedang berada di kelompok ${selectedGroup.name}`)}
               >
                  Kelompok: {selectedGroup.name}
               </div>
               <button
                onClick={handleLeaveGroup}
                onMouseEnter={() => handleHover('Tombol keluar dari kelompok.')}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-red-100 hover:bg-red-500 hover:text-white transition-all"
               >
                 Keluar Kelompok
               </button>
             </div>
           )}
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r border-slate-100 bg-white flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-50 flex gap-2">
               <button
                onClick={() => setActiveTab('mine')}
                onMouseEnter={() => handleHover('Tab Kelompok Saya')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'mine' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
               >
                 Grup Saya
               </button>
               <button
                onClick={() => setActiveTab('discover')}
                onMouseEnter={() => handleHover('Tab Cari Kelompok Baru')}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'discover' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
               >
                 Cari Grup
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {activeTab === 'mine' ? (
                myGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup(group)}
                    onMouseEnter={() => handleHover(`Kelompok ${group.name}. Klik untuk mengobrol.`)}
                    className={`w-full p-5 text-left rounded-2xl transition-all duration-300 ${selectedGroup?.id === group.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-100'}`}
                  >
                    <p className="font-bold tracking-tight text-sm">{group.name}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${selectedGroup?.id === group.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                      Klik untuk chat
                    </p>
                  </button>
                ))
              ) : (
                allGroups.filter(g => !myGroups.some(m => m.id === g.id)).map(group => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setJoiningGroup(group);
                      setShowJoinModal(true);
                      setJoinPassword('');
                      setJoinError('');
                    }}
                    onMouseEnter={() => handleHover(`Kelompok ${group.name}. ${group.password ? 'Terkunci.' : 'Terbuka.'} Klik untuk bergabung.`)}
                    className="w-full p-5 text-left rounded-2xl bg-white border border-slate-100 hover:border-indigo-600 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-bold tracking-tight text-sm text-slate-800">{group.name}</p>
                      {group.password && <span className="text-xs">🔒</span>}
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {group.requires_approval ? 'Butuh Izin Guru' : 'Gabung Langsung'}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-50/30 relative overflow-hidden">
            {selectedGroup ? (
              <>
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-10 space-y-6"
                    onMouseEnter={() => handleHover(`Area obrolan kelompok ${selectedGroup.name}`)}
                >
                  <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onMouseEnter={() => handleHover(`Pesan dari ${msg.profiles?.full_name}: ${msg.content}`)}
                        className={`flex flex-col ${msg.sender_id === profile.id ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 mx-2">
                          {msg.profiles?.full_name} {msg.profiles?.role === 'guru' && <span className="text-indigo-600">(Guru)</span>}
                        </span>
                        <div className={`max-w-[70%] p-4 rounded-3xl text-sm font-medium shadow-sm ${msg.sender_id === profile.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                          {msg.image_url && (
                            <img src={msg.image_url} alt="Shared" className="rounded-xl mb-2 max-h-60 object-cover cursor-pointer" onClick={() => window.open(msg.image_url)} />
                          )}
                          <p>{msg.content}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="p-8 bg-white border-t border-slate-100">
                   <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="max-w-4xl mx-auto flex gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        onMouseEnter={() => handleHover('Tombol lampirkan gambar.')}
                        className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-100 border border-slate-100 transition-all"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                         </svg>
                      </button>
                      <input type="file" hidden ref={fileInputRef} onChange={(e) => handleFileUpload(e)} accept="image/*" />

                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Tulis pesan ke kelompok..."
                        onMouseEnter={() => handleHover('Kotak ketik pesan.')}
                        className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm shadow-sm"
                      />

                      <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        onMouseEnter={() => handleHover('Tombol kirim pesan.')}
                        className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                         </svg>
                      </button>
                   </form>
                </div>
              </>
            ) : (
              <div
                className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-30"
                onMouseEnter={() => handleHover('Ruang diskusi kelompok. Pilih kelompok di sisi kiri untuk memulai.')}
              >
                <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center text-5xl mb-8">👥</div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Ruang Diskusi</h3>
                <p className="text-sm font-medium mt-2 max-w-xs mx-auto text-slate-500">Buka "Grup Saya" untuk mulai chat atau "Cari Grup" untuk menemukan kelompok belajar baru.</p>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showJoinModal && joiningGroup && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowJoinModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Gabung Kelompok</h2>
                <p className="text-slate-500 font-medium text-sm mb-6">Kamu akan bergabung ke <span className="text-indigo-600 font-bold">{joiningGroup.name}</span>.</p>

                <form onSubmit={handleJoinGroup}>
                  {joiningGroup.password && (
                    <div className="space-y-1.5 mb-6">
                      <label className="text-xs font-bold text-slate-400 uppercase ml-4">Kata Sandi Kelompok</label>
                      <input
                        type="password" value={joinPassword} onChange={e => setJoinPassword(e.target.value)}
                        placeholder="Masukkan sandi..."
                        onMouseEnter={() => handleHover('Kotak masukkan kata sandi kelompok.')}
                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 font-bold text-sm"
                        autoFocus
                      />
                    </div>
                  )}

                  {joinError && <p className="text-xs font-bold text-red-500 mb-4 ml-4">{joinError}</p>}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowJoinModal(false)} onMouseEnter={() => handleHover('Tombol batal.')} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl">Batal</button>
                    <button type="submit" onMouseEnter={() => handleHover('Tombol gabung.')} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100">Gabung</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default StudentCollaboration;
