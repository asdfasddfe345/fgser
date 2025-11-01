import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, CreditCard as Edit, Trash2, Eye, ToggleLeft, ToggleRight, ArrowLeft, Briefcase, MapPin, Clock, IndianRupee, Building2, AlertCircle, Loader2, CheckCircle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { JobListing } from '../../types/jobs';

export const AdminJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchJobs();
  }, [filterStatus, filterDomain]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('job_listings')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus === 'active') {
        query = query.eq('is_active', true);
      } else if (filterStatus === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (filterDomain) {
        query = query.eq('domain', filterDomain);
      }

      const { data, error } = await query;

      if (error) throw error;

      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      showNotification('error', 'Failed to fetch jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleJobStatus = async (jobId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('job_listings')
        .update({ is_active: !currentStatus })
        .eq('id', jobId);

      if (error) throw error;

      setJobs(jobs.map(job =>
        job.id === jobId ? { ...job, is_active: !currentStatus } : job
      ));

      showNotification('success', `Job ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error toggling job status:', error);
      showNotification('error', 'Failed to update job status');
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;

    try {
      const { error } = await supabase
        .from('job_listings')
        .delete()
        .eq('id', jobToDelete);

      if (error) throw error;

      setJobs(jobs.filter(job => job.id !== jobToDelete));
      showNotification('success', 'Job deleted successfully');
      setShowDeleteModal(false);
      setJobToDelete(null);
    } catch (error) {
      console.error('Error deleting job:', error);
      showNotification('error', 'Failed to delete job');
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.role_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.domain.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const stats = {
    total: jobs.length,
    active: jobs.filter(j => j.is_active).length,
    inactive: jobs.filter(j => !j.is_active).length,
  };

  const uniqueDomains = [...new Set(jobs.map(j => j.domain))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 py-3">
            <button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Admin - Manage Jobs</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/admin/users')}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200 shadow-lg"
              >
                <Users className="w-5 h-5" />
                <span className="hidden sm:block">Manage Users</span>
              </button>
              <button
                onClick={() => navigate('/admin/jobs/new')}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:block">Create Job</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 animate-fade-in-down">
          <div className={`p-4 rounded-xl shadow-lg border ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50 dark:text-neon-cyan-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-500/50 dark:text-red-300'
          }`}>
            <div className="flex items-center space-x-2">
              {notification.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <p className="font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Jobs</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
              <div className="bg-blue-100 dark:bg-neon-cyan-500/20 w-12 h-12 rounded-lg flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-blue-600 dark:text-neon-cyan-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Jobs</p>
                <p className="text-3xl font-bold text-green-600 dark:text-neon-cyan-400">{stats.active}</p>
              </div>
              <div className="bg-green-100 dark:bg-neon-cyan-500/20 w-12 h-12 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-neon-cyan-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Inactive Jobs</p>
                <p className="text-3xl font-bold text-gray-500 dark:text-gray-400">{stats.inactive}</p>
              </div>
              <div className="bg-gray-100 dark:bg-dark-200 w-12 h-12 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md border border-gray-200 dark:border-dark-300 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by company, role, or domain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-dark-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:text-gray-100"
              />
            </div>

            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:text-gray-100"
            >
              <option value="">All Domains</option>
              {uniqueDomains.map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:text-gray-100"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Jobs List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-blue-600 dark:text-neon-cyan-400 animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white dark:bg-dark-100 rounded-xl shadow-md border border-gray-200 dark:border-dark-300 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No jobs found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery || filterDomain ? 'Try adjusting your filters' : 'Start by creating your first job listing'}
            </p>
            <button
              onClick={() => navigate('/admin/jobs/new')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-6 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              <span>Create First Job</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map(job => (
              <div
                key={job.id}
                className="bg-white dark:bg-dark-100 rounded-xl shadow-md border border-gray-200 dark:border-dark-300 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start space-x-4">
                  {/* Company Logo */}
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-dark-200 rounded-lg overflow-hidden border border-gray-200 dark:border-dark-300 flex items-center justify-center">
                    {job.company_logo_url ? (
                      <img
                        src={job.company_logo_url}
                        alt={`${job.company_name} logo`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <Building2 className="w-8 h-8 text-gray-400" />
                    )}
                  </div>

                  {/* Job Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {job.role_title}
                        </h3>
                        <p className="text-lg text-gray-700 dark:text-gray-300 font-medium">
                          {job.company_name}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          job.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-dark-200 dark:text-gray-400'
                        }`}>
                          {job.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <div className="flex items-center space-x-1">
                        <Briefcase className="w-4 h-4" />
                        <span>{job.domain}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{job.location_type}{job.location_city ? ` - ${job.location_city}` : ''}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{job.experience_required}</span>
                      </div>
                      {job.package_amount && (
                        <div className="flex items-center space-x-1">
                          <IndianRupee className="w-4 h-4" />
                          <span>{(job.package_amount / 100000).toFixed(1)}L {job.package_type}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="flex items-center space-x-1 px-4 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-neon-cyan-500/10 dark:hover:bg-neon-cyan-500/20 text-blue-600 dark:text-neon-cyan-400 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </button>

                      <button
                        onClick={() => navigate(`/admin/jobs/${job.id}/edit`)}
                        className="flex items-center space-x-1 px-4 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => toggleJobStatus(job.id, job.is_active)}
                        className={`flex items-center space-x-1 px-4 py-2 rounded-lg transition-colors ${
                          job.is_active
                            ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                            : 'bg-green-50 hover:bg-green-100 dark:bg-green-500/10 dark:hover:bg-green-500/20 text-green-600 dark:text-green-400'
                        }`}
                      >
                        {job.is_active ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                        <span>{job.is_active ? 'Deactivate' : 'Activate'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setJobToDelete(job.id);
                          setShowDeleteModal(true);
                        }}
                        className="flex items-center space-x-1 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-dark-300">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/20 w-12 h-12 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Delete Job?</h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this job listing? This action cannot be undone.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setJobToDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-dark-200 dark:hover:bg-dark-300 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteJob}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
