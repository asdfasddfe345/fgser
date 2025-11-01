import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { InterviewSetupWizard } from '../interview/InterviewSetupWizard';
import { MockInterviewRoom } from '../interview/MockInterviewRoom';
import { InterviewSummaryReport } from '../interview/InterviewSummaryReport';
import { InterviewConfig } from '../../types/interview';
import { UserResume } from '../../types/resumeInterview';
import { ArrowLeft, Sparkles } from 'lucide-react';

type FlowStage = 'welcome' | 'setup' | 'interview' | 'summary';

interface MockInterviewPageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

export const MockInterviewPage: React.FC<MockInterviewPageProps> = ({
  isAuthenticated,
  onShowAuth
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStage, setCurrentStage] = useState<FlowStage>('welcome');
  const [interviewConfig, setInterviewConfig] = useState<InterviewConfig | null>(null);
  const [selectedResume, setSelectedResume] = useState<UserResume | null>(null);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);

  const handleBack = () => {
    navigate(-1);
  };

  const handleStartInterview = () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    setCurrentStage('setup');
  };

  const handleConfigComplete = (config: InterviewConfig, resume: UserResume) => {
    setInterviewConfig(config);
    setSelectedResume(resume);
    setCurrentStage('interview');
  };

  const handleInterviewComplete = (sessionId: string) => {
    setCompletedSessionId(sessionId);
    setCurrentStage('summary');
  };

  const handleRetakeInterview = () => {
    setCurrentStage('welcome');
    setInterviewConfig(null);
    setSelectedResume(null);
    setCompletedSessionId(null);
  };

  const handleBackToSetup = () => {
    setCurrentStage('setup');
  };

  const renderWelcomeScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </button>

        <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-gray-100">
                AI Mock Interview
              </h1>
              <p className="text-sm text-secondary-600 dark:text-gray-400 mt-1">
                Beta Version - Practice with AI-Powered Feedback
              </p>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none mb-8">
            <p className="text-lg text-secondary-700 dark:text-gray-300 mb-4">
              Welcome to PrimoBoost AI's Mock Interview Practice Tool. Get real-time feedback from our AI interviewer and improve your interview skills.
            </p>

            <div className="bg-blue-50 dark:bg-dark-300 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-secondary-900 dark:text-gray-100 mb-3">
                How It Works:
              </h3>
              <ol className="space-y-2 text-secondary-700 dark:text-gray-300">
                <li>1. Upload your resume for personalized questions</li>
                <li>2. Choose interview category (Technical or HR)</li>
                <li>3. Set duration and preferences</li>
                <li>4. Answer questions in a meet-style interview environment</li>
                <li>5. Get comprehensive AI feedback and improvement tips</li>
              </ol>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-dark-300 dark:to-dark-300 rounded-lg p-4">
                <h4 className="font-semibold text-secondary-900 dark:text-gray-100 mb-2">
                  ✅ Features Available
                </h4>
                <ul className="text-sm text-secondary-700 dark:text-gray-300 space-y-1">
                  <li>• Resume-Based Questions</li>
                  <li>• Audio/Video Recording</li>
                  <li>• Real-time Speech-to-Text</li>
                  <li>• AI Feedback on Every Answer</li>
                  <li>• Detailed Performance Reports</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-dark-300 dark:to-dark-300 rounded-lg p-4">
                <h4 className="font-semibold text-secondary-900 dark:text-gray-100 mb-2">
                  🎯 What You'll Practice
                </h4>
                <ul className="text-sm text-secondary-700 dark:text-gray-300 space-y-1">
                  <li>• Technical Concepts</li>
                  <li>• Behavioral Questions</li>
                  <li>• HR Questions</li>
                  <li>• Communication Skills</li>
                  <li>• Confidence Building</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Note:</strong> Resume upload is mandatory. Your resume will be analyzed to provide personalized interview questions. We recommend using Chrome or Edge for the best experience.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  onShowAuth();
                } else {
                  navigate('/realistic-interview');
                }
              }}
              className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="w-5 h-5" />
              {isAuthenticated ? 'Start Interview' : 'Sign In to Start'}
            </button>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-dark-300 dark:to-dark-300 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                ✨ New: Enhanced Realistic Interview
              </h4>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <li>• Role-based question selection (General or Company-specific)</li>
                <li>• Project deep-dive with intelligent follow-ups</li>
                <li>• Code review with line-by-line explanations</li>
                <li>• Dynamic questions based on your answers</li>
                <li>• No repeated questions across sessions</li>
              </ul>
            </div>
          </div>

          {isAuthenticated && user && (
            <p className="text-center text-sm text-secondary-600 dark:text-gray-400 mt-4">
              Logged in as <strong>{user.name}</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {currentStage === 'welcome' && renderWelcomeScreen()}

      {currentStage === 'setup' && (
        <InterviewSetupWizard
          onConfigComplete={handleConfigComplete}
          onBack={() => setCurrentStage('welcome')}
        />
      )}

      {currentStage === 'interview' && interviewConfig && selectedResume && user && (
        <MockInterviewRoom
          config={interviewConfig}
          userId={user.id}
          userName={user.name}
          resume={selectedResume}
          onInterviewComplete={handleInterviewComplete}
          onBack={handleBackToSetup}
        />
      )}

      {currentStage === 'summary' && completedSessionId && (
        <InterviewSummaryReport
          sessionId={completedSessionId}
          onRetake={handleRetakeInterview}
          onBackHome={() => navigate('/')}
        />
      )}
    </>
  );
};
