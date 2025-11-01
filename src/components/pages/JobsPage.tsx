// src/components/pages/JobsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Briefcase,
  Sparkles,
  TrendingUp,
  Users,
  MapPin,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { JobListing, JobFilters, OptimizedResume } from '../../types/jobs';
import { jobsService } from '../../services/jobsService';
import { JobCard } from '../jobs/JobCard';
import { JobFilters as JobFiltersComponent } from '../jobs/JobFilters';
import { OptimizedResumePreviewModal } from '../modals/OptimizedResumePreviewModal';
import { ApplicationConfirmationModal } from '../modals/ApplicationConfirmationModal';
import { AutoApplyProgressModal } from '../modals/AutoApplyProgressModal';
import { Pagination } from '../common/Pagination';
import { JobPreferencesOnboardingModal } from '../modals/JobPreferencesOnboardingModal';
import { ProjectSuggestionModal } from '../modals/ProjectSuggestionModal';
import { userPreferencesService } from '../../services/userPreferencesService';
import { aiJobMatchingService } from '../../services/aiJobMatchingService';
import { useAutoApply } from '../../hooks/useAutoApply';
import { profileResumeService } from '../../services/profileResumeService';

interface JobsPageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowProfile?: (mode?: 'profile' | 'wallet') => void; // NEW: Function to open profile management
}

