import React from 'react';
import { Card } from './Card';

export const StatCard = ({ icon: Icon, title, value, subtext, color = 'blue', className = '' }) => {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  return (
    <Card className={`flex items-center gap-4 ${className}`}>
      {Icon && (
        <div className={`p-3 rounded-xl border shrink-0 ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div className="space-y-0.5 overflow-hidden">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block truncate">{title}</span>
        <span className="text-2xl font-bold text-white tracking-tight block">{value}</span>
        {subtext && <span className="text-[11px] text-slate-400 block truncate">{subtext}</span>}
      </div>
    </Card>
  );
};
