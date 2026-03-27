import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import TeacherSidebar from '../../components/TeacherSidebar';

const TeacherCollaboration = () => {
  const { profile } = useAuthStore();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Group Form State
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    password: '',
    requires_approval: false
  });

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      fetchMessages(selectedGroup.id);
      fetchMembers(selectedGroup.id);
      fetchRequests(selectedGroup.id);

      const subscription = supabase
        .channel(`teacher-group-${selectedGroup.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${selectedGroup.id}` },
          payload => {
            setMessages(prev => [...prev, payload.new]);
          }
        )
        .subscribe();
      return () => { supabase.removeChannel(subscription); };
    }
  }, [selectedGroup]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const fetchGroups = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('study_groups')
      .select('*')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false });
    if (data) setGroups(data);
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

  const fetchMembers = async (groupId) => {
    const { data } = await supabase
      .from('group_members')
      .select('*, profiles:student_id(full_name, disability_type)')
      .eq('group_id', groupId);
    if (data) setMembers(data);
  };

  const fetchRequests = async (groupId) => {
    const { data } = await supabase
      .from('group_join_requests')
      .select('*, profiles:student_id(full_name)')
      .eq('group_id', groupId)
      .eq('status', 'pending');
    if (data) setRequests(data);
  };

  const handleCreateOrUpdateGroup = async (e) => {
    e.preventDefault();
    const payload = { ...groupForm, created_by: profile.id };

    if (isEditing) {
      const { error } = await supabase.from('study_groups').update(payload).eq('id', selectedGroup.id);
      if (!error) {
        setIsEditing(false);
        setShowCreateModal(false);
        fetchGroups();
        setSelectedGroup({ ...selectedGroup, ...payload });
      }
    } else {
      const { data, error } = await supabase.from('study_groups').insert([payload]).select().single();
      if (!error && data) {
        await supabase.from('group_members').insert([{ group_id: data.id, student_id: profile.id, role: 'leader' }]);
        setShowCreateModal(false);
        fetchGroups();
      }
    }
    setGroupForm({ name: '', description: '', password: '', requires_approval: false });
  };

  const handleDeleteGroup = async (groupId) => {
    if (window.confirm('Yakin ingin menghapus kelompok ini? Semua chat akan hilang.')) {
      const { error } = await supabase.from('study_groups').delete().eq('id', groupId);
      if (!error) {
        setSelectedGroup(null);
        fetchGroups();
      }
    }
  };

  const handleRemoveMember = async (studentId) => {
    if (window.confirm('Hapus siswa ini dari kelompok?')) {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('student_id', studentId);
      if (!error) fetchMembers(selectedGroup.id);
    }
  };

  const handleApproveRequest = async (requestId, studentId) => {
    await supabase.from('group_join_requests').update({ status: 'approved' }).eq('id', requestId);
    await supabase.from('group_members').insert([{ group_id: selectedGroup.id, student_id: studentId }]);
    fetchRequests(selectedGroup.id);
    fetchMembers(selectedGroup.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGroup) return;

    const { error } = await supabase.from('group_messages').insert({
      group_id: selectedGroup.id,
      sender_id: profile.id,
      content: newMessage
    });

    if (!error) setNewMessage('');
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans">
      <TeacherSidebar activeTab="" />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="px-10 py-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Kelompok Belajar</h2>
            <p className="text-slate-500 font-medium text-xs mt-1">Kelola kolaborasi antar siswa di kelasmu.</p>
          </div>
          <button
            onClick={() => {
              setIsEditing(false);
              setGroupForm({ name: '', description: '', password: '', requires_approval: false });
              setShowCreateModal(true);
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Buat Kelompok Baru
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Group List */}
          <div className="w-80 border-r border-slate-100 bg-white overflow-y-auto shrink-0 p-6 space-y-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-2 mb-4">Kelompok Saya</h3>
            <div className="space-y-2">
              {groups.map(group => (
                <div key={group.id} className="relative group">
                  <button
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full p-5 text-left rounded-2xl transition-all duration-300 ${selectedGroup?.id === group.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <p className="font-bold tracking-tight text-sm">{group.name}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${selectedGroup?.id === group.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {group.requires_approval ? 'Butuh Izin' : 'Terbuka'}
                    </p>
                  </button>
                  {selectedGroup?.id === group.id && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setGroupForm({ name: group.name, description: group.description, password: group.password || '', requires_approval: group.requires_approval });
                          setShowCreateModal(true);
                        }}
                        className="p-2 bg-white/20 rounded-lg hover:bg-white/40 text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-2 bg-white/20 rounded-lg hover:bg-red-500 text-white"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Management & Chat Area */}
          <div className="flex-1 flex overflow-hidden">
            {selectedGroup ? (
              <>
                {/* Chat Column */}
                <div className="flex-1 flex flex-col bg-slate-50 border-r border-slate-100 overflow-hidden">
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-6">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex flex-col ${msg.sender_id === profile.id ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {msg.profiles?.full_name} ({msg.profiles?.role})
                        </span>
                        <div className={`max-w-[80%] p-4 rounded-3xl text-sm shadow-sm ${msg.sender_id === profile.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                          {msg.image_url && (
                            <img src={msg.image_url} alt="Shared" className="rounded-xl mb-2 max-h-60 object-cover" />
                          )}
                          <p className="font-medium">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input */}
                  <div className="p-8 bg-white border-t border-slate-100">
                    <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-all border border-slate-100"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                      </button>
                      <input
                        type="file" hidden ref={fileInputRef}
                        onChange={(e) => handleFileUpload(e)}
                        accept="image/*"
                      />
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Tulis pesan..."
                        className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm"
                      />
                      <button type="submit" disabled={!newMessage.trim()} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Info Column (Members & Requests) */}
                <div className="w-96 bg-white overflow-y-auto p-8 space-y-10">
                  {/* Join Requests */}
                  {requests.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em] mb-4">Permintaan Masuk ({requests.length})</h3>
                      <div className="space-y-3">
                        {requests.map(req => (
                          <div key={req.id} className="p-4 bg-indigo-50 rounded-2xl flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-700">{req.profiles.full_name}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveRequest(req.id, req.student_id)}
                                className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 shadow-md"
                              >
                                ✓
                              </button>
                              <button className="w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center hover:bg-red-600 shadow-md">
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Member List */}
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Anggota Kelompok ({members.length})</h3>
                    <div className="space-y-3">
                      {members.map(member => (
                        <div key={member.id} className="group p-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                              {member.profiles?.full_name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{member.profiles?.full_name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">{member.profiles?.disability_type || 'Umum'}</p>
                            </div>
                          </div>
                          {member.student_id !== profile.id && (
                            <button
                              onClick={() => handleRemoveMember(member.student_id)}
                              className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-30">
                <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center text-4xl mb-8">🛠️</div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight uppercase">Manajemen Kolaborasi</h3>
                <p className="text-sm font-medium mt-2 max-w-xs mx-auto text-slate-500">Pilih salah satu kelompok untuk melihat riwayat chat, daftar anggota, dan permintaan masuk.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 overflow-hidden"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{isEditing ? 'Edit Kelompok' : 'Buat Kelompok Baru'}</h2>
              <p className="text-slate-500 font-medium text-sm mb-8">Atur bagaimana siswa berkolaborasi.</p>

              <form onSubmit={handleCreateOrUpdateGroup} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-4">Nama Kelompok</label>
                  <input
                    required type="text" value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})}
                    placeholder="Contoh: Belajar IPA Seru"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-transparent focus:border-indigo-500 focus:bg-white outline-none font-semibold transition-all text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-4">Sandi Kelompok (Opsional)</label>
                  <input
                    type="password" value={groupForm.password} onChange={e => setGroupForm({...groupForm, password: e.target.value})}
                    placeholder="Biarkan kosong jika tidak perlu sandi"
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-transparent focus:border-indigo-500 focus:bg-white outline-none font-semibold transition-all text-sm"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Persetujuan Masuk</p>
                    <p className="text-[10px] text-slate-400 font-bold">Harus diizinkan guru (jika tanpa sandi)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGroupForm({...groupForm, requires_approval: !groupForm.requires_approval})}
                    className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${groupForm.requires_approval ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full transition-all ${groupForm.requires_approval ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex gap-3 pt-4">
                   <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all">Batal</button>
                   <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Simpan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherCollaboration;