export const JobsPage: React.FC<JobsPageProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowProfile
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [filters, setFilters] = useState<JobFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCompanies, setTotalCompanies] = useState(0);

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  });

  // Modal states
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [showApplicationConfirmation, setShowApplicationConfirmation] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [selectedResume, setSelectedResume] = useState<OptimizedResume | null>(null);

  // Auto-apply hook
  const {
    isProcessing: isAutoApplying,
    showStatusModal,
    showProjectModal,
    currentStatus,
    projectSuggestions,
    currentJob: autoApplyJob,
    result: autoApplyResult,
    startAutoApply,
    handleProjectSelection,
    closeModals: closeAutoApplyModals,
  } = useAutoApply();

  // AI Recommendations state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [showingRecommendations, setShowingRecommendations] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const pageSize = 12;

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      if (user?.id) {
        const completed = await userPreferencesService.hasCompletedOnboarding(user.id);
        setHasCompletedOnboarding(completed);

        if (!completed) {
          setTimeout(() => setShowOnboarding(true), 1000);
        } else {
          loadAIRecommendations();
        }
      }
    };
    checkOnboarding();
  }, [user?.id]);

  const loadAIRecommendations = async () => {
    if (!user?.id) return;

    setLoadingRecommendations(true);
    try {
      const recommendations = await aiJobMatchingService.getRecommendations(user.id, 40);
      setAiRecommendations(recommendations);
      if (recommendations.length > 0) {
        setShowingRecommendations(true);
      }
    } catch (error) {
      console.error('Error loading AI recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleRefreshRecommendations = async () => {
    if (!user?.id) return;

    setLoadingRecommendations(true);
    try {
      const preferences = await userPreferencesService.getUserPreferences(user.id);
      if (!preferences) return;

      const allJobs = await jobsService.getAllJobs();
      await aiJobMatchingService.analyzeAndMatch(
        user.id,
        {
          resumeText: preferences.resume_text || '',
          passoutYear: preferences.passout_year || 2024,
          roleType: preferences.role_type || 'both',
          techInterests: preferences.tech_interests || [],
          preferredModes: preferences.preferred_modes || [],
        },
        allJobs
      );

      await loadAIRecommendations();
    } catch (error) {
      console.error('Error refreshing recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    loadAIRecommendations();
  };

 const loadJobs = useCallback(async (page = 1, newFilters = filters) => {
  setIsLoading(true);
  setError(null);

  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const offset = (page - 1) * pageSize;
    const result = await jobsService.getJobListings(newFilters, pageSize, offset);

    setJobs(result.jobs);
    setTotal(result.total);
    setHasMore(result.hasMore);
    setTotalPages(result.totalPages);
    setTotalCompanies(result.totalCompanies); // ADD THIS LINE
    setCurrentPage(page);

    setSearchParams({ page: page.toString() });
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load jobs');
  } finally {
    setIsLoading(false);
  }
}, [filters, pageSize, setSearchParams]);


  useEffect(() => {
    loadJobs(currentPage, filters);
  }, [filters]);

  useEffect(() => {
    const pageParam = searchParams.get('page');
    const pageNumber = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    if (pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
      loadJobs(pageNumber, filters);
    }
  }, [searchParams]);

  const handleFiltersChange = (newFilters: JobFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setSearchParams({ page: '1' });
  };

  const handlePageChange = (page: number) => {
    loadJobs(page, filters);
  };

  const handleManualApply = (job: JobListing, optimizedResume: OptimizedResume) => {
    setSelectedJob(job);
    setSelectedResume(optimizedResume);
    setShowResumePreview(true);
  };

  const handleAutoApply = async (job: JobListing) => {
    // Check if user has a resume uploaded
    if (!user?.id) {
      onShowAuth();
      return;
    }

    try {
      // Check if user has profile data
      const hasResume = await profileResumeService.hasUserResume(user.id);
      if (!hasResume) {
        // Show profile completion modal
        if (onShowProfile) {
          onShowProfile('profile');
        }
        alert('Please upload your resume in your profile before using auto-apply.');
        return;
      }

      // Start auto-apply process
      await startAutoApply(job);
    } catch (error) {
      console.error('Error starting auto-apply:', error);
      alert('Failed to start auto-apply. Please try again.');
    }
  };

  const handleResumePreviewConfirm = () => {
    setShowResumePreview(false);
    if (selectedJob && selectedResume) {
      // Open job application link in new tab
      window.open(selectedJob.application_link, '_blank');

      // Show success message
      setSelectedJob(null);
      setSelectedResume(null);
    }
  };

  // Handle auto-apply completion
  useEffect(() => {
    if (autoApplyResult && !showStatusModal && !showProjectModal) {
      setSelectedJob(autoApplyJob);
      setShowApplicationConfirmation(true);
    }
  }, [autoApplyResult, showStatusModal, showProjectModal, autoApplyJob]);

  const stats = [
  { label: 'Total Jobs', value: total, icon: <Briefcase className="w-5 h-5" /> },
  { label: 'Remote Jobs', value: jobs.filter(j => j.location_type === 'Remote').length, icon: <MapPin className="w-5 h-5" /> },
  { label: 'Fresh Openings', value: jobs.filter(j => new Date(j.posted_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length, icon: <Clock className="w-5 h-5" /> },
  { label: 'Companies', value: totalCompanies, icon: <Users className="w-5 h-5" /> }
];


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="w-full max-w-full mx-auto px-0 sm:px-0">
          <div className="flex items-center justify-between h-16 py-3">
            <button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Explore Jobs</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-full mx-auto px-0 sm:px-0 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Briefcase className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {showingRecommendations ? 'Your Recommended Jobs' : 'Find Your Dream Job'}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            {showingRecommendations
              ? 'AI-powered recommendations based on your profile and preferences'
              : 'Discover opportunities, apply with AI-optimized resumes, and track your applications all in one place.'}
          </p>

          {hasCompletedOnboarding && (
            <div className="flex items-center justify-center space-x-4 mt-6">
              <button
                onClick={() => setShowingRecommendations(!showingRecommendations)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-lg ${
                  showingRecommendations
                    ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                    : 'bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-300'
                } hover:scale-105`}
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>{showingRecommendations ? 'Showing AI Matches' : 'Show AI Matches'}</span>
                  {aiRecommendations.length > 0 && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                      {aiRecommendations.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={handleRefreshRecommendations}
                disabled={loadingRecommendations}
                className="px-4 py-3 rounded-xl font-semibold bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-300 hover:scale-105 transition-all shadow-lg disabled:opacity-50 flex items-center space-x-2"
                title="Refresh AI recommendations"
              >
                <RefreshCw className={`w-5 h-5 ${loadingRecommendations ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => setShowOnboarding(true)}
                className="px-4 py-3 rounded-xl font-semibold bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-300 hover:scale-105 transition-all shadow-lg flex items-center space-x-2"
                title="Update preferences"
              >
                ⚙️
                <span className="hidden sm:inline">Preferences</span>
              </button>

            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg p-4 text-center border border-gray-200 dark:bg-dark-100 dark:border-dark-300"
            >
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                {stat.icon}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-8">
          <JobFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isLoading={isLoading}
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 dark:bg-red-900/20 dark:border-red-500/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">Error Loading Jobs</h3>
                  <p className="text-red-700 dark:text-red-400">{error}</p>
                </div>
              </div>
              <button
                onClick={() => loadJobs(0)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Jobs Grid */}
        {!error && (
          <>
           <div className="w-full max-w-full mx-auto px-0 sm:px-0 py-8 space-y-4">
              {(showingRecommendations && aiRecommendations.length > 0
                ? aiRecommendations.map((rec) => ({
                    ...rec.job_data,
                    match_score: rec.match_score,
                    match_reason: rec.match_reason,
                    skills_matched: rec.skills_matched,
                  }))
                : jobs
              ).map((job: any, index: number) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onManualApply={handleManualApply}
                  onAutoApply={handleAutoApply}
                  isAuthenticated={isAuthenticated}
                  onShowAuth={onShowAuth}
                  onCompleteProfile={() => onShowProfile && onShowProfile('profile')} // NEW: Pass profile completion handler
                />
              ))}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3 dark:text-neon-cyan-400" />
                <span className="text-lg text-gray-600 dark:text-gray-300">Loading jobs...</span>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && jobs.length > 0 && totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total} jobs
                  </p>
                </div>
              </div>
            )}

            {/* No Jobs Found */}
            {!isLoading && jobs.length === 0 && (
              <div className="text-center py-12">
                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 dark:bg-dark-200">
                  <Briefcase className="w-10 h-10 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Jobs Found</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Try adjusting your filters or search terms to find more opportunities.
                </p>
                <button
                  onClick={() => setFilters({})}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <OptimizedResumePreviewModal
        isOpen={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        job={selectedJob}
        optimizedResume={selectedResume}
        onConfirm={handleResumePreviewConfirm}
      />

      <ApplicationConfirmationModal
        isOpen={showApplicationConfirmation}
        onClose={() => {
          setShowApplicationConfirmation(false);
          setSelectedJob(null);
          closeAutoApplyModals();
        }}
        job={selectedJob}
        result={autoApplyResult ? {
          success: autoApplyResult.success,
          message: autoApplyResult.error || 'Application submitted successfully',
          applicationId: autoApplyResult.applicationId || '',
          status: autoApplyResult.success ? 'submitted' : 'failed',
          resumeUrl: autoApplyResult.pdfUrl
        } : undefined}
      />

      <AutoApplyProgressModal
        isOpen={showStatusModal}
        onClose={() => closeAutoApplyModals()}
        applicationId={autoApplyJob?.id || null}
        jobTitle={autoApplyJob?.role_title || ''}
        companyName={autoApplyJob?.company_name || ''}
        onComplete={(result) => {
          // Result is handled by the useAutoApply hook
        }}
      />

      {showProjectModal && projectSuggestions && (
        <ProjectSuggestionModal
          isOpen={showProjectModal}
          onClose={() => closeAutoApplyModals()}
          job={autoApplyJob}
          suggestions={projectSuggestions}
          onSelectProject={handleProjectSelection}
          matchScore={projectSuggestions.currentMatchScore || 0}
        />
      )}

      <JobPreferencesOnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
};
