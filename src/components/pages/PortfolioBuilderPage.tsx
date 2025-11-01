import React, { useState } from 'react';
import { Upload, Loader2, CheckCircle, AlertCircle, ExternalLink, AlertTriangle, Info } from 'lucide-react';
import { portfolioService } from '../../services/portfolioService';
import { UserType, TemplateId, TEMPLATE_CONFIGS } from '../../types/portfolio';

interface PortfolioBuilderPageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

const MAX_CHARACTERS = 50000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const PortfolioBuilderPage: React.FC<PortfolioBuilderPageProps> = ({
  isAuthenticated,
  onShowAuth,
}) => {
  const [step, setStep] = useState<'upload' | 'type' | 'template' | 'processing' | 'success'>('type');
  const [userType, setUserType] = useState<UserType>('fresher');
  const [targetRole, setTargetRole] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('nova');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [portfolioId, setPortfolioId] = useState('');
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [charCount, setCharCount] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError('File size must be less than 5MB');
        return;
      }

      // Validate file type
      const allowedTypes = [
        'text/plain',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a valid file (TXT, PDF, DOC, DOCX)');
        return;
      }

      setResumeFile(file);
      setResumeText(''); // Clear text if file is uploaded
      setCharCount(0);
      setError('');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const count = text.length;
    
    setResumeText(text);
    setCharCount(count);
    
    // Remove the hard error - just show info
    if (count > MAX_CHARACTERS) {
      // Don't set error anymore
      setError('');
    } else {
      setError('');
    }
  };

  const handleCreatePortfolio = async () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }

    if (!resumeText && !resumeFile) {
      setError('Please provide resume text or upload a file');
      return;
    }

    // REMOVED: No longer checking character limit - AI will auto-optimize
    // if (resumeText && resumeText.length > MAX_CHARACTERS) {
    //   setError(...);
    //   return;
    // }

    setIsLoading(true);
    setError('');
    setStep('processing');

    try {
      const result = await portfolioService.createPortfolio({
        resumeText,
        resumeFile: resumeFile || undefined,
        userType,
        targetRole: targetRole || undefined,
      });

      setPortfolioId(result.portfolioId);

      await portfolioService.createTemplate(result.portfolioId, selectedTemplate);

      setStep('success');
    } catch (err: any) {
      console.error('Error creating portfolio:', err);
      let errorMessage = err.message || 'Failed to create portfolio. Please try again.';
      
      // Handle specific error cases
      if (errorMessage.includes('Invalid JSON')) {
        errorMessage = 'There was an issue processing your resume. Please try uploading a different format or paste the text directly.';
      }
      
      setError(errorMessage);
      setStep('upload');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!portfolioId) return;

    setIsLoading(true);
    setError('');

    try {
      const deploymentId = await portfolioService.createDeployment(portfolioId);

      const deployment = await portfolioService.getDeployment(deploymentId);
      setDeploymentUrl(deployment.deploymentUrl);

      await portfolioService.updateDeploymentStatus(deploymentId, 'success', {
        netlifySiteId: 'demo-site-id',
        netlifyDeployId: 'demo-deploy-id',
      });
    } catch (err: any) {
      console.error('Error deploying portfolio:', err);
      setError(err.message || 'Failed to deploy portfolio');
    } finally {
      setIsLoading(false);
    }
  };

  const getCharCountColor = () => {
    const percentage = (charCount / MAX_CHARACTERS) * 100;
    if (percentage >= 100) return 'text-orange-600'; // Changed from red
    if (percentage >= 80) return 'text-orange-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Portfolio Builder
          </h1>
          <p className="text-lg text-gray-600">
            Create a stunning portfolio website in minutes with AI-powered content generation
          </p>
        </div>

        {step === 'type' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold mb-6">Select Your Profile Type</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {(['fresher', 'student', 'experienced'] as UserType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setUserType(type)}
                  className={`p-6 border-2 rounded-xl transition-all ${
                    userType === type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-center">
                    <h3 className="font-semibold text-lg capitalize mb-2">{type}</h3>
                    <p className="text-sm text-gray-600">
                      {type === 'fresher' && 'Fresh graduate looking for opportunities'}
                      {type === 'student' && 'Current student seeking internships'}
                      {type === 'experienced' && 'Professional with work experience'}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Role (Optional)
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g., Full Stack Developer, Data Analyst"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setStep('upload')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold mb-6">Upload Your Resume</h2>

            {/* AI Auto-Optimization Info */}
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-1">Smart Resume Processing</p>
                  <p>Our AI automatically optimizes long resumes! If your resume exceeds {MAX_CHARACTERS.toLocaleString()} characters, we'll intelligently condense it while preserving all key information.</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Resume File
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".txt,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-2">
                    {resumeFile ? (
                      <span className="text-green-600 font-medium">{resumeFile.name}</span>
                    ) : (
                      'Click to upload or drag and drop'
                    )}
                  </p>
                  <p className="text-xs text-gray-500">TXT, PDF, DOC, DOCX (Max 5MB)</p>
                </label>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center mb-2">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="px-4 text-sm text-gray-500">OR</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Paste Resume Text
                </label>
                <span className={`text-xs font-medium ${getCharCountColor()}`}>
                  {charCount.toLocaleString()} characters
                  {charCount > MAX_CHARACTERS && (
                    <span className="ml-1 text-green-600">(will auto-optimize)</span>
                  )}
                </span>
              </div>
              <textarea
                value={resumeText}
                onChange={handleTextChange}
                placeholder="Paste your resume content or LinkedIn profile..."
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {charCount > MAX_CHARACTERS && (
                <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                  <Info className="h-4 w-4" />
                  Your resume will be automatically optimized to fit the character limit while preserving all important details.
                </p>
              )}
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep('type')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('template')}
                disabled={!resumeText && !resumeFile}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Continue to Templates
              </button>
            </div>
          </div>
        )}

        {step === 'template' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold mb-6">Choose Your Template</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {Object.values(TEMPLATE_CONFIGS).map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`text-left p-6 border-2 rounded-xl transition-all ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    {selectedTemplate === template.id && (
                      <CheckCircle className="h-6 w-6 text-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {template.bestFor.map((role) => (
                      <span
                        key={role}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('upload')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreatePortfolio}
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Portfolio...
                  </>
                ) : (
                  'Create Portfolio'
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-3">Creating Your Portfolio</h2>
            <p className="text-gray-600 mb-6">
              Our AI is analyzing your resume and generating optimized content...
            </p>
            <div className="max-w-md mx-auto">
              <div className="space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Parsing resume content</span>
                </div>
                {charCount > MAX_CHARACTERS && (
                  <div className="flex items-center gap-3 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                    <span>Optimizing resume length with AI...</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span>Generating AI-enhanced content</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full"></div>
                  <span>Optimizing for SEO</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-3">Portfolio Created Successfully!</h2>
            <p className="text-gray-600 mb-8">
              Your portfolio is ready. Deploy it to Netlify to make it live.
            </p>

            {deploymentUrl ? (
              <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 mb-3">Your portfolio is now live!</p>
                <a
                  href={deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  {deploymentUrl}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ) : (
              <button
                onClick={handleDeploy}
                disabled={isLoading}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  'Deploy to Netlify'
                )}
              </button>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={() => {
                setStep('type');
                setResumeText('');
                setResumeFile(null);
                setPortfolioId('');
                setDeploymentUrl('');
                setError('');
                setCharCount(0);
              }}
              className="mt-6 text-blue-600 hover:text-blue-700 font-medium"
            >
              Create Another Portfolio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
