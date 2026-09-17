import React from 'react';

export const Textarea = ({
  label,
  error,
  helperText,
  className = '',
  id,
  required,
  rows = 3,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        required={required}
        className={`w-full bg-slate-900 border rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-y min-h-[80px] ${
          error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500' : 'border-slate-700/80'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};
