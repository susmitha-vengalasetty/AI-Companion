import React from 'react';

export const LoadingState = ({ message = 'Loading workspace...' }) => {
  return (
    <div className="flex flex-col justify-center items-center py-16 px-4 space-y-3 min-h-[300px]">
      <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-medium text-slate-400 animate-pulse">{message}</p>
    </div>
  );
};
