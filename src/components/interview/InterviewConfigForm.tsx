import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Briefcase,
  Clock,
  Target,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Loader2,
  Sparkles,
  AlertCircle,
  Building2,
  User
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resumeAnalysisService } from '../../services/resumeAnalysisService';
import { UserResume } from '../../types/resumeInterview';
import {
  InterviewType,
  InterviewCategory,
  InterviewConfig,
  POPULAR_COMPANIES,
  TECHNICAL_DOMAINS,
  DURATION_OPTIONS
} from '../../types/interview';

interface InterviewSetupWizardProps {
  onConfigComplete: (config: InterviewConfig, resume: UserResume) => void;
  onBack: () => void;
}

export const InterviewSetupWizard: React.FC<InterviewSetupWizardProps> = ({
  onConfigComplete,
  onBack
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadedResume, setUploadedResume] = useState<UserResume | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [category, setCategory] = useState<InterviewCategory | ''>('');
  const [domain, setDomain] = useState('');

  const [duration, setDuration] = useState(15);
  const [targetRole, setTargetRole] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>('general');
  const [companyName, setCompanyName] = useState('');

  const selectedCompany = POPULAR_COMPANIES.find(c => c.name === companyName);

  const handleResumeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = resumeAnalysisService['resumeParsingService']?.validateFile?.(file) ||
                       { valid: file.size <= 5242880, error: file.size > 5242880 ? 'File too large' : undefined };

    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file');
      return;
    }

    setResumeFile(file);
    setUploadError(null);
  };

  const handleUploadResume = async () => {
    if (!resumeFile || !user) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const resume = await resumeAnalysisService.uploadAndAnalyzeResume(resumeFile, user.id);
      setUploadedResume(resume);

      const analyzedResume = await resumeAnalysisService.waitForAnalysis(resume.id, 15);
      setUploadedResume(analyzedResume);
    } catch (error: any) {
      console.error('Resume upload error:', error);
      setUploadError(error.message || 'Failed to upload resume');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveResume = () => {
    setResumeFile(null);
    setUploadedResume(null);
    setUploadError(null);
  };

  const handleSubmit = () => {
    if (!uploadedResume || !category) {
      alert('Please complete all required steps');
      return;
    }

    const config: InterviewConfig = {
      sessionType: interviewType,
      interviewCategory: category as InterviewCategory,
      companyName: interviewType === 'company-based' ? companyName : undefined,
      targetRole: targetRole || undefined,
      domain: category === 'technical' ? domain : undefined,
      durationMinutes: duration
    };

    onConfigComplete(config, uploadedResume);
  };

  const steps = [
    {
      id: 'resume',
      title: 'Upload Resume',
      icon: <Upload className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
              <Upload className="w-6 h-6 mr-3 text-blue-600 dark:text-blue-400" />
              Step 1: Upload Your Resume
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Upload your resume to get personalized interview questions based on your skills and experience.
            </p>
          </div>

          {!uploadedResume ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                <label className="cursor-pointer block">
                  <div className="text-center">
                    <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 max-w-[28rem] truncate mx-auto" title={resumeFile ? resumeFile.name : undefined}>
                      {resumeFile ? resumeFile.name : 'Click to upload your resume'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Supported formats: PDF, DOCX (max 5MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={handleResumeFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {resumeFile && (
                <button
                  onClick={handleUploadResume}
                  disabled={isUploading}
                  className="w-full btn-primary py-4 text-lg font-semibold flex items-center justify-center gap-3"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing Resume...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload & Analyze Resume
                    </>
                  )}
                </button>
              )}

              {uploadError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  📌 Why upload your resume?
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Get questions tailored to your experience level</li>
                  <li>• Practice with skills from your actual resume</li>
                  <li>• Receive personalized feedback on your answers</li>
                  <li>• Better preparation for real interviews</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border-2 border-green-500 dark:border-green-600">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg max-w-[26rem] sm:max-w-[32rem] truncate" title={uploadedResume.file_name}>
                        {uploadedResume.file_name}
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {uploadedResume.analysis_completed ? '✓ Analysis Complete' : '⏳ Analyzing...'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveResume}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>

                {uploadedResume.analysis_completed && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-dark-300 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Experience Level</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {uploadedResume.experience_level || 'N/A'}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-dark-300 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Skills Detected</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {uploadedResume.skills_detected.length}
                        </p>
                      </div>
                    </div>

                    {uploadedResume.skills_detected.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top Skills:</p>
                        <div className="flex flex-wrap gap-2">
                          {uploadedResume.skills_detected.slice(0, 8).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ),
      isValid: uploadedResume !== null && uploadedResume.analysis_completed === true
    },
    {
      id: 'category',
      title: 'Interview Category',
      icon: <Briefcase className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
              <Briefcase className="w-6 h-6 mr-3 text-green-600 dark:text-green-400" />
              Step 2: Choose Interview Category
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Select the type of interview you want to practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setCategory('technical')}
              className={`p-6 rounded-xl border-2 transition-all ${
                category === 'technical'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 shadow-lg'
                  : 'border-gray-200 dark:border-dark-300 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                  category === 'technical' ? 'bg-blue-500' : 'bg-gray-200 dark:bg-dark-400'
                }`}>
                  <Briefcase className={`w-8 h-8 ${category === 'technical' ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Technical Interview</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Coding, algorithms, system design, and technical concepts
                </p>
              </div>
            </button>

            <button
              onClick={() => setCategory('hr')}
              className={`p-6 rounded-xl border-2 transition-all ${
                category === 'hr'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400 shadow-lg'
                  : 'border-gray-200 dark:border-dark-300 hover:border-purple-300 dark:hover:border-purple-600'
              }`}
            >
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                  category === 'hr' ? 'bg-purple-500' : 'bg-gray-200 dark:bg-dark-400'
                }`}>
                  <User className={`w-8 h-8 ${category === 'hr' ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">HR Interview</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Behavioral questions, soft skills, and cultural fit
                </p>
              </div>
            </button>
          </div>

          {category === 'technical' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Technical Domain (Optional)
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-300 dark:text-gray-100"
              >
                <option value="">All Domains</option>
                {TECHNICAL_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {uploadedResume && uploadedResume.skills_detected.length > 0 && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
              <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                💡 Based on your resume skills: {uploadedResume.skills_detected.slice(0, 3).join(', ')}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                We'll tailor questions to match your experience level and skills.
              </p>
            </div>
          )}
        </div>
      ),
      isValid: category !== ''
    },
    {
      id: 'preferences',
      title: 'Duration & Preferences',
      icon: <Clock className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
              <Clock className="w-6 h-6 mr-3 text-purple-600 dark:text-purple-400" />
              Step 3: Set Duration & Preferences
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Configure your interview settings.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                <Clock className="inline w-4 h-4 mr-2" />
                Interview Duration: {duration} minutes
              </label>
              <input
                type="range"
                min={DURATION_OPTIONS[0]}
                max={DURATION_OPTIONS[DURATION_OPTIONS.length - 1]}
                step={5}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 dark:bg-dark-400 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                {DURATION_OPTIONS.map((d) => (
                  <span key={d}>{d}m</span>
                ))}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                ≈ {Math.ceil(duration / 3)} questions
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                <Target className="inline w-4 h-4 mr-2" />
                Target Role (Optional)
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g., Software Engineer, Product Manager"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-dark-300 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Interview Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInterviewType('general')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    interviewType === 'general'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-dark-400'
                  }`}
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-100">General</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInterviewType('company-based')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    interviewType === 'company-based'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-dark-400'
                  }`}
                >
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Company-Based</span>
                </button>
              </div>
            </div>

            {interviewType === 'company-based' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    <Building2 className="inline w-4 h-4 mr-2" />
                    Select Company
                  </label>
                  <select
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-dark-300 dark:text-gray-100"
                  >
                    <option value="">Choose a company...</option>
                    {POPULAR_COMPANIES.map((company) => (
                      <option key={company.name} value={company.name}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCompany && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      Select Role
                    </label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-dark-300 dark:text-gray-100"
                    >
                      <option value="">Choose a role...</option>
                      {selectedCompany.roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ),
      isValid: duration >= 10 && duration <= 30
    },
    {
      id: 'review',
      title: 'Review & Start',
      icon: <Sparkles className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
              <Sparkles className="w-6 h-6 mr-3 text-orange-600 dark:text-orange-400" />
              Step 4: Review & Confirm
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Review your interview configuration and start when ready.
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">Interview Summary</h3>

              <div className="space-y-3">
                {uploadedResume && (
                  <div className="flex items-center justify-between bg-white dark:bg-dark-300 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Resume</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[22rem] sm:max-w-[30rem] truncate" title={uploadedResume.file_name}>{uploadedResume.file_name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentStep(0)}
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between bg-white dark:bg-dark-300 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Category</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {category} {domain && `- ${domain}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                  >
                    Edit
                  </button>
                </div>

                <div className="flex items-center justify-between bg-white dark:bg-dark-300 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Duration</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{duration} minutes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                  >
                    Edit
                  </button>
                </div>

                {targetRole && (
                  <div className="flex items-center justify-between bg-white dark:bg-dark-300 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Target Role</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{targetRole}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}

                {companyName && (
                  <div className="flex items-center justify-between bg-white dark:bg-dark-300 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Company</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{companyName}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Important Guidelines
              </h4>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                <li>• The interview will run in full-screen mode</li>
                <li>• Do not switch tabs or minimize the window</li>
                <li>• Your camera and microphone will be used</li>
                <li>• Security violations will be tracked</li>
                <li>• Answers auto-submit after 5 seconds of silence</li>
              </ul>
            </div>

            <button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
            >
              <Sparkles className="w-6 h-6" />
              <span>Start Interview</span>
            </button>
          </div>
        </div>
      ),
      isValid: true
    }
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1 && currentStepData.isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const itemBaseWidth = 96;
  const itemMarginRight = 16;
  const itemFullWidth = itemBaseWidth + itemMarginRight;
  const visibleIconsCount = 3;
  const maxScrollLeft = -(Math.max(0, steps.length - visibleIconsCount) * itemFullWidth);

  let translateX = 0;
  const targetCenterIndex = Math.floor(visibleIconsCount / 2);

  if (currentStep > targetCenterIndex) {
    translateX = -(currentStep - targetCenterIndex) * itemFullWidth;
  }

  translateX = Math.max(maxScrollLeft, translateX);
  translateX = Math.min(0, translateX);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="bg-white dark:bg-dark-200 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-300 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Mock Interview Setup
            </h1>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>

          <div className="relative overflow-x-auto overflow-hidden w-[320px] mx-auto md:w-auto">
            <div
              className="flex items-center space-x-4 mb-6 transition-transform duration-300"
              style={{ transform: `translateX(${translateX}px)` }}
            >
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center w-24 flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        index < currentStep
                          ? 'bg-green-500 text-white'
                          : index === currentStep
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-500 dark:bg-dark-400 dark:text-gray-400'
                      }`}
                    >
                      {index < currentStep ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium text-center ${
                        index <= currentStep ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                        index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-400'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="text-center mb-4">
            <div className="w-full bg-gray-200 dark:bg-dark-400 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mb-6">{currentStepData.component}</div>

        {currentStep < steps.length - 1 && (
          <div className="bg-white dark:bg-dark-200 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex justify-between items-center gap-4">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  currentStep === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-dark-400'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Previous</span>
              </button>

              <button
                onClick={handleNext}
                disabled={!currentStepData.isValid}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  !currentStepData.isValid
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-dark-400'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <span>Next</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {currentStep === steps.length - 1 && (
          <div className="bg-white dark:bg-dark-200 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-dark-300">
            <button
              onClick={handlePrevious}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-gray-600 hover:bg-gray-700 text-white transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Previous</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
