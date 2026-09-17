import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export const PageHeader = ({ title, description, breadcrumbs = [], actions, icon: Icon }) => {
  return (
    <div className="border-b border-slate-800 pb-6 mb-8 space-y-3">
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-white transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-blue-400 font-semibold">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 break-words">
            {Icon && <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400 shrink-0" />}
            {title}
          </h1>
          {description && <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">{description}</p>}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
