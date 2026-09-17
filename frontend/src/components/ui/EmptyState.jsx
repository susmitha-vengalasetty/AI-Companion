import React from 'react';
import { Button } from './Button';
import { Folder } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Folder,
  title = 'No items found',
  description = 'Get started by creating your first item.',
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) => {
  return (
    <div className={`border border-dashed border-slate-700/80 rounded-2xl p-8 md:p-12 text-center space-y-4 bg-slate-900/30 ${className}`}>
      <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto border border-slate-700/60 shadow-inner">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
      <div className="space-y-1 max-w-sm mx-auto">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} icon={actionIcon} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
