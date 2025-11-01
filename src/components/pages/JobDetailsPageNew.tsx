import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  Briefcase,
  Target,
  Zap,
  ArrowLeft,
  Loader2,
  Building2,
  Globe,
  Mail,
  Copy,
  Check,
  Code,
  Brain,
  MessageCircle,
  UserCheck,
  Award,
  FileText,
  ExternalLink,
  Sparkles,
  Share2,
} from 'lucide-react';
import { jobsService } from '../../services/jobsService';
import { JobListing } from '../../types/jobs';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationMethodModal } from '../modals/ApplicationMethodModal';

interface JobDetailsPageProps {
  onShowAuth: (callback?: () => void) => void;
}

export const JobDetailsPageNew: React.FC<JobDetailsPageProps> = ({ onShowAuth }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [copiedReferralCode, setCopiedReferralCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const eligibleYearTags = useMemo(() => {
    if (!job?.eligible_years) return [];

    const raw = job.eligible_years;
    const tokens = Array.isArray(raw)
      ? raw
      : raw.includes(',') || raw.includes('|') || raw.includes('/')
        ? raw.split(/[,|/]/)
        : raw.split(/\s+/);

    return tokens
      .map((value) => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
  }, [job?.eligible_years]);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) {
        navigate('/jobs');
        return;
      }

      try {
        setLoading(true);
        const jobData = await jobsService.getJobListingById(jobId);
        if (jobData) {
          setJob(jobData);
        } else {
          navigate('/jobs');
        }
      } catch (error) {
        console.error('Error fetching job:', error);
        navigate('/jobs');
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId, navigate]);

  const handleApplyClick = () => {
    // Always open the method modal (mobile and desktop)
    if (!isAuthenticated) {
      onShowAuth(() => setShowApplicationModal(true));
    } else {
      setShowApplicationModal(true);
    }
  };

  const handleManualApply = async () => {
    if (job) {
      // Log manual application
      try {
        await jobsService.logManualApplication(job.id, '', job.application_link);
      } catch (error) {
        console.error('Error logging manual application:', error);
      }

      // Redirect to company application link
      window.open(job.application_link, '_blank');
      setShowApplicationModal(false);
    }
  };

  const handleAIOptimizedApply = () => {
    if (!job) return;
    setShowApplicationModal(false);
    const fullJobDescription = [
      job.full_description || job.description,
      job.short_description ? `\n\nKey Points: ${job.short_description}` : '',
      job.qualification ? `\n\nQualifications: ${job.qualification}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigate('/optimizer', {
      state: {
        jobId: job.id,
        jobDescription: fullJobDescription,
        roleTitle: job.role_title,
        companyName: job.company_name,
        fromJobApplication: true,
      },
    });
  };

  const handleScoreCheck = () => {
    if (!job) return;

    const fullJobDescription = [
      job.full_description || job.description,
      job.short_description ? `\n\nKey Points: ${job.short_description}` : '',
      job.qualification ? `\n\nQualifications: ${job.qualification}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigate('/score-checker', {
      state: {
        jobDescription: fullJobDescription,
        jobTitle: job.role_title,
      },
    });
    setShowApplicationModal(false);
  };

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedReferralCode(true);
    setTimeout(() => setCopiedReferralCode(false), 2000);
  };

  const shareOrCopyLink = async () => {
    const url = window.location.href;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({
          title: (job?.role_title || 'Job') + ' at ' + (job?.company_name || ''),
          url,
        });
        return;
      }
    } catch (e) {
      // fallthrough to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      // no-op
    }
  };

  const formatSalary = (amount: number, type: string) => {
    if (type === 'CTC') {
      return `₹${(amount / 100000).toFixed(1)}L per year`;
    } else if (type === 'stipend') {
      return `₹${amount.toLocaleString()} per month`;
    } else if (type === 'hourly') {
      return `₹${amount} per hour`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  const getTestBadge = (testType: string, hasTest: boolean) => {
    if (!hasTest) return null;

    const testConfig = {
      coding: { icon: Code, label: 'Coding Test', color: 'from-blue-500 to-cyan-500' },
      aptitude: { icon: Brain, label: 'Aptitude Test', color: 'from-green-500 to-emerald-500' },
      technical: {
        icon: MessageCircle,
        label: 'Technical Interview',
        color: 'from-purple-500 to-pink-500',
      },
      hr: { icon: UserCheck, label: 'HR Interview', color: 'from-orange-500 to-red-500' },
    };

    const config = testConfig[testType as keyof typeof testConfig];
    if (!config) return null;

    const Icon = config.icon;

    return (
      <div
        key={testType}
        className={`flex items-center space-x-2 bg-gradient-to-r ${config.color} px-4 py-2 rounded-lg text-white text-sm font-medium shadow-md`}
      >
        <Icon className="w-4 h-4" />
        <span>{config.label}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-lg text-gray-700 dark:text-gray-300">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200">
        <div className="text-center">
          <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">Job not found</p>
          <button
            onClick={() => navigate('/jobs')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300 pb-24 lg:pb-8">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Breadcrumb + Share */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-600 dark:text-gray-400">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <button onClick={() => navigate('/jobs')} className="hover:text-blue-600 dark:hover:text-neon-cyan-400 font-medium">
                  Jobs
                </button>
              </li>
              <li className="mx-1" aria-hidden="true">/</li>
              <li className="truncate max-w-[12rem] sm:max-w-xs" title={job.company_name}>
                {job.company_name}
              </li>
              <li className="mx-1" aria-hidden="true">/</li>
              <li className="truncate font-semibold text-gray-800 dark:text-gray-200 max-w-[14rem] sm:max-w-sm" title={job.role_title}>
                {job.role_title}
              </li>
            </ol>
          </nav>
          <div className="mt-2 sm:mt-0 flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                } catch {}
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-300 bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-dark-200"
            >
              {copiedLink ? (
                <span className="inline-flex items-center gap-1"><Check className="w-4 h-4" />Copied</span>
              ) : (
                <span className="inline-flex items-center gap-1"><Copy className="w-4 h-4" />Copy link</span>
              )}
            </button>
            <button
              onClick={shareOrCopyLink}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium inline-flex items-center gap-1"
            >
              <Share2 className="w-4 h-4" /> Share
            </button>
          </div>
        </div>
        {/* Back Button (mobile only; breadcrumb replaces it on larger screens) */}
        <button
          onClick={() => navigate('/jobs')}
          className="sm:hidden mb-6 bg-white dark:bg-dark-100 hover:bg-gray-50 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300 shadow-md hover:shadow-lg py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200 border border-gray-200 dark:border-dark-300"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Jobs</span>
        </button>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Header Card */}
            <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-100 dark:border-dark-300 p-8">
              <div className="flex items-start gap-6 mb-6">
                {job.company_logo_url ? (
                  <img
                    src={job.company_logo_url}
                    alt={`${job.company_name} logo`}
                    className="w-20 h-20 rounded-xl object-contain bg-gray-50 dark:bg-dark-200 p-2 border border-gray-200 dark:border-dark-300"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                    {job.company_name.charAt(0)}
                  </div>
                )}

                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {job.role_title}
                  </h1>
                  <p className="text-xl text-gray-700 dark:text-gray-300 mb-3">
                    {job.company_name}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm rounded-full font-medium">
                      {job.domain}
                    </span>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-sm rounded-full font-medium">
                      {job.location_type}
                    </span>
                    {job.location_city && (
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-sm rounded-full font-medium flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {job.location_city}
                      </span>
                    )}
                    {eligibleYearTags.length > 0 && (
                      <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm rounded-full font-medium flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Eligible: {eligibleYearTags.join(' / ')}
                      </span>
                    )}
                    {job.ai_polished && (
                      <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-800 dark:text-purple-300 text-sm rounded-full font-medium flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI Enhanced
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Key Info - Modified to remove conditional button */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-gray-200 dark:border-dark-300">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Experience</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {job.experience_required}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                    <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Qualification</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {job.qualification}
                    </p>
                  </div>
                </div>

                {job.package_amount && job.package_type && (
                  <div className="flex items-center space-x-3 md:col-span-2">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                      <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Package</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {formatSalary(job.package_amount, job.package_type)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Apply Button - Now Always Visible on Desktop */}
              <div className="mt-6 hidden lg:block">
                <button
                  onClick={handleApplyClick}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2"
                >
                  <Briefcase className="w-5 h-5" />
                  <span>Apply Now</span>
                </button>
              </div>
            </div>

            {/* About the Company */}
            {job.company_description && (
              <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-100 dark:border-dark-300 p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    About the Company
                  </h2>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {job.company_description}
                </p>
                {job.company_website && (
                  <a
                    href={job.company_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-4 font-medium"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Visit Company Website</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}

            {/* Job Description */}
            <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-100 dark:border-dark-300 p-8">
              <div className="flex items-center space-x-3 mb-4">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Job Description
                </h2>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {job.full_description || job.description}
                </p>
              </div>
            </div>

            {/* Referral Section */}
            {job.has_referral && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl shadow-lg border-2 border-green-200 dark:border-green-800 p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-green-600 p-2 rounded-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Referral Available
                  </h2>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  This job has an employee referral program. Connect with the referrer for a
                  better chance of getting hired!
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {job.referral_person_name && (
                    <div className="bg-white dark:bg-dark-100 p-4 rounded-xl border border-green-200 dark:border-green-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Referral Contact
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {job.referral_person_name}
                      </p>
                    </div>
                  )}

                  {job.referral_email && (
                    <div className="bg-white dark:bg-dark-100 p-4 rounded-xl border border-green-200 dark:border-green-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                      <a
                        href={`mailto:${job.referral_email}`}
                        className="font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center space-x-2"
                      >
                        <Mail className="w-4 h-4" />
                        <span>{job.referral_email}</span>
                      </a>
                    </div>
                  )}

                  {job.referral_code && (
                    <div className="bg-white dark:bg-dark-100 p-4 rounded-xl border border-green-200 dark:border-green-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Referral Code
                      </p>
                      <div className="flex items-center space-x-2">
                        <code className="font-mono font-semibold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-dark-200 px-2 py-1 rounded">
                          {job.referral_code}
                        </code>
                        <button
                          onClick={() => copyReferralCode(job.referral_code!)}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                          title="Copy referral code"
                        >
                          {copiedReferralCode ? (
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {job.referral_bonus_amount && (
                    <div className="bg-white dark:bg-dark-100 p-4 rounded-xl border border-green-200 dark:border-green-800">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Referral Bonus
                      </p>
                      <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                        ₹{job.referral_bonus_amount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {job.referral_terms && (
                  <div className="mt-4 p-4 bg-white dark:bg-dark-100 rounded-xl border border-green-200 dark:border-green-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Terms & Conditions
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{job.referral_terms}</p>
                  </div>
                )}

                {job.referral_link && (
                  <a
                    href={job.referral_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center space-x-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Apply via Referral Link</span>
                  </a>
                )}
              </div>
            )}

            {/* Test Patterns Section */}
            {(job.has_coding_test ||
              job.has_aptitude_test ||
              job.has_technical_interview ||
              job.has_hr_interview) && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl shadow-lg border-2 border-purple-200 dark:border-purple-800 p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-purple-600 p-2 rounded-lg">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Selection Process
                  </h2>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  The hiring process includes the following assessments and interviews:
                </p>

                <div className="flex flex-wrap gap-3 mb-6">
                  {getTestBadge('coding', job.has_coding_test ?? false)}
                  {getTestBadge('aptitude', job.has_aptitude_test ?? false)}
                  {getTestBadge('technical', job.has_technical_interview ?? false)}
                  {getTestBadge('hr', job.has_hr_interview ?? false)}
                </div>

                {job.test_duration_minutes && (
                  <div className="bg-white dark:bg-dark-100 p-4 rounded-xl border border-purple-200 dark:border-purple-800 mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Estimated Total Duration
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                      {job.test_duration_minutes} minutes
                    </p>
                  </div>
                )}

                {job.test_requirements && (
                  <div className="bg-white dark:bg-dark-100 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      What to Expect
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {job.test_requirements}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Sticky Apply Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              {/* Apply Action Card - NOW WITH BUTTON */}
              <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-100 dark:border-dark-300 p-6">
                <div className="text-center mb-4">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Ready to Apply?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Choose between manual or AI-optimized application for better chances
                  </p>
                </div>
                
                {/* Apply Button in Sidebar */}
                <button
                  onClick={handleApplyClick}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2"
                >
                  <Briefcase className="w-5 h-5" />
                  <span>Apply Now</span>
                </button>
              </div>

              {/* Quick Stats */}
              <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-100 dark:border-dark-300 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Quick Info
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Posted</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {new Date(job.posted_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Job Type</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {job.location_type}
                    </span>
                  </div>
                  {eligibleYearTags.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Eligible Batches</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-right">
                        {eligibleYearTags.join(' / ')}
                      </span>
                    </div>
                  )}
                  {job.has_referral && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Referral</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        Available
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Apply Button (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white dark:bg-dark-100 border-t-2 border-gray-200 dark:border-dark-300 p-4 shadow-2xl z-40">
        <button
          onClick={handleApplyClick}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
        >
          <Briefcase className="w-5 h-5" />
          <span>Apply Now</span>
        </button>
      </div>

      {/* Application Method Modal */}
      <ApplicationMethodModal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        job={job}
        onManualApply={handleManualApply}
        onAIOptimizedApply={handleAIOptimizedApply}
        onScoreCheck={handleScoreCheck}
      />
    </div>
  );
};
