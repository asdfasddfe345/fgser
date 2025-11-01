import React from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Sparkles,
  Send,
  AlertCircle,
} from 'lucide-react';
import { AutoApplyStatus } from '../../services/autoApplyOrchestratorService';

interface AutoApplyStatusModalProps {
  isOpen: boolean;
  status: AutoApplyStatus;
  jobTitle?: string;
  companyName?: string;
}

export const AutoApplyStatusModal: React.FC<AutoApplyStatusModalProps> = ({
  isOpen,
  status,
  jobTitle,
  companyName,
}) => {
  if (!isOpen) return null;

  const getStepIcon = (stepName: string) => {
    if (status.step === 'failed') {
      return <XCircle className="w-8 h-8 text-red-500" />;
    }
    if (status.step === 'completed') {
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    }
    if (stepName === status.step) {
      return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
    }
    if (status.progress > getStepProgress(stepName)) {
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    }
    return <div className="w-8 h-8 rounded-full border-4 border-gray-300 dark:border-dark-300" />;
  };

  const getStepProgress = (stepName: string): number => {
    const stepMap: Record<string, number> = {
      analyzing: 10,
      suggesting_projects: 30,
      optimizing: 50,
      generating_pdf: 70,
      submitting: 85,
      completed: 100,
    };
    return stepMap[stepName] || 0;
  };

  const steps = [
    {
      key: 'analyzing',
      label: 'Analyzing Resume',
      icon: FileText,
      description: 'Calculating match score with job requirements',
    },
    {
      key: 'suggesting_projects',
      label: 'AI Project Suggestions',
      icon: Sparkles,
      description: 'Generating personalized project recommendations',
    },
    {
      key: 'optimizing',
      label: 'Optimizing Resume',
      icon: FileText,
      description: 'Enhancing resume with selected projects',
    },
    {
      key: 'generating_pdf',
      label: 'Creating PDF',
      icon: FileText,
      description: 'Generating formatted resume document',
    },
    {
      key: 'submitting',
      label: 'Submitting Application',
      icon: Send,
      description: 'Filling out and submitting application form',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {status.step === 'completed' ? (
              <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
              </div>
            ) : status.step === 'failed' ? (
              <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                <XCircle className="w-16 h-16 text-red-600 dark:text-red-400" />
              </div>
            ) : (
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {status.step === 'completed'
              ? 'Application Submitted!'
              : status.step === 'failed'
              ? 'Application Failed'
              : 'Submitting Application'}
          </h2>

          {jobTitle && companyName && (
            <p className="text-gray-600 dark:text-gray-400">
              {jobTitle} at {companyName}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {status.message}
            </span>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {status.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-dark-300 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-purple-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${status.progress}%` }}
            />
          </div>
          {status.currentAction && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {status.currentAction}
            </p>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => {
            const isActive = status.step === step.key;
            const isCompleted = status.progress > getStepProgress(step.key);
            const StepIcon = step.icon;

            return (
              <div
                key={step.key}
                className={`flex items-start space-x-4 p-4 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
                    : isCompleted
                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                    : 'bg-gray-50 dark:bg-dark-50 border-2 border-transparent'
                }`}
              >
                <div className="flex-shrink-0">{getStepIcon(step.key)}</div>
                <div className="flex-1">
                  <h3
                    className={`font-semibold mb-1 ${
                      isActive
                        ? 'text-blue-900 dark:text-blue-100'
                        : isCompleted
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {step.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Success Message */}
        {status.step === 'completed' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                  Successfully Applied!
                </h3>
                <p className="text-sm text-green-800 dark:text-green-300">
                  Your application has been submitted with an AI-optimized resume. You can track
                  the status in your dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {status.step === 'failed' && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                  Application Failed
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300">
                  {status.currentAction ||
                    'Something went wrong. Please try again or apply manually.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {(status.step === 'completed' || status.step === 'failed') && (
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
            >
              {status.step === 'completed' ? 'View Applications' : 'Try Again'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
