import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SmartInterviewRoom } from '../interview/SmartInterviewRoom';
import { InterviewSummaryReport } from '../interview/InterviewSummaryReport';
import { InterviewTypeSelector } from '../interview/InterviewTypeSelector';
import { RoleSelectionScreen } from '../interview/RoleSelectionScreen';
import { CompanyRoleSelectionScreen } from '../interview/CompanyRoleSelectionScreen';
import { DurationConfigScreen } from '../interview/DurationConfigScreen';
import { SmartInterviewConfig } from '../../services/smartInterviewService';

interface SmartInterviewPageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

type Step =
  | 'type_selection'
  | 'role_selection'
  | 'company_selection'
  | 'duration_selection'
  | 'interview'
  | 'summary';

export const SmartInterviewPage: React.FC<SmartInterviewPageProps> = ({
  isAuthenticated,
  onShowAuth
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('type_selection');
  const [config, setConfig] = useState<Partial<SmartInterviewConfig>>({});
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-secondary-900 dark:text-gray-100 mb-4">
            Smart AI Interview
          </h2>
          <p className="text-secondary-600 dark:text-gray-400 mb-8">
            Experience intelligent interview practice with automatic code compilation, dynamic follow-up questions, and AI-powered feedback.
          </p>
          <button
            onClick={onShowAuth}
            className="btn-primary px-8 py-3 text-lg"
          >
            Sign In to Start
          </button>
        </div>
      </div>
    );
  }

  const handleTypeSelected = (type: 'general' | 'company-based') => {
    setConfig({ ...config, sessionType: type });
    if (type === 'general') {
      setStep('role_selection');
    } else {
      setStep('company_selection');
    }
  };

  const handleRoleSelected = (role: string, domain: string, category: string) => {
    setConfig({
      ...config,
      targetRole: role,
      domain: domain,
      interviewCategory: category
    });
    setStep('duration_selection');
  };

  const handleCompanySelected = (company: string, role: string, category: string) => {
    setConfig({
      ...config,
      companyName: company,
      targetRole: role,
      interviewCategory: category
    });
    setStep('duration_selection');
  };

  const handleDurationSelected = (minutes: number) => {
    setConfig({
      ...config,
      durationMinutes: minutes
    });
    setStep('interview');
  };

  const handleInterviewComplete = (sessionId: string) => {
    setCompletedSessionId(sessionId);
    setStep('summary');
  };

  const handleBackToTypeSelection = () => {
    setStep('type_selection');
    setConfig({});
  };

  const handleBackToRoleSelection = () => {
    if (config.sessionType === 'general') {
      setStep('role_selection');
    } else {
      setStep('company_selection');
    }
  };

  const handleBackToDuration = () => {
    setStep('duration_selection');
  };

  const handleStartNewInterview = () => {
    setStep('type_selection');
    setConfig({});
    setCompletedSessionId(null);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  if (step === 'type_selection') {
    return (
      <InterviewTypeSelector
        onTypeSelected={handleTypeSelected}
        onBack={handleBackToHome}
      />
    );
  }

  if (step === 'role_selection') {
    return (
      <RoleSelectionScreen
        onRoleSelected={handleRoleSelected}
        onBack={handleBackToTypeSelection}
      />
    );
  }

  if (step === 'company_selection') {
    return (
      <CompanyRoleSelectionScreen
        onCompanySelected={handleCompanySelected}
        onBack={handleBackToTypeSelection}
      />
    );
  }

  if (step === 'duration_selection') {
    return (
      <DurationConfigScreen
        onDurationSelected={handleDurationSelected}
        onBack={handleBackToRoleSelection}
      />
    );
  }

  if (step === 'interview' && user) {
    return (
      <SmartInterviewRoom
        config={config as SmartInterviewConfig}
        userId={user.id}
        userName={user.email || 'Candidate'}
        onInterviewComplete={handleInterviewComplete}
        onBack={handleBackToDuration}
      />
    );
  }

  if (step === 'summary' && completedSessionId) {
    return (
      <InterviewSummaryReport
        sessionId={completedSessionId}
        onStartNewInterview={handleStartNewInterview}
        onBackToHome={handleBackToHome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-dark-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-300 text-lg">Loading...</p>
      </div>
    </div>
  );
};
