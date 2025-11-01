import React from 'react';
import { AlertCircle, RefreshCw, SkipForward, X } from 'lucide-react';

interface InterviewErrorModalProps {
  error: string;
  onDismiss: () => void;
  onRetry?: () => void;
  onSkip?: () => void;
  title?: string;
}

export const InterviewErrorModal: React.FC<InterviewErrorModalProps> = ({
  error,
  onDismiss,
  onRetry,
  onSkip,
  title = 'Interview Issue'
}) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4">
      <div className="bg-dark-200 rounded-2xl p-8 max-w-md w-full border-2 border-yellow-500/50 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-8 h-8 text-yellow-500" />
          <h3 className="text-xl font-bold text-yellow-400">{title}</h3>
        </div>

        <p className="text-gray-300 mb-6 leading-relaxed">{error}</p>

        <div className="space-y-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Retry
            </button>
          )}

          {onSkip && (
            <button
              onClick={onSkip}
              className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              <SkipForward className="w-5 h-5" />
              Skip Question
            </button>
          )}

          <button
            onClick={onDismiss}
            className="w-full flex items-center justify-center gap-2 bg-dark-300 hover:bg-dark-400 text-gray-200 font-semibold py-3 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
};
