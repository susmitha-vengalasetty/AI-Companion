import React from 'react';

export const Card = ({ children, className = '', hover = false, onClick, ...props }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 md:p-6 transition-all duration-200 ${
        hover ? 'hover:bg-slate-800 hover:border-slate-600 hover:shadow-lg cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <div className={`mb-4 flex items-center justify-between gap-3 ${className}`}>{children}</div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-base font-semibold text-white tracking-tight ${className}`}>{children}</h3>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-xs text-slate-400 mt-1 leading-relaxed ${className}`}>{children}</p>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }) => (
  <div className={`mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between gap-3 ${className}`}>
    {children}
  </div>
);
