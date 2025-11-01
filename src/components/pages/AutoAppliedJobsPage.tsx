import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  ExternalLink,
  TrendingUp,
  Loader2,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { autoApplyOrchestratorService } from '../../services/autoApplyOrchestratorService';

interface Application {
  id: string;
  status: string;
  submission_time: string;
  created_at: string;
  platform: string;
  application_url: string;
  time_taken_seconds: number;
  error_message?: string;
  job_listings: {
    id: string;
    company_name: string;
    role_title: string;
    company_logo_url?: string;
  };
  optimized_resumes: {
    match_score: number;
    pdf_url: string;
  };
}

export const AutoAppliedJobsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'submitted' | 'failed'>('all');

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await autoApplyOrchestratorService.getUserApplications(user!.id);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>Submitted</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            <span>Failed</span>
          </div>
        );
      case 'filling':
      case 'optimizing':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4 animate-spin" />
            <span>In Progress</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>{status}</span>
          </div>
        );
    }
  };

  const stats = {
    total: applications.length,
    submitted: applications.filter((a) => a.status === 'submitted').length,
    failed: applications.filter((a) => a.status === 'failed').length,
    avgMatchScore:
      applications.length > 0
        ? Math.round(
            applications.reduce((sum, a) => sum + (a.optimized_resumes?.match_score || 0), 0) /
              applications.length
          )
        : 0,
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Please log in to view your applications</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Jobs</span>
          </button>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Auto-Applied Jobs
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track all your AI-powered job applications
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Applications</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.total}
                </p>
              </div>
              <Briefcase className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Submitted</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {stats.submitted}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Failed</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
              </div>
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Match Score</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.avgMatchScore}%
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-300'
            }`}
          >
            All ({applications.length})
          </button>
          <button
            onClick={() => setFilter('submitted')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'submitted'
                ? 'bg-green-600 text-white'
                : 'bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-300'
            }`}
          >
            Submitted ({stats.submitted})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'failed'
                ? 'bg-red-600 text-white'
                : 'bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-300'
            }`}
          >
            Failed ({stats.failed})
          </button>
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="bg-white dark:bg-dark-100 rounded-xl p-12 text-center border border-gray-200 dark:border-dark-300">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Applications Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start applying to jobs using Auto Apply to see them here
            </p>
            <button
              onClick={() => navigate('/jobs')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-dark-100 rounded-xl p-6 border border-gray-200 dark:border-dark-300 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    {app.job_listings.company_logo_url ? (
                      <img
                        src={app.job_listings.company_logo_url}
                        alt={app.job_listings.company_name}
                        className="w-16 h-16 rounded-lg object-contain bg-gray-50 dark:bg-dark-200 p-2"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                        {app.job_listings.company_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {app.job_listings.role_title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        {app.job_listings.company_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(app.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{app.time_taken_seconds}s</span>
                        </div>
                        {app.optimized_resumes?.match_score && (
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="w-4 h-4" />
                            <span>{app.optimized_resumes.match_score}% match</span>
                          </div>
                        )}
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
                          {app.platform}
                        </span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(app.status)}
                </div>

                {app.error_message && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-800 dark:text-red-300">{app.error_message}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {app.optimized_resumes?.pdf_url && (
                    <a
                      href={app.optimized_resumes.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Resume</span>
                    </a>
                  )}
                  <a
                    href={app.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Application</span>
                  </a>
                  <button
                    onClick={() => navigate(`/jobs/${app.job_listings.id}`)}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-dark-200 text-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-300 transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Job Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
