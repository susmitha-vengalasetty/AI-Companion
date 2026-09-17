import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, LogOut, User, Shield, Menu } from 'lucide-react';
import { Button } from './ui/Button';

export const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden text-slate-400 hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 no-underline group min-w-0">
          <div className="bg-blue-600/20 text-blue-400 p-1.5 sm:p-2 rounded-xl border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm sm:text-lg tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent block truncate">
              AI Study Companion
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 hidden min-[360px]:block font-medium truncate">Learning & Growth Workspace</span>
          </div>
        </Link>
      </div>

      {user && (
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/80">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-slate-200">{user.name}</span>
            {user.role === 'admin' && (
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            icon={LogOut}
            className="text-xs px-2.5 sm:px-3 hover:border-red-500/40 hover:text-red-400"
          >
            Sign Out
          </Button>
        </div>
      )}
    </header>
  );
};
