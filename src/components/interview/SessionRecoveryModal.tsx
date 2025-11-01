import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface SessionRecoveryModalProps {
  sessionData: {
    questionIndex: number;
    totalQuestions: number;
    timeRemaining: number;
    lastSaved: string;
  };
  onRecover: () => void;
  onStartNew: () => void;
}

export const SessionRecoveryModal: React.FC<SessionRecoveryModalProps> = ({
  sessionData,
  onRecover,
  onStartNew
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-dark-200 rounded-2xl p-8 max-w-md w-full border-2 border-blue-500 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <RefreshCw className="w-8 h-8 text-blue-400" />
          <h3 className="text-2xl font-bold text-gray-100">Resume Interview?</h3>
        </div>

        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <p className="text-gray-300 text-sm">
              We found a previous interview session that was interrupted. You can resume from where you left off.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Progress:</span>
              <span className="text-gray-200 font-semibold">
                Question {sessionData.questionIndex + 1} of {sessionData.totalQuestions}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Time Remaining:</span>
              <span className="text-gray-200 font-semibold">
                {formatTime(sessionData.timeRemaining)}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Last Saved:</span>
              <span className="text-gray-200 font-semibold">{sessionData.lastSaved}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onRecover}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Resume Interview
          </button>
          <button
            onClick={onStartNew}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Start New Session
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Starting a new session will discard your previous progress
        </p>
      </div>
    </div>
  );
};
