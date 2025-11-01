import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Upload,
  Calendar,
  Briefcase,
  Code,
  MapPin,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { resumeParsingService } from '../../services/resumeParsingService';
import { userPreferencesService } from '../../services/userPreferencesService';
import { aiJobMatchingService } from '../../services/aiJobMatchingService';
import { jobsService } from '../../services/jobsService';
import { useAuth } from '../../contexts/AuthContext';

interface JobPreferencesOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TECH_OPTIONS = [
  'React', 'Angular', 'Vue', 'JavaScript', 'TypeScript', 'Node.js',
  'Python', 'Java', 'C++', 'Go', 'Rust', 'PHP',
  'Machine Learning', 'AI', 'Data Science', 'Cloud Computing',
  'DevOps', 'Mobile Development', 'UI/UX Design', 'Cybersecurity',
];

const WORK_MODES = [
  { value: 'remote', label: 'Remote', icon: '🏠' },
  { value: 'hybrid', label: 'Hybrid', icon: '🔄' },
  { value: 'onsite', label: 'Onsite', icon: '🏢' },
];

export const JobPreferencesOnboardingModal: React.FC<JobPreferencesOnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // NEW: Track full loading screen state
  const [error, setError] = useState('');

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [passoutYear, setPassoutYear] = useState<number>(2024);
  const [roleType, setRoleType] = useState<'internship' | 'fulltime' | 'both'>('both');
  const [techInterests, setTechInterests] = useState<string[]>([]);
  const [preferredModes, setPreferredModes] = useState<string[]>(['remote', 'hybrid']);

  const totalSteps = 5;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    const validation = resumeParsingService.validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      setLoading(false);
      return;
    }

    try {
      const parsed = await resumeParsingService.parseResume(file);
      if (parsed.hasError) {
        setError(parsed.errorMessage || 'Failed to parse resume');
        setLoading(false);
        return;
      }

      setResumeFile(file);
      setResumeText(parsed.text);
      setTechInterests(parsed.skills.slice(0, 10));
    } catch (err: any) {
      setError(err.message || 'Failed to process resume');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !resumeFile) {
      setError('Please upload your resume to continue');
      return;
    }
    setError('');
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const toggleTechInterest = (tech: string) => {
    setTechInterests((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const toggleWorkMode = (mode: string) => {
    setPreferredModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsProcessing(true); // NEW: Show full loading screen
    setLoading(true);
    setError('');

    try {
      let resumeUrl = '';
      if (resumeFile) {
        const url = await userPreferencesService.uploadResume(user.id, resumeFile);
        if (url) resumeUrl = url;
      }

      await userPreferencesService.savePreferences({
        user_id: user.id,
        resume_text: resumeText,
        resume_url: resumeUrl,
        passout_year: passoutYear,
        role_type: roleType,
        tech_interests: techInterests,
        preferred_modes: preferredModes,
        onboarding_completed: true,
      });

      const jobs = await jobsService.getAllJobs();
      await aiJobMatchingService.analyzeAndMatch(
        user.id,
        {
          resumeText,
          passoutYear,
          roleType,
          techInterests,
          preferredModes,
        },
        jobs
      );

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to save preferences');
      setIsProcessing(false); // NEW: Hide loading screen on error
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const renderStep = () => {
    // NEW: Show loading screen when processing
    if (isProcessing) {
      return (
        <div className="space-y-6 py-16">
          <div className="text-center">
            <div className="relative w-28 h-28 mx-auto mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-teal-400 rounded-full animate-pulse"></div>
              <div className="absolute inset-2 bg-white dark:bg-dark-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-14 h-14 text-green-600 dark:text-green-400 animate-spin" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Finding Jobs...
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
              Analyzing your preferences and matching with opportunities
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              This may take a few moments
            </p>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Upload Your Resume
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We'll analyze your skills and experience to recommend the best jobs
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-dark-300 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
              <input
                type="file"
                id="resume-upload"
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                disabled={loading}
              />
              <label
                htmlFor="resume-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                {resumeFile ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {resumeFile.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Click to change file
                    </p>
                  </>
                ) : (
                  <>
                    <FileText className="w-12 h-12 text-gray-400 mb-3" />
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      PDF, DOCX, or TXT (max 5MB)
                    </p>
                  </>
                )}
              </label>
            </div>

            {loading && (
              <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analyzing resume...</span>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-purple-100 dark:bg-purple-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                When did you graduate?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We'll match you with jobs for your batch
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <select
                value={passoutYear}
                onChange={(e) => setPassoutYear(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-lg"
              >
                {Array.from({ length: 11 }, (_, i) => 2020 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                What role are you looking for?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose the type of opportunity you're interested in
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { value: 'internship', label: 'Internship', icon: '🎓' },
                { value: 'fulltime', label: 'Full-time', icon: '💼' },
                { value: 'both', label: 'Both', icon: '🚀' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRoleType(option.value as any)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    roleType === option.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-dark-300 hover:border-blue-300'
                  }`}
                >
                  <div className="text-4xl mb-2">{option.icon}</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {option.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-orange-100 dark:bg-orange-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Code className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Which technologies interest you?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Select all that apply (we pre-selected from your resume)
              </p>
            </div>

            <div className="flex flex-wrap gap-3 max-w-4xl mx-auto justify-center">
              {TECH_OPTIONS.map((tech) => (
                <button
                  key={tech}
                  onClick={() => toggleTechInterest(tech)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    techInterests.includes(tech)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-300'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-teal-100 dark:bg-teal-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Preferred work mode?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose your ideal work environment
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {WORK_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => toggleWorkMode(mode.value)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    preferredModes.includes(mode.value)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-dark-300 hover:border-blue-300'
                  }`}
                >
                  <div className="text-4xl mb-2">{mode.icon}</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {mode.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header - Hide when processing */}
        {!isProcessing && (
          <div className="p-6 border-b border-gray-200 dark:border-dark-300 flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Set Up Your Job Preferences
              </h2>
              <div className="flex items-center space-x-2 mt-2">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                  <div
                    key={step}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      step <= currentStep
                        ? 'bg-blue-500'
                        : 'bg-gray-200 dark:bg-dark-300'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        )}

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={isProcessing ? 'processing' : currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {error && !isProcessing && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer - Hide when processing */}
        {!isProcessing && (
          <div className="p-6 border-t border-gray-200 dark:border-dark-300 flex items-center justify-between">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={loading}
                className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}

            <div className="flex-1" />

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={loading || (currentStep === 1 && !resumeFile)}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading || preferredModes.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center space-x-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete Setup</span>
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
