import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  Upload,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  FileText,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { JobListing } from '../../types/jobs';
import { Breadcrumb } from '../common/Breadcrumb';

interface ApplicationFormData {
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  degree: string;
  institution: string;
  passedOutYear: string;
  completionDate: string;
  cgpa: string;
  companyName: string;
  jobTitle: string;
  experienceDuration: string;
  experienceDescription: string;
  whyGoodFit: string;
  expectedSalary: string;
  noticePeriod: string;
  availableToStart: string;
  resumeFile: File | null;
  coverLetterFile: File | null;
  agreeToTerms: boolean;
}

export const JobApplicationFormPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ApplicationFormData>({
    fullName: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    degree: '',
    institution: '',
    passedOutYear: '',
    completionDate: '',
    cgpa: '',
    companyName: '',
    jobTitle: '',
    experienceDuration: '',
    experienceDescription: '',
    whyGoodFit: '',
    expectedSalary: '',
    noticePeriod: '',
    availableToStart: '',
    resumeFile: null,
    coverLetterFile: null,
    agreeToTerms: false
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchJobAndProfile = async () => {
      if (!jobId) {
        setError('Job ID is missing');
        setLoading(false);
        return;
      }

      try {
        const { data: jobData, error: jobError } = await supabase
          .from('job_listings')
          .select('*')
          .eq('id', jobId)
          .single();

        if (jobError) throw jobError;
        setJob(jobData as JobListing);

        if (isAuthenticated && user) {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (profileData) {
            setFormData(prev => ({
              ...prev,
              fullName: profileData.full_name || (user as any)?.user_metadata?.name || '',
              email: user.email || '',
              phone: profileData.phone || '',
              linkedinUrl: profileData.linkedin_url || '',
              githubUrl: profileData.github_url || '',
              portfolioUrl: profileData.portfolio_url || '',
              degree: profileData.education_details?.[0]?.degree || '',
              institution: profileData.education_details?.[0]?.institution || '',
              passedOutYear: profileData.education_details?.[0]?.passed_out_year || '',
              cgpa: profileData.education_details?.[0]?.cgpa || '',
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchJobAndProfile();
  }, [jobId, isAuthenticated, user]);

  const handleInputChange = (field: keyof ApplicationFormData, value: string | boolean | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (field: 'resumeFile' | 'coverLetterFile', file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [field]: 'File size must be less than 5MB' }));
      return;
    }
    handleInputChange(field, file);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.degree.trim()) newErrors.degree = 'Degree is required';
    if (!formData.institution.trim()) newErrors.institution = 'Institution is required';
    if (!formData.passedOutYear.trim()) newErrors.passedOutYear = 'Passed-out year is required';
    if (!formData.resumeFile) newErrors.resumeFile = 'Resume is required';
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to terms';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!user || !job) {
      setError('Missing user or job information');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let resumeUrl = '';
      let coverLetterUrl = '';

      if (formData.resumeFile) {
        const resumeFileName = `${user.id}/${Date.now()}_${formData.resumeFile.name}`;
        const { data: resumeUpload, error: resumeError } = await supabase.storage
          .from('resumes')
          .upload(resumeFileName, formData.resumeFile);

        if (resumeError) throw resumeError;
        const { data: { publicUrl } } = supabase.storage.from('resumes').getPublicUrl(resumeFileName);
        resumeUrl = publicUrl;
      }

      if (formData.coverLetterFile) {
        const coverFileName = `${user.id}/${Date.now()}_${formData.coverLetterFile.name}`;
        const { data: coverUpload, error: coverError } = await supabase.storage
          .from('cover-letters')
          .upload(coverFileName, formData.coverLetterFile);

        if (coverError) throw coverError;
        const { data: { publicUrl } } = supabase.storage.from('cover-letters').getPublicUrl(coverFileName);
        coverLetterUrl = publicUrl;
      }

      const applicationData = {
        user_id: user.id,
        job_listing_id: job.id,
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        linkedin_url: formData.linkedinUrl,
        github_url: formData.githubUrl,
        portfolio_url: formData.portfolioUrl,
        degree: formData.degree,
        institution: formData.institution,
        passed_out_year: parseInt(formData.passedOutYear),
        completion_date: formData.completionDate || null,
        cgpa: formData.cgpa,
        company_name: formData.companyName,
        job_title: formData.jobTitle,
        experience_duration: formData.experienceDuration,
        experience_description: formData.experienceDescription,
        why_good_fit: formData.whyGoodFit,
        expected_salary: formData.expectedSalary,
        notice_period: formData.noticePeriod,
        available_to_start: formData.availableToStart,
        resume_file_url: resumeUrl,
        cover_letter_url: coverLetterUrl,
        application_method: 'normal',
        status: 'pending',
        applied_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('job_applications')
        .insert([applicationData]);

      if (insertError) throw insertError;

      setShowSuccess(true);
      setTimeout(() => {
        navigate('/jobs/applications');
      }, 3000);
    } catch (err) {
      console.error('Error submitting application:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Job Not Found</h2>
          <button
            onClick={() => navigate('/jobs')}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Application Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your application for {job.role_title} at {job.company_name} has been successfully submitted.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Redirecting to My Applications...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Breadcrumb
          items={[
            { label: 'Jobs', path: '/jobs' },
            { label: job.company_name, path: `/jobs/${jobId}/apply` },
            { label: 'Application Form', path: undefined, isCurrentPage: true }
          ]}
          className="mb-6"
        />

        <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              {job.company_logo_url ? (
                <img src={job.company_logo_url} alt={job.company_name} className="w-12 h-12 rounded-lg" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {job.company_name.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{job.role_title}</h1>
                <p className="text-gray-600 dark:text-gray-300">{job.company_name}</p>
              </div>
            </div>
            {job.application_link && job.application_link.trim() !== '' && (
              <a
                href={job.application_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors duration-200 text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Apply on Company Site</span>
              </a>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center space-x-2">
              <User className="w-6 h-6 text-blue-600" />
              <span>Personal Information</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.fullName ? 'border-red-500' : 'border-gray-300 dark:border-dark-300'} bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="John Doe"
                />
                {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-dark-300'} bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="john@example.com"
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.phone ? 'border-red-500' : 'border-gray-300 dark:border-dark-300'} bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="+91 9876543210"
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => handleInputChange('linkedinUrl', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://linkedin.com/in/johndoe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GitHub URL
                </label>
                <input
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => handleInputChange('githubUrl', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://github.com/johndoe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Portfolio URL
                </label>
                <input
                  type="url"
                  value={formData.portfolioUrl}
                  onChange={(e) => handleInputChange('portfolioUrl', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://johndoe.com"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center space-x-2">
              <GraduationCap className="w-6 h-6 text-blue-600" />
              <span>Education</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Degree/Qualification <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => handleInputChange('degree', e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.degree ? 'border-red-500' : 'border-gray-300 dark:border-dark-300'} bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="B.Tech in Computer Science"
                />
                {errors.degree && <p className="text-red-500 text-sm mt-1">{errors.degree}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Institution <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.institution}
                  onChange={(e) => handleInputChange('institution', e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.institution ? 'border-red-500' : 'border-gray-300 dark:border-dark-300'} bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="University Name"
                />
                {errors.institution && <p className="text-red-500 text-sm mt-1">{errors.institution}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Passed-Out Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1980"
                  max="2030"
                  value={formData.passedOutYear}
                  onChange={(e) => handleInputChange('passedOutYear', e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border ${errors.passedOutYear ? 'border-red-500' : 'border-gray-300 dark:border-dark-300'} bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="2024"
                />
                {errors.passedOutYear && <p className="text-red-500 text-sm mt-1">{errors.passedOutYear}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Completion Date (MM/YYYY)
                </label>
                <input
                  type="month"
                  value={formData.completionDate}
                  onChange={(e) => handleInputChange('completionDate', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CGPA/Percentage
                </label>
                <input
                  type="text"
                  value={formData.cgpa}
                  onChange={(e) => handleInputChange('cgpa', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="8.5 or 85%"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center space-x-2">
              <Upload className="w-6 h-6 text-blue-600" />
              <span>Documents</span>
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resume <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileChange('resumeFile', e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                />
                {errors.resumeFile && <p className="text-red-500 text-sm mt-1">{errors.resumeFile}</p>}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PDF or DOC format, max 5MB</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cover Letter (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileChange('coverLetterFile', e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Additional Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Why are you a good fit for this role?
                </label>
                <textarea
                  value={formData.whyGoodFit}
                  onChange={(e) => handleInputChange('whyGoodFit', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-dark-300 bg-white dark:bg-dark-200 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Describe your relevant skills and experience..."
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500 rounded-xl p-4 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={`text-sm ${errors.agreeToTerms ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                I agree to the terms and conditions and confirm that the information provided is accurate. <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.agreeToTerms && <p className="text-red-500 text-sm mt-2 ml-8">{errors.agreeToTerms}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Submitting Application...</span>
              </>
            ) : (
              <>
                <Send className="w-6 h-6" />
                <span>Submit Application</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
