import React, { useState } from 'react';
import { Maximize2, Minimize2, Copy, Check } from 'lucide-react';

interface EnhancedCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  placeholder?: string;
  height?: string;
}

export const EnhancedCodeEditor: React.FC<EnhancedCodeEditorProps> = ({
  value,
  onChange,
  language,
  placeholder = 'Write your code here...',
  height = '400px'
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 20) }, (_, i) => i + 1);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-dark-100 p-6' : 'relative'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Code Editor - {language}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-2 bg-dark-300 hover:bg-dark-400 text-gray-400 hover:text-gray-200 rounded transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-dark-300 hover:bg-dark-400 text-gray-400 hover:text-gray-200 rounded transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="bg-dark-400 rounded-lg border border-gray-700 overflow-hidden flex">
        <div className="bg-dark-500 px-3 py-4 text-right select-none">
          {lineNumbers.map((num) => (
            <div
              key={num}
              className="text-gray-500 text-sm font-mono leading-6"
              style={{ height: '24px' }}
            >
              {num}
            </div>
          ))}
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-4 py-4 bg-dark-400 text-green-400 font-mono text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-auto"
          placeholder={placeholder}
          style={{ height: isFullscreen ? 'calc(100vh - 120px)' : height }}
          spellCheck={false}
        />
      </div>

      {isFullscreen && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsFullscreen(false)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Exit Fullscreen
          </button>
        </div>
      )}
    </div>
  );
};
