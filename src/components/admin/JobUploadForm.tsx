// src/components/admin/JobUploadForm.tsx
import React, { useState, useEffect } from 'react';
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
  Plus,
  Globe,
  Target,
  FileText,
  Image,
  RotateCw,
  Trash2,
  Info,
  Mail,
  Code,
  Link as LinkIcon,
  Users,
  Award,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jobsService } from '../../services/jobsService';
import { JobListing } from '../../types/jobs';
import { ImageUpload } from './ImageUpload';
import { useJobFormAutoSave } from '../../hooks/useJobFormAutoSave';

// Helper to truly make optional number inputs tolerant of empty string/NaN from form
const optionalPositiveNumber = (message: string) =>
  z.preprocess(
    (val) => {
      if (val === '' || val === null || typeof val === 'undefined') return undefined;
      // react-hook-form with valueAsNumber can pass NaN when input is empty
      if (typeof val === 'number' && Number.isNaN(val)) return undefined;
      // strings that are numeric
      if (typeof val === 'string' && val.trim() === '') return undefined;
      return val;
    },
    z.number().positive(message).optional()
  );

// Zod schema for job listing validation
const jobListingSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  company_logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  role_title: z.string().min(1, 'Role title is required'),
  package_amount: optionalPositiveNumber('Package amount must be positive'),
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

  // Referral fields
  referral_person_name: z.string().optional(),
  referral_email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  referral_code: z.string().optional(),
  referral_link: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  referral_bonus_amount: optionalPositiveNumber('Bonus amount must be positive'),
  referral_terms: z.string().optional(),

  // Test pattern fields
  test_requirements: z.string().optional(),
  has_coding_test: z.boolean().default(false),
  has_aptitude_test: z.boolean().default(false),
  has_technical_interview: z.boolean().default(false),
  has_hr_interview: z.boolean().default(false),
  test_duration_minutes: optionalPositiveNumber('Duration must be positive'),
});

type JobFormData = z.infer<typeof jobListingSchema>;

