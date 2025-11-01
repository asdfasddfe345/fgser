import React from 'react';
import { Pause, Play, X, AlertTriangle, Maximize } from 'lucide-react';

interface SimplifiedInterviewHeaderProps {
  userName: string;
  timeRemaining: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  isPaused: boolean;
  totalViolations: number;
  isFullScreen: boolean;
  onPause: () => void;
  onEnd: () => void;
  onEnterFullScreen: () => void;
}

export const SimplifiedInterviewHeader: React.FC<SimplifiedInterviewHeaderProps> = ({
  userName,
  timeRemaining,
  currentQuestionIndex,
  totalQuestions,
  isPaused,
  totalViolations,
  isFullScreen,
  onPause,
  onEnd,
  onEnterFullScreen
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-dark-200 border-b border-dark-300 shadow-xl z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PB</span>
                </div>
                <span className="text-gray-100 font-semibold text-sm">PrimoBoost AI</span>
              </div>
            </div>

            <div className="h-6 w-px bg-dark-300"></div>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="font-mono font-semibold">{formatTime(timeRemaining)}</span>
              </div>

              <div className="h-4 w-px bg-dark-300"></div>

              <div className="text-gray-300">
                <span className="font-semibold">{currentQuestionIndex + 1}</span>
                <span className="text-gray-500"> / {totalQuestions}</span>
              </div>

              {totalViolations > 0 && (
                <>
                  <div className="h-4 w-px bg-dark-300"></div>
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-semibold">{totalViolations}</span>
                  </div>
                </>
              )}

              {!isFullScreen && (
                <>
                  <div className="h-4 w-px bg-dark-300"></div>
                  <button
                    onClick={onEnterFullScreen}
                    className="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                    title="Enter Full-Screen"
                  >
                    <Maximize className="w-4 h-4" />
                    <span className="text-xs">Full-Screen</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPause}
              className="p-2 hover:bg-dark-300 rounded-lg transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? (
                <Play className="w-5 h-5 text-gray-300" />
              ) : (
                <Pause className="w-5 h-5 text-gray-300" />
              )}
            </button>

            <button
              onClick={onEnd}
              className="p-2 hover:bg-red-900/20 rounded-lg transition-colors"
              title="End Interview"
            >
              <X className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
