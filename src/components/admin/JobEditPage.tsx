import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Briefcase,
  MapPin,
  Clock,
  Calendar,
  GraduationCap,
  IndianRupee,
  ExternalLink,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Target,
  FileText,
  Image
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { JobListing } from '../../types/jobs';
import { ImageUpload } from './ImageUpload';

const jobListingSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  role_title: z.string().min(1, 'Role title is required'),
  package_amount: z.number().positive('Package amount must be positive').optional(),
  package_type: z.enum(['CTC', 'stipend', 'hourly']).optional(),
  domain: z.string().min(1, 'Domain is required'),
  location_type: z.enum(['Remote', 'Onsite', 'Hybrid']),
  location_city: z.string().optional(),
  experience_required: z.string().min(1, 'Experience requirement is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  eligible_years: z.string().optional().or(z.literal('')),
  short_description: z.string().min(50, 'Short description must be at least 50 characters'),
  full_description: z.string().min(100, 'Full description must be at least 100 characters'),
  application_link: z.string().url('Must be a valid URL'),
  is_active: z.boolean().default(true),
});

type JobFormData = z.infer<typeof jobListingSchema>;

export const JobEditPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [originalLogoUrl, setOriginalLogoUrl] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobListingSchema),
  });

  const watchedLocationType = watch('location_type');

  useEffect(() => {
    if (jobId) {
      fetchJobData();
    }
  }, [jobId]);

  const fetchJobData = async () => {
    if (!jobId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_listings')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;

      if (data) {
        reset({
          company_name: data.company_name,
          company_logo_url: data.company_logo_url || '',
          role_title: data.role_title,
          package_amount: data.package_amount || undefined,
          package_type: data.package_type || 'CTC',
          domain: data.domain,
          location_type: data.location_type,
          location_city: data.location_city || '',
          experience_required: data.experience_required,
          qualification: data.qualification,
          eligible_years: data.eligible_years || '',
          short_description: data.short_description,
          full_description: data.full_description,
          application_link: data.application_link,
          is_active: data.is_active,
        });

        setCompanyLogoUrl(data.company_logo_url || '');
        setOriginalLogoUrl(data.company_logo_url || '');
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      setSubmitError('Failed to load job data');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: JobFormData) => {
    if (!jobId) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const updateData = {
        company_name: data.company_name,
        company_logo_url: companyLogoUrl || data.company_logo_url || null,
        role_title: data.role_title,
        package_amount: data.package_amount || null,
        package_type: data.package_type || null,
        domain: data.domain,
        location_type: data.location_type,
        location_city: data.location_city || null,
        experience_required: data.experience_required,
        qualification: data.qualification,
        eligible_years: data.eligible_years?.trim() ? data.eligible_years.trim() : null,
        short_description: data.short_description,
        full_description: data.full_description,
        application_link: data.application_link,
        is_active: data.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('job_listings')
        .update(updateData)
        .eq('id', jobId);

      if (error) throw error;

      setSubmitSuccess(true);
      setTimeout(() => {
        navigate('/admin/jobs');
      }, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update job listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const domainOptions = [
    'SDE', 'Data Science', 'Product', 'Design', 'Marketing', 'Sales',
    'Analytics', 'AI', 'DevOps', 'Mobile', 'Frontend', 'Backend',
    'Full-Stack', 'QA', 'Content', 'HR', 'Finance', 'Operations'
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-neon-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Loading job data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 py-3">
            <button
              onClick={() => navigate('/admin/jobs')}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Jobs</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Job Listing</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Form */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                Edit Job Details
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Update the job listing information</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm font-medium">{submitError}</p>
                  </div>
                </div>
              )}

              {submitSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 mt-0.5" />
                    <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">
                      Job listing updated successfully! Redirecting...
                    </p>
                  </div>
                </div>
              )}

              {/* Company Logo Upload Section */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-dark-200 dark:to-dark-300 p-6 rounded-xl border border-blue-100 dark:border-dark-400">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Image className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Company Branding
                </h3>
                <ImageUpload
                  currentImageUrl={companyLogoUrl}
                  onImageUploaded={(url) => {
                    setCompanyLogoUrl(url);
                    setValue('company_logo_url', url);
                  }}
                  onImageRemoved={() => {
                    setCompanyLogoUrl('');
                    setValue('company_logo_url', '');
                  }}
                />
              </div>

              {/* Company Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    Company Name *
                  </label>
                  <input
                    type="text"
                    {...register('company_name')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Google, Microsoft, Startup Inc."
                  />
                  {errors.company_name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.company_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Role Title *
                  </label>
                  <input
                    type="text"
                    {...register('role_title')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Senior Software Engineer"
                  />
                  {errors.role_title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.role_title.message}</p>
                  )}
                </div>
              </div>

              {/* Domain and Package */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Target className="w-4 h-4 inline mr-1" />
                    Domain *
                  </label>
                  <select
                    {...register('domain')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="">Select Domain</option>
                    {domainOptions.map(domain => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                  </select>
                  {errors.domain && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.domain.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <IndianRupee className="w-4 h-4 inline mr-1" />
                    Package Amount
                  </label>
                  <input
                    type="number"
                    {...register('package_amount', { valueAsNumber: true })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., 1200000"
                    min="0"
                  />
                  {errors.package_amount && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.package_amount.message}</p>
                  )}
                </div>
              </div>

              {/* Package Type and Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Package Type
                  </label>
                  <select
                    {...register('package_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="CTC">CTC (Annual)</option>
                    <option value="stipend">Stipend (Monthly)</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location Type *
                  </label>
                  <select
                    {...register('location_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="Remote">Remote</option>
                    <option value="Onsite">Onsite</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              {/* City, Experience, Qualification */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    {...register('location_city')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Bangalore"
                    disabled={watchedLocationType === 'Remote'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Experience *
                  </label>
                  <input
                    type="text"
                    {...register('experience_required')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., 0-2 years"
                  />
                  {errors.experience_required && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.experience_required.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <GraduationCap className="w-4 h-4 inline mr-1" />
                    Qualification *
                  </label>
                  <input
                    type="text"
                    {...register('qualification')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., B.Tech"
                  />
                {errors.qualification && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.qualification.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Eligible Graduation Years
                </label>
                <input
                  type="text"
                  {...register('eligible_years')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="e.g., 2024, 2025, 2026"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Mention the graduation batches that can apply. Separate multiple years with commas.
                </p>
              </div>
            </div>

              {/* Descriptions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Short Description *
                </label>
                <textarea
                  {...register('short_description')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="Brief overview (50+ characters)"
                />
                {errors.short_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.short_description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Full Description *
                </label>
                <textarea
                  {...register('full_description')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="Complete job description (100+ characters)"
                />
                {errors.full_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.full_description.message}</p>
                )}
              </div>

              {/* Application Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <ExternalLink className="w-4 h-4 inline mr-1" />
                  Application Link *
                </label>
                <input
                  type="url"
                  {...register('application_link')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="https://company.com/careers/apply"
                />
                {errors.application_link && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.application_link.message}</p>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  {...register('is_active')}
                  id="is_active"
                  className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job is active and accepting applications
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-dark-300">
                <button
                  type="button"
                  onClick={() => navigate('/admin/jobs')}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className={`font-semibold py-3 px-8 rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                    isSubmitting || !isDirty
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Update Job</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