export const JobUploadForm: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showDraftNotification, setShowDraftNotification] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<JobFormData>({
    resolver: zodResolver(jobListingSchema),
    defaultValues: {
      is_active: true,
      package_type: 'CTC',
      location_type: 'Remote',
      eligible_years: '',
    },
  });

  const watchedPackageType = watch('package_type');
  const watchedLocationType = watch('location_type');
  const formData = watch();

  const { saveStatus, loadDraft, deleteDraft, clearDraft } = useJobFormAutoSave({
    formData,
    enabled: !isSubmitting && draftLoaded,
    debounceMs: 2000,
  });

  useEffect(() => {
    const restoreDraft = async () => {
      const draft = await loadDraft();
      if (draft) {
        Object.entries(draft).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            setValue(key as keyof JobFormData, value as any, {
              shouldDirty: false,
            });
          }
        });
        if (draft.company_logo_url) {
          setCompanyLogoUrl(draft.company_logo_url);
        }
        setShowDraftNotification(true);
        setTimeout(() => setShowDraftNotification(false), 5000);
      }
      setDraftLoaded(true);
    };
    restoreDraft();
  }, [loadDraft, setValue]);

  const handleClearDraft = () => {
    clearDraft();
    reset();
    setCompanyLogoUrl('');
    setShowDraftNotification(false);
  };

  const onSubmit = async (data: JobFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const jobData: Partial<JobListing> = {
        company_name: data.company_name,
        company_logo_url: companyLogoUrl || data.company_logo_url || undefined,
        role_title: data.role_title,
        package_amount: data.package_amount || undefined,
        package_type: data.package_type || undefined,
        domain: data.domain,
        location_type: data.location_type,
        location_city: data.location_city || undefined,
        experience_required: data.experience_required,
        qualification: data.qualification,
        eligible_years: data.eligible_years?.trim() ? data.eligible_years.trim() : undefined,
        short_description: data.short_description,
        full_description: data.full_description,
        application_link: data.application_link,
        is_active: data.is_active,

        // Referral information
        referral_person_name: data.referral_person_name || undefined,
        referral_email: data.referral_email || undefined,
        referral_code: data.referral_code || undefined,
        referral_link: data.referral_link || undefined,
        referral_bonus_amount: data.referral_bonus_amount || undefined,
        referral_terms: data.referral_terms || undefined,

        // Test pattern information
        test_requirements: data.test_requirements || undefined,
        has_coding_test: data.has_coding_test || false,
        has_aptitude_test: data.has_aptitude_test || false,
        has_technical_interview: data.has_technical_interview || false,
        has_hr_interview: data.has_hr_interview || false,
        test_duration_minutes: data.test_duration_minutes || undefined,
      };

      await jobsService.createJobListing(jobData);
      setSubmitSuccess(true);
      await deleteDraft();
      reset();
      setCompanyLogoUrl('');
      setTimeout(() => {
        setSubmitSuccess(false);
        navigate('/jobs');
      }, 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create job listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const domainOptions = [
    'SDE', 'Data Science', 'Product', 'Design', 'Marketing', 'Sales', 
    'Analytics', 'AI', 'DevOps', 'Mobile', 'Frontend', 'Backend', 
    'Full-Stack', 'QA', 'Content', 'HR', 'Finance', 'Operations'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Admin - Upload Job Listing</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Plus className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Create New Job Listing
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Add a new job opportunity to help candidates find their dream role
            </p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                    Job Details
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mt-1">Fill in all the required information for the job listing</p>
                </div>
                <div className="flex items-center space-x-2">
                  {saveStatus.status === 'saving' && (
                    <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Saving...</span>
                    </div>
                  )}
                  {saveStatus.status === 'saved' && saveStatus.lastSaved && (
                    <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">Saved {new Date(saveStatus.lastSaved).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {saveStatus.status === 'error' && (
                    <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">Save failed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              {showDraftNotification && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-blue-900/20 dark:border-blue-500/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                      <div>
                        <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                          Draft restored from previous session
                        </p>
                        <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                          Your form data has been automatically restored. Continue editing or start fresh.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 flex items-center space-x-1 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Draft</span>
                    </button>
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
                    <div>
                      <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">
                        Job listing created successfully! AI enhancement in progress...
                      </p>
                      <p className="text-green-600 dark:text-neon-cyan-400 text-xs mt-1">
                        Your job description will be automatically polished and enhanced by AI.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                    <Image className="w-4 h-4 inline mr-1" />
                    Company Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    {...register('company_logo_url')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="https://example.com/logo.png"
                  />
                  {errors.company_logo_url && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.company_logo_url.message}</p>
                  )}
                </div>
              </div>

              {/* Job Role Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Briefcase className="w-4 h-4 inline mr-1" />
                    Role Title *
                  </label>
                  <input
                    type="text"
                    {...register('role_title')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Senior Software Engineer, Product Manager"
                  />
                  {errors.role_title && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.role_title.message}</p>
                  )}
                </div>

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
              </div>

              {/* Package Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <IndianRupee className="w-4 h-4 inline mr-1" />
                    Package Amount (Optional)
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Package Type
                  </label>
                  <select
                    {...register('package_type')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  >
                    <option value="">Select Type</option>
                    <option value="CTC">CTC (Annual)</option>
                    <option value="stipend">Stipend (Monthly)</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                  {errors.package_type && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.package_type.message}</p>
                  )}
                </div>
              </div>

              {/* Location Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {errors.location_type && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location_type.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-1" />
                    City (Optional)
                  </label>
                  <input
                    type="text"
                    {...register('location_city')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., Bangalore, Mumbai, Delhi"
                    disabled={watchedLocationType === 'Remote'}
                  />
                  {errors.location_city && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.location_city.message}</p>
                  )}
                </div>
              </div>

              {/* Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Experience Required *
                  </label>
                  <input
                    type="text"
                    {...register('experience_required')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    placeholder="e.g., 0-2 years, 3-5 years, 5+ years"
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
                    placeholder="e.g., B.Tech/B.E in Computer Science, MBA"
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
                  placeholder="Brief overview of the role and company (50+ characters)"
                />
                {errors.short_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.short_description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Full Job Description *
                </label>
                <textarea
                  {...register('full_description')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-40 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  placeholder="Complete job description including responsibilities, requirements, skills, and benefits (100+ characters)"
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

              {/* Referral Information Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 p-6 rounded-xl border border-green-200 dark:border-green-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                  Referral Information (Optional)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Add employee referral contact details if someone from the company can refer candidates
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Users className="w-4 h-4 inline mr-1" />
                      Referral Person Name
                    </label>
                    <input
                      type="text"
                      {...register('referral_person_name')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., John Doe"
                    />
                    {errors.referral_person_name && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_person_name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Referral Email
                    </label>
                    <input
                      type="email"
                      {...register('referral_email')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="john.doe@company.com"
                    />
                    {errors.referral_email && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Code className="w-4 h-4 inline mr-1" />
                      Referral Code
                    </label>
                    <input
                      type="text"
                      {...register('referral_code')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., REF123ABC"
                    />
                    {errors.referral_code && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_code.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <LinkIcon className="w-4 h-4 inline mr-1" />
                      Referral Link
                    </label>
                    <input
                      type="url"
                      {...register('referral_link')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="https://company.com/referral/..."
                    />
                    {errors.referral_link && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_link.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Award className="w-4 h-4 inline mr-1" />
                      Referral Bonus Amount (₹)
                    </label>
                    <input
                      type="number"
                      {...register('referral_bonus_amount', { valueAsNumber: true })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., 50000"
                      min="0"
                    />
                    {errors.referral_bonus_amount && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_bonus_amount.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Referral Terms & Conditions
                    </label>
                    <textarea
                      {...register('referral_terms')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 h-20 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="Terms and conditions for the referral bonus (e.g., payable after 90 days of joining)"
                    />
                    {errors.referral_terms && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.referral_terms.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Test Patterns Section */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <ClipboardCheck className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
                  Selection Process & Tests (Optional)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Specify the tests and interviews candidates will face during the selection process
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Test Requirements Overview
                    </label>
                    <textarea
                      {...register('test_requirements')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 h-20 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="Brief description of the overall selection process and what to expect"
                    />
                    {errors.test_requirements && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.test_requirements.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_coding_test')}
                        id="has_coding_test"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_coding_test" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Code className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        Coding Test
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_aptitude_test')}
                        id="has_aptitude_test"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_aptitude_test" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Target className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        Aptitude Test
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_technical_interview')}
                        id="has_technical_interview"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_technical_interview" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Sparkles className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        Technical Interview
                      </label>
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300">
                      <input
                        type="checkbox"
                        {...register('has_hr_interview')}
                        id="has_hr_interview"
                        className="form-checkbox h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="has_hr_interview" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                        <Users className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" />
                        HR Interview
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Estimated Total Duration (minutes)
                    </label>
                    <input
                      type="number"
                      {...register('test_duration_minutes', { valueAsNumber: true })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      placeholder="e.g., 120"
                      min="0"
                    />
                    {errors.test_duration_minutes && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.test_duration_minutes.message}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Total estimated time for all tests and interviews combined
                    </p>
                  </div>
                </div>
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

              {/* Submit Button */}
              <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-dark-300">
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="border-2 border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold py-3 px-6 rounded-xl transition-colors flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Clear Draft</span>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className={`font-semibold py-3 px-8 rounded-xl transition-all duration-300 flex items-center space-x-2 ${
                    isSubmitting || !isDirty
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating Job...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Create Job Listing</span>
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
