import React, { useState } from 'react';
import { ArrowLeft, Clock, Target, Sparkles, AlertCircle } from 'lucide-react';
import { InterviewType, InterviewConfig, InterviewCategory } from '../../types/interview';
import { UserResume } from '../../types/resumeInterview';

interface DurationConfigScreenProps {
  interviewType: InterviewType;
  selectedRole: string;
  selectedCompany?: string;
  resume: UserResume;
  onConfigComplete: (config: InterviewConfig) => void;
  onBack: () => void;
}

const DURATION_OPTIONS = [15, 20, 25, 30, 35, 40, 45];

export const DurationConfigScreen: React.FC<DurationConfigScreenProps> = ({
  interviewType,
  selectedRole,
  selectedCompany,
  resume,
  onConfigComplete,
  onBack
}) => {
  const [duration, setDuration] = useState(20);
  const [category, setCategory] = useState<InterviewCategory>('mixed');

  const estimatedQuestions = Math.ceil(duration / 3);

  const handleStart = () => {
    const config: InterviewConfig = {
      sessionType: interviewType,
      interviewCategory: category,
      companyName: selectedCompany,
      targetRole: selectedRole,
      durationMinutes: duration
    };

    onConfigComplete(config);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900 dark:text-gray-400 dark:hover:text-gray-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-gray-100 mb-4">
            Configure Your Interview
          </h2>
          <p className="text-lg text-secondary-600 dark:text-gray-400">
            Set your preferences before starting the interview
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-200 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-300">
            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                <Clock className="inline w-5 h-5 mr-2" />
                Interview Duration: {duration} minutes
              </label>
              <input
                type="range"
                min={15}
                max={45}
                step={5}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 dark:bg-dark-400 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
                {DURATION_OPTIONS.map((d) => (
                  <span key={d} className={duration === d ? 'font-bold text-blue-600 dark:text-blue-400' : ''}>
                    {d}m
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Estimated {estimatedQuestions} questions (including follow-ups)
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> We recommend at least 20 minutes for a comprehensive interview experience.
                Shorter durations may limit the depth of question coverage.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-200 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-300">
            <label className="block text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Interview Category
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setCategory('technical')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  category === 'technical'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 shadow-lg'
                    : 'border-gray-200 dark:border-dark-300 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
              >
                <div className="text-center">
                  <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                    category === 'technical' ? 'bg-blue-500' : 'bg-gray-200 dark:bg-dark-400'
                  }`}>
                    <span className={`text-2xl ${category === 'technical' ? 'text-white' : 'text-gray-500'}`}>
                      💻
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Technical Only</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Coding, algorithms, system design
                  </p>
                </div>
              </button>

              <button
                onClick={() => setCategory('hr')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  category === 'hr'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400 shadow-lg'
                    : 'border-gray-200 dark:border-dark-300 hover:border-purple-300 dark:hover:border-purple-600'
                }`}
              >
                <div className="text-center">
                  <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                    category === 'hr' ? 'bg-purple-500' : 'bg-gray-200 dark:bg-dark-400'
                  }`}>
                    <span className={`text-2xl ${category === 'hr' ? 'text-white' : 'text-gray-500'}`}>
                      👥
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">HR & Behavioral</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Soft skills, teamwork, leadership
                  </p>
                </div>
              </button>

              <button
                onClick={() => setCategory('mixed')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  category === 'mixed'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400 shadow-lg'
                    : 'border-gray-200 dark:border-dark-300 hover:border-green-300 dark:hover:border-green-600'
                }`}
              >
                <div className="text-center">
                  <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                    category === 'mixed' ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-400'
                  }`}>
                    <span className={`text-2xl ${category === 'mixed' ? 'text-white' : 'text-gray-500'}`}>
                      ⚡
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">Mixed (Recommended)</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Technical + HR + Behavioral
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-dark-200 dark:to-dark-200 rounded-xl p-6 border border-gray-200 dark:border-dark-300">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Interview Summary
            </h4>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-dark-300 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Interview Type</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {interviewType === 'company-based' ? 'Company-Based' : 'General'}
                </p>
              </div>

              <div className="bg-white dark:bg-dark-300 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Target Role</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedRole}</p>
              </div>

              {selectedCompany && (
                <div className="bg-white dark:bg-dark-300 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Company</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedCompany}</p>
                </div>
              )}

              <div className="bg-white dark:bg-dark-300 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Resume Analyzed</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{resume.file_name}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6">
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Important Guidelines
            </h4>
            <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2">
              <li>The interview will start in full-screen mode for a realistic experience</li>
              <li>Questions are based on your resume, role, and selected category</li>
              <li>You'll receive follow-up questions based on your answers</li>
              <li>Code questions include real-time execution and review</li>
              <li>Project questions will dive deep into your resume projects</li>
              <li>Answer quality determines the next question's difficulty</li>
              <li>Tab switches and violations are tracked for security</li>
            </ul>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-5 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
          >
            <Sparkles className="w-6 h-6" />
            <span>Start Interview Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
