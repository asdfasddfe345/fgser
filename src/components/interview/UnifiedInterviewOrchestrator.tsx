import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { InterviewTypeSelector } from './InterviewTypeSelector';
import { RoleSelectionScreen } from './RoleSelectionScreen';
import { CompanyRoleSelectionScreen } from './CompanyRoleSelectionScreen';
import { ResumeUploadScreen } from './ResumeUploadScreen';
import { DurationConfigScreen } from './DurationConfigScreen';
import { RealisticInterviewRoom } from './RealisticInterviewRoom';
import { InterviewSummaryReport } from './InterviewSummaryReport';
import { InterviewType, InterviewConfig } from '../../types/interview';
import { UserResume } from '../../types/resumeInterview';

type FlowStage =
  | 'type-selection'
  | 'role-selection'
  | 'company-role-selection'
  | 'resume-upload'
  | 'duration-config'
  | 'interview'
  | 'summary';

export const UnifiedInterviewOrchestrator: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStage, setCurrentStage] = useState<FlowStage>('type-selection');
  const [interviewType, setInterviewType] = useState<InterviewType>('general');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [uploadedResume, setUploadedResume] = useState<UserResume | null>(null);
  const [interviewConfig, setInterviewConfig] = useState<InterviewConfig | null>(null);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);

  const handleTypeSelected = (type: InterviewType) => {
    setInterviewType(type);
    if (type === 'general') {
      setCurrentStage('role-selection');
    } else {
      setCurrentStage('company-role-selection');
    }
  };

  const handleRoleSelected = (role: string) => {
    setSelectedRole(role);
    setCurrentStage('resume-upload');
  };

  const handleCompanyRoleSelected = (company: string, role: string) => {
    setSelectedCompany(company);
    setSelectedRole(role);
    setCurrentStage('resume-upload');
  };

  const handleResumeUploaded = (resume: UserResume) => {
    setUploadedResume(resume);
    setCurrentStage('duration-config');
  };

  const handleDurationConfigured = (config: InterviewConfig) => {
    setInterviewConfig(config);
    setCurrentStage('interview');
  };

  const handleInterviewComplete = (sessionId: string) => {
    setCompletedSessionId(sessionId);
    setCurrentStage('summary');
  };

  const handleRetake = () => {
    setCurrentStage('type-selection');
    setInterviewType('general');
    setSelectedRole('');
    setSelectedCompany('');
    setUploadedResume(null);
    setInterviewConfig(null);
    setCompletedSessionId(null);
  };

  const handleBack = () => {
    if (currentStage === 'role-selection' || currentStage === 'company-role-selection') {
      setCurrentStage('type-selection');
    } else if (currentStage === 'resume-upload') {
      if (interviewType === 'general') {
        setCurrentStage('role-selection');
      } else {
        setCurrentStage('company-role-selection');
      }
    } else if (currentStage === 'duration-config') {
      setCurrentStage('resume-upload');
    } else if (currentStage === 'interview') {
      setCurrentStage('duration-config');
    } else {
      navigate(-1);
    }
  };

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <>
      {currentStage === 'type-selection' && (
        <InterviewTypeSelector
          onTypeSelected={handleTypeSelected}
          onBack={() => navigate(-1)}
        />
      )}

      {currentStage === 'role-selection' && (
        <RoleSelectionScreen
          onRoleSelected={handleRoleSelected}
          onBack={handleBack}
        />
      )}

      {currentStage === 'company-role-selection' && (
        <CompanyRoleSelectionScreen
          onCompanyRoleSelected={handleCompanyRoleSelected}
          onBack={handleBack}
        />
      )}

      {currentStage === 'resume-upload' && (
        <ResumeUploadScreen
          interviewType={interviewType}
          selectedRole={selectedRole}
          selectedCompany={selectedCompany}
          onResumeUploaded={handleResumeUploaded}
          onBack={handleBack}
        />
      )}

      {currentStage === 'duration-config' && uploadedResume && (
        <DurationConfigScreen
          interviewType={interviewType}
          selectedRole={selectedRole}
          selectedCompany={selectedCompany}
          resume={uploadedResume}
          onConfigComplete={handleDurationConfigured}
          onBack={handleBack}
        />
      )}

      {currentStage === 'interview' && interviewConfig && uploadedResume && (
        <RealisticInterviewRoom
          config={interviewConfig}
          resume={uploadedResume}
          userId={user.id}
          userName={user.name}
          onInterviewComplete={handleInterviewComplete}
          onBack={handleBack}
        />
      )}

      {currentStage === 'summary' && completedSessionId && (
        <InterviewSummaryReport
          sessionId={completedSessionId}
          onRetake={handleRetake}
          onBackHome={() => navigate('/')}
        />
      )}
    </>
  );
};
