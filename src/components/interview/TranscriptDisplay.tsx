import React, { useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';

interface TranscriptDisplayProps {
  transcript: string;
  isListening: boolean;
  placeholder?: string;
}

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  transcript,
  isListening,
  placeholder = 'Start speaking...'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="bg-dark-300 rounded-lg border border-gray-700 overflow-hidden">
      <div className="bg-dark-400 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-gray-100">Your Response</h3>
        </div>
        {isListening && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-red-400 text-sm font-medium">Recording</span>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="p-4 min-h-[120px] max-h-[240px] overflow-y-auto scroll-smooth"
      >
        {transcript ? (
          <div className="space-y-2">
            <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
              {transcript}
            </p>
            {isListening && (
              <span className="inline-block w-2 h-5 bg-blue-400 animate-pulse ml-1"></span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[104px]">
            <p className="text-gray-500 text-sm italic">{placeholder}</p>
          </div>
        )}
      </div>

      {transcript && (
        <div className="bg-dark-400 px-4 py-2 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Word count: {transcript.trim().split(/\s+/).length}</span>
            <span>Characters: {transcript.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};
