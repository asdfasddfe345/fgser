import React from 'react';
import { Building2, Code2, ArrowLeft } from 'lucide-react';
import { InterviewType } from '../../types/interview';

interface InterviewTypeSelectorProps {
  onTypeSelected: (type: InterviewType) => void;
  onBack: () => void;
}

export const InterviewTypeSelector: React.FC<InterviewTypeSelectorProps> = ({
  onTypeSelected,
  onBack
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900 dark:text-gray-400 dark:hover:text-gray-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-gray-100 mb-4">
            Choose Your Interview Type
          </h2>
          <p className="text-lg text-secondary-600 dark:text-gray-400">
            Select the type of mock interview you'd like to practice
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <button
            onClick={() => onTypeSelected('general')}
            className="group bg-white dark:bg-dark-200 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <Code2 className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-secondary-900 dark:text-gray-100 mb-2">
                  General Mock Interview
                </h3>
                <p className="text-secondary-600 dark:text-gray-400">
                  Practice common interview questions across different categories
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Technical & HR Questions</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Choose Your Role & Domain</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Flexible Duration Options</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Instant AI Feedback</span>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-dark-300 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">
                Perfect for: General preparation, skill building, and practice across various topics
              </p>
            </div>
          </button>

          <button
            onClick={() => onTypeSelected('company-based')}
            className="group bg-white dark:bg-dark-200 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-left border-2 border-transparent hover:border-purple-500 dark:hover:border-purple-400"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-secondary-900 dark:text-gray-100 mb-2">
                  Company-Based Interview
                </h3>
                <p className="text-secondary-600 dark:text-gray-400">
                  Prepare for specific companies with tailored questions
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Company-Specific Questions</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Role-Based Preparation</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Multiple Categories Available</span>
              </div>
              <div className="flex items-center gap-2 text-secondary-700 dark:text-gray-300">
                <span className="text-green-500 font-bold">✓</span>
                <span>Targeted Feedback</span>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-dark-300 rounded-lg p-4">
              <p className="text-sm text-purple-900 dark:text-purple-300 font-medium">
                Perfect for: Targeting specific companies like Google, Amazon, Infosys, TCS, and more
              </p>
            </div>
          </button>
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-dark-200 dark:to-dark-200 rounded-xl p-6">
          <h4 className="font-semibold text-secondary-900 dark:text-gray-100 mb-3">
            💡 Quick Tip
          </h4>
          <p className="text-secondary-700 dark:text-gray-300">
            Start with <strong>General Mock Interview</strong> if you're practicing for the first time or want to improve overall skills.
            Choose <strong>Company-Based Interview</strong> when you have a specific company interview coming up.
          </p>
        </div>
      </div>
    </div>
  );
};
