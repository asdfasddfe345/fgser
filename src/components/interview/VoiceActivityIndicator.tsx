import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceActivityIndicatorProps {
  isSpeaking: boolean;
  isListening: boolean;
  silenceCountdown?: number;
}

export const VoiceActivityIndicator: React.FC<VoiceActivityIndicatorProps> = ({
  isSpeaking,
  isListening,
  silenceCountdown = 0
}) => {
  return (
    <div className="space-y-4">
      {isListening && (
        <>
          <div className="flex items-center justify-center gap-4 py-4">
            {isSpeaking ? (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute inset-0 w-12 h-12 bg-green-500 rounded-full animate-ping opacity-75"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-green-400 text-lg font-semibold">Speaking Detected</span>
                  <span className="text-gray-400 text-sm">Your voice is being recorded</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                  <Mic className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-lg font-semibold">Listening...</span>
                  <span className="text-gray-500 text-sm">Start speaking to begin</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isSpeaking
                    ? 'bg-green-500 h-8 animate-pulse'
                    : 'bg-gray-600 h-4'
                }`}
                style={{
                  animationDelay: `${i * 100}ms`,
                  height: isSpeaking ? `${Math.random() * 20 + 16}px` : '16px'
                }}
              />
            ))}
          </div>

          {silenceCountdown > 0 && silenceCountdown <= 5 && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-yellow-400 font-semibold">
                  Auto-submitting in {silenceCountdown}s
                </span>
                <span className="text-yellow-300 text-2xl font-bold font-mono">
                  {silenceCountdown}
                </span>
              </div>
              <div className="w-full bg-dark-400 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(silenceCountdown / 5) * 100}%` }}
                ></div>
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Continue speaking to prevent auto-submission
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
