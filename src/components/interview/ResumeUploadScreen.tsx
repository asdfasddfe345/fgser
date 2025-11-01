import React, { useState } from 'react';
import { ArrowLeft, Upload, FileText, Loader2, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resumeAnalysisService } from '../../services/resumeAnalysisService';
import { UserResume } from '../../types/resumeInterview';
import { InterviewType } from '../../types/interview';

interface ResumeUploadScreenProps {
  interviewType: InterviewType;
  selectedRole: string;
  selectedCompany?: string;
  onResumeUploaded: (resume: UserResume) => void;
  onBack: () => void;
}

export const ResumeUploadScreen: React.FC<ResumeUploadScreenProps> = ({
  interviewType,
  selectedRole,
  selectedCompany,
  onResumeUploaded,
  onBack
}) => {
  const { user } = useAuth();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedResume, setUploadedResume] = useState<UserResume | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5242880) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only PDF and DOCX files are allowed');
      return;
    }

    setResumeFile(file);
    setUploadError(null);
    handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    if (!user) return;

    setIsUploading(true);
    setIsAnalyzing(true);
    setUploadError(null);

    try {
      const resume = await resumeAnalysisService.uploadAndAnalyzeResume(file, user.id);
      setUploadedResume(resume);

      const analyzedResume = await resumeAnalysisService.waitForAnalysis(resume.id, 20);
      setUploadedResume(analyzedResume);
      setIsAnalyzing(false);

      setTimeout(() => {
        onResumeUploaded(analyzedResume);
      }, 1500);
    } catch (error: any) {
      console.error('Resume upload error:', error);
      setUploadError(error.message || 'Failed to upload and analyze resume');
      setIsAnalyzing(false);
    } finally {
      setIsUploading(false);
    }
  };

  const renderAnalysisProgress = () => {
    if (!uploadedResume) return null;

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border-2 border-blue-500 dark:border-blue-400">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-2">
                {uploadedResume.file_name}
              </h4>
              {isAnalyzing ? (
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Analyzing your resume with AI...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Analysis Complete!</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {uploadedResume.analysis_completed && (
          <div className="bg-white dark:bg-dark-200 rounded-xl p-6 border border-gray-200 dark:border-dark-300">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Resume Analysis Results
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Experience Level</p>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-lg capitalize">
                  {uploadedResume.experience_level || 'Not Detected'}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Skills Detected</p>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                  {uploadedResume.skills_detected.length}
                </p>
              </div>
            </div>

            {uploadedResume.skills_detected.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Key Skills Found:
                </p>
                <div className="flex flex-wrap gap-2">
                  {uploadedResume.skills_detected.slice(0, 12).map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Your interview questions will be personalized based on these skills and your experience level.
              </p>
            </div>
          </div>
        )}
      </div>
    );
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

        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-gray-100 mb-4">
            Upload Your Resume
          </h2>
          <p className="text-lg text-secondary-600 dark:text-gray-400 mb-2">
            {interviewType === 'company-based' && selectedCompany
              ? `Preparing for ${selectedCompany} - ${selectedRole}`
              : `Preparing for ${selectedRole}`}
          </p>
          <p className="text-sm text-secondary-500 dark:text-gray-500">
            We'll analyze your resume to create personalized interview questions
          </p>
        </div>

        {!uploadedResume ? (
          <div className="bg-white dark:bg-dark-200 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-dark-300">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
              <label className="cursor-pointer block">
                <div className="text-center">
                  <Upload className="w-20 h-20 mx-auto mb-6 text-gray-400 dark:text-gray-500" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {resumeFile ? resumeFile.name : 'Click to upload your resume'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Supported formats: PDF, DOCX (max 5MB)
                  </p>
                  {isUploading && (
                    <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading and analyzing...</span>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>

            {uploadError && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
                </div>
              </div>
            )}

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Why do we need your resume?
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>Generate questions based on your actual experience and skills</li>
                <li>Ask about specific projects mentioned in your resume</li>
                <li>Tailor difficulty level to match your experience</li>
                <li>Create realistic follow-up questions based on your background</li>
                <li>Provide personalized feedback relevant to your career level</li>
              </ul>
            </div>
          </div>
        ) : (
          renderAnalysisProgress()
        )}
      </div>
    </div>
  );
};
