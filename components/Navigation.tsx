
import React from 'react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const menus = [
    { id: AppView.STUDENT, label: 'ส่งงาน', icon: '🚀', color: 'bg-indigo-500' },
    { id: AppView.RESULT, label: 'ตรวจคะแนน', icon: '🏆', color: 'bg-yellow-500' },
    { id: AppView.GALLERY, label: 'โรงหนังเพื่อน', icon: '🎬', color: 'bg-pink-500' },
    { id: AppView.TEACHER_LOGIN, label: 'คุณครู', icon: '👩‍🏫', color: 'bg-slate-700' },
    { id: AppView.DASHBOARD, label: 'สถิติ', icon: '📊', color: 'bg-emerald-500' },
  ];

  return (
    <nav className="flex flex-wrap justify-center gap-3 md:gap-4 mb-10">
      {menus.map(menu => {
        const isActive = currentView === menu.id || (menu.id === AppView.TEACHER_LOGIN && currentView === AppView.TEACHER);
        return (
          <button
            key={menu.id}
            onClick={() => setView(menu.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all btn-bounce border-2 ${
              isActive 
                ? `${menu.color} text-white scale-105 shadow-lg border-transparent` 
                : 'bg-white/60 text-slate-500 hover:bg-white border-white/50 backdrop-blur-sm shadow-sm'
            }`}
          >
            <span className="text-xl">{menu.icon}</span>
            <span className="hidden sm:inline text-base">{menu.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default Navigation;
