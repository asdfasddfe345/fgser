import React, { useState } from 'react';
import { Upload, FileText, Code, Briefcase, Play, CheckCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { resumeParsingAdvancedService } from '../../services/resumeParsingAdvancedService';
import { adaptiveQuestionService } from '../../services/adaptiveQuestionService';
import { adaptiveInterviewSessionService } from '../../services/adaptiveInterviewSessionService';
import { AdaptiveInterviewRoom } from '../interview/AdaptiveInterviewRoom';
import { useAuth } from '../../contexts/AuthContext';

type Step = 'upload' | 'parsing' | 'configure' | 'generating' | 'interview' | 'completed';

export const ResumeBasedInterviewPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState<string>('');
  const [parsedData, setParsedData] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [config, setConfig] = useState({
    totalQuestions: 5,
    includeProjectQuestions: true,
    includeCodingQuestions: true,
    programmingLanguages: ['Python', 'JavaScript']
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain'
      ];

      if (!validTypes.includes(file.type)) {
        setError('Please upload a PDF, DOCX, or TXT file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
      setError('');
    }
  };

  const handleUploadAndParse = async () => {
    if (!selectedFile || !user) return;

    setStep('parsing');
    setError('');

    try {
      const result = await resumeParsingAdvancedService.uploadAndParseResume(selectedFile, user.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse resume');
      }

      setResumeId(result.resumeId);
      setParsedData(result.parsedData);
      setStep('configure');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process resume');
      setStep('upload');
    }
  };

  const startInterview = async () => {
    if (!user || !resumeId) return;

    setStep('generating');
    setError('');

    try {
      const newSessionId = await adaptiveInterviewSessionService.createSession(
        user.id,
        resumeId,
        {
          totalQuestions: config.totalQuestions,
          interviewType: 'resume_based',
          includeProjectQuestions: config.includeProjectQuestions,
          includeCodingQuestions: config.includeCodingQuestions,
          programmingLanguages: config.programmingLanguages
        }
      );

      const questions = await adaptiveQuestionService.generateQuestionsFromResume(
        parsedData,
        config
      );

      await adaptiveQuestionService.saveQuestionsToSession(newSessionId, questions);
      await adaptiveInterviewSessionService.startSession(newSessionId);

      setSessionId(newSessionId);
      setStep('interview');
    } catch (err) {
      console.error('Interview start error:', err);
      setError('Failed to start interview. Please try again.');
      setStep('configure');
    }
  };

  const handleInterviewComplete = () => {
    setStep('completed');
  };

  if (step === 'interview') {
    return <AdaptiveInterviewRoom sessionId={sessionId} onComplete={handleInterviewComplete} />;
  }

  if (step === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Interview Completed!</h1>
          <p className="text-gray-600 mb-8">
            Great job completing the interview. Your performance has been analyzed and a detailed report is being generated.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/mock-interview')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              View Report
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Start New Interview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Resume-Based Mock Interview</h1>
          <p className="text-lg text-gray-600">
            Upload your resume and get personalized interview questions based on your projects and experience
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Your Resume</h2>
                <p className="text-gray-600">We'll analyze your resume to create personalized interview questions</p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  id="resume-upload"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium mb-2">
                    {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-sm text-gray-500">PDF, DOCX, or TXT (max 5MB)</p>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={handleUploadAndParse}
                disabled={!selectedFile}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Parse Resume & Continue
              </button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">What We'll Extract:</h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>• Projects you've worked on</li>
                  <li>• Technical skills and technologies</li>
                  <li>• Experience level and duration</li>
                  <li>• Work history and achievements</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'parsing' && (
            <div className="text-center py-12">
              <Loader className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Analyzing Your Resume</h2>
              <p className="text-gray-600">Extracting projects, skills, and experience...</p>
            </div>
          )}

          {step === 'configure' && parsedData && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Resume Analysis Complete</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <Briefcase className="w-8 h-8 text-blue-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-800">{parsedData.projects.length}</div>
                    <div className="text-sm text-gray-600">Projects Found</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <Code className="w-8 h-8 text-green-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-800">{parsedData.skills.length}</div>
                    <div className="text-sm text-gray-600">Skills Identified</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <FileText className="w-8 h-8 text-purple-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-800 capitalize">{parsedData.experienceLevel}</div>
                    <div className="text-sm text-gray-600">Experience Level</div>
                  </div>
                </div>

                {parsedData.projects.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-800 mb-3">Projects We Found:</h3>
                    <div className="space-y-2">
                      {parsedData.projects.slice(0, 5).map((project: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                          <div className="font-medium text-gray-800">{project.name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            {project.technologies.slice(0, 5).join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Configure Your Interview</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Questions
                    </label>
                    <select
                      value={config.totalQuestions}
                      onChange={(e) => setConfig({ ...config, totalQuestions: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={3}>3 Questions (15-20 min)</option>
                      <option value={5}>5 Questions (25-30 min)</option>
                      <option value={7}>7 Questions (35-40 min)</option>
                      <option value={10}>10 Questions (50-60 min)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="project-questions"
                      checked={config.includeProjectQuestions}
                      onChange={(e) => setConfig({ ...config, includeProjectQuestions: e.target.checked })}
                      className="w-5 h-5 text-blue-600"
                    />
                    <label htmlFor="project-questions" className="text-gray-700">
                      Include questions about my projects
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="coding-questions"
                      checked={config.includeCodingQuestions}
                      onChange={(e) => setConfig({ ...config, includeCodingQuestions: e.target.checked })}
                      className="w-5 h-5 text-blue-600"
                    />
                    <label htmlFor="coding-questions" className="text-gray-700">
                      Include coding challenges with compiler
                    </label>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={startInterview}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Interview
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="text-center py-12">
              <Loader className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Generating Questions</h2>
              <p className="text-gray-600">Creating personalized interview questions based on your resume...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
