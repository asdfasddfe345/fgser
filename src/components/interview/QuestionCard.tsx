import React from 'react';
import { Code, MessageSquare, Clock, Zap } from 'lucide-react';

interface QuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  questionText: string;
  questionType: string;
  difficulty: string;
  requiresCoding: boolean;
  relatedSkills?: string[];
  expectedDuration?: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  questionNumber,
  totalQuestions,
  questionText,
  questionType,
  difficulty,
  requiresCoding,
  relatedSkills = [],
  expectedDuration
}) => {
  const getDifficultyColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'easy':
        return 'bg-green-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      case 'hard':
        return 'bg-red-600 text-white';
      default:
        return 'bg-blue-600 text-white';
    }
  };

  const getTypeIcon = () => {
    if (requiresCoding) {
      return <Code className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  return (
    <div className="bg-dark-200 rounded-xl border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-2xl font-bold">
              Question {questionNumber} of {totalQuestions}
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              {questionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
          </div>
          {expectedDuration && (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-2 rounded-lg">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white font-semibold">{expectedDuration} min</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${getDifficultyColor(difficulty)}`}>
            <Zap className="w-3.5 h-3.5" />
            {difficulty.toUpperCase()}
          </span>

          {requiresCoding && (
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-purple-600 text-white`}>
              {getTypeIcon()}
              {'CODING'}
            </span>
          )}

          {relatedSkills.slice(0, 3).map((skill, idx) => (
            <span
              key={idx}
              className="px-3 py-1.5 bg-gray-700 text-gray-200 rounded-full text-xs font-medium"
            >
              {skill}
            </span>
          ))}

          {relatedSkills.length > 3 && (
            <span className="px-3 py-1.5 bg-gray-700 text-gray-400 rounded-full text-xs font-medium">
              +{relatedSkills.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-6">
        <p className="text-gray-100 text-lg leading-relaxed font-medium">
          {questionText}
        </p>
      </div>
    </div>
  );
};
