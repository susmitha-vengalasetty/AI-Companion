import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export const ErrorState = ({ message = 'Something went wrong', onRetry }) => {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-center space-y-3 max-w-lg mx-auto my-6">
      <div className="w-10 h-10 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center mx-auto border border-red-500/30">
        <AlertCircle className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-red-300">Error Encountered</h4>
        <p className="text-xs text-red-400/90">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} icon={RefreshCw} className="border-red-500/40 text-red-300 hover:bg-red-500/20">
          Try Again
        </Button>
      )}
    </div>
  );
};
