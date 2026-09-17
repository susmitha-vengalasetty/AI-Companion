import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const Layout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      <Navbar onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
      <div className="flex flex-1 relative overflow-hidden">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-20 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        <Sidebar isOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
        <main className="flex-1 bg-slate-950 overflow-y-auto min-h-[calc(100vh-65px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
