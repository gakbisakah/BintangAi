import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

const ParentSidebar = ({ activeTab, onTabChange }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuthStore();

  const menuItems = [
    {
      id: 'overview',
      label: 'Ringkasan Belajar',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      path: '/parent/dashboard'
    },
    {
      id: 'reports',
      label: 'Laporan Guru (AI)',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      path: '/parent/dashboard'
    },
    {
      id: 'history',
      label: 'Riwayat QuizKu',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      path: '/parent/dashboard'
    },
  ];

  const handleItemClick = (item) => {
    if (location.pathname === item.path) {
      if (onTabChange) onTabChange(item.id);
    } else {
      navigate(`${item.path}?tab=${item.id}`);
    }
  };

  const isChatActive = location.pathname === '/parent/chat';

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col sticky top-0 h-screen shrink-0 z-40 hidden lg:flex">
      <div className="flex flex-col h-full px-6 py-10">
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-3 mb-12 cursor-pointer transition-transform active:scale-95"
          onClick={() => navigate('/')}
        >
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>
          <span className="text-lg font-bold tracking-tight text-slate-900">Bintang<span className="text-indigo-600">Ai</span></span>
        </div>

        {/* Menu Section */}
        <div className="flex-1 space-y-8">
          <div>
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Parent Portal</p>
            <div className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === '/parent/dashboard' && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 group relative ${
                      isActive
                        ? 'text-indigo-600 font-bold'
                        : 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                      {item.icon}
                    </span>
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-bg-parent"
                        className="absolute inset-0 bg-indigo-50 rounded-xl -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Komunikasi</p>
            <button
              onClick={() => navigate('/parent/chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 group relative ${
                isChatActive
                  ? 'text-indigo-600 font-bold'
                  : 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className={`transition-colors ${isChatActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </span>
              Konsultasi Guru
              {isChatActive && (
                <motion.div
                  layoutId="active-nav-bg-parent"
                  className="absolute inset-0 bg-indigo-50 rounded-xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          </div>
        </div>

        {/* Profile */}
        <div className="pt-8 border-t border-slate-50">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-100">
              {profile?.full_name?.[0] || 'B'}
            </div>
            <div className="text-left overflow-hidden">
               <p className="text-xs font-bold text-slate-900 truncate">{profile?.full_name?.split(' ')[0]}</p>
               <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Orang Tua</p>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ParentSidebar;
