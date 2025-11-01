// src/services/jobsService.ts
import { supabase } from '../lib/supabaseClient';
import { JobListing, JobFilters, AutoApplyResult, ApplicationHistory, OptimizedResume } from '../types/jobs';
import { ResumeData } from '../types/resume';
import { exportToPDF } from '../utils/exportUtils';

export const isEligibleYearsColumnMissing = (error: any): boolean => {
  if (!error) return false;
  const message = typeof error.message === 'string' ? error.message : '';
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    message.includes('eligible_years')
  );
};

class JobsService {
  private static eligibleYearsSupported = true;

  // Create a new job listing (Admin only)
  async createJobListing(jobData: Partial<JobListing>): Promise<JobListing> {
    try {
      console.log('JobsService: Creating new job listing...');

      // Validate required fields
      if (!jobData.company_name || !jobData.role_title || !jobData.domain ||
          !jobData.location_type || !jobData.experience_required ||
          !jobData.qualification || !jobData.short_description ||
          !jobData.full_description || !jobData.application_link) {
        throw new Error('Missing required job listing fields');
      }

      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('JobsService: Session error:', sessionError);
        throw new Error('Failed to verify authentication. Please log out and log back in.');
      }
      if (!session) {
        throw new Error('Authentication required. Please log in.');
      }

      // Verify admin status (with graceful fallback)
      console.log('JobsService: Checking admin status...');
      let isAdmin = false;

      try {
        const { data: adminStatus, error: adminCheckError } = await supabase.rpc('debug_admin_status');

        if (adminCheckError) {
          console.warn('JobsService: debug_admin_status not available, falling back to metadata check:', adminCheckError.message);
          const userRole = session.user?.app_metadata?.role || session.user?.user_metadata?.role;
          isAdmin = userRole === 'admin';
        } else if (adminStatus && adminStatus.is_admin_result) {
          console.log('JobsService: Admin check via RPC succeeded.');
          isAdmin = true;
        }
      } catch (err) {
        console.warn('JobsService: Error calling debug_admin_status, using fallback:', err);
        const userRole = session.user?.app_metadata?.role || session.user?.user_metadata?.role;
        isAdmin = userRole === 'admin';
      }

      if (!isAdmin) {
        throw new Error('❌ Admin privileges required. You do not have permission to create job listings.');
      }

      console.log('JobsService: ✅ Admin verification successful. Proceeding with job creation...');

      // Prepare job data with default values
      const eligibleYears = (() => {
        const value = jobData.eligible_years;
        if (!value) return null;

        if (Array.isArray(value)) {
          const cleaned = value.map((item) => item.trim()).filter(Boolean);
          return cleaned.length ? cleaned.join(', ') : null;
        }

        if (typeof value === 'string') {
          const normalized = value.includes(',') || value.includes('|') || value.includes('/')
            ? value.split(/[,|/]/)
            : value.split(/\s+/);

          const cleaned = normalized.map((item) => item.trim()).filter(Boolean);
          return cleaned.length ? cleaned.join(', ') : null;
        }

        return null;
      })();

      const insertData: Record<string, any> = {
        company_name: jobData.company_name,
        company_logo_url: jobData.company_logo_url || null,
        company_website: jobData.company_website || null,
        company_description: jobData.company_description || null,
        role_title: jobData.role_title,
        package_amount: jobData.package_amount || null,
        package_type: jobData.package_type || null,
        domain: jobData.domain,
        location_type: jobData.location_type,
        location_city: jobData.location_city || null,
        experience_required: jobData.experience_required,
        qualification: jobData.qualification,
        eligible_years: eligibleYears,
        short_description: jobData.short_description,
        full_description: jobData.full_description,
        description: jobData.full_description, // Duplicate for compatibility
        application_link: jobData.application_link,
        posted_date: new Date().toISOString(),
        source_api: 'manual_admin',
        is_active: jobData.is_active !== undefined ? jobData.is_active : true,

        // Referral information
        referral_person_name: jobData.referral_person_name || null,
        referral_email: jobData.referral_email || null,
        referral_code: jobData.referral_code || null,
        referral_link: jobData.referral_link || null,
        referral_bonus_amount: jobData.referral_bonus_amount || null,
        referral_terms: jobData.referral_terms || null,
        has_referral: !!(jobData.referral_person_name || jobData.referral_email || jobData.referral_code || jobData.referral_link),

        // Test pattern information
        test_requirements: jobData.test_requirements || null,
        has_coding_test: jobData.has_coding_test || false,
        has_aptitude_test: jobData.has_aptitude_test || false,
        has_technical_interview: jobData.has_technical_interview || false,
        has_hr_interview: jobData.has_hr_interview || false,
        test_duration_minutes: jobData.test_duration_minutes || null,

        // AI polish tracking (will be updated after creation)
        ai_polished: false,
        ai_polished_at: null,
        original_description: jobData.full_description, // Store original before polish
      };

      if (!JobsService.eligibleYearsSupported) {
        delete insertData.eligible_years;
      }

      console.log('JobsService: Inserting job data:', insertData);

      const attemptInsert = async (payload: Record<string, any>) =>
        supabase.from('job_listings').insert(payload).select().single();

      let { data: newJob, error } = await attemptInsert(insertData);

      if (error && isEligibleYearsColumnMissing(error)) {
        console.warn('JobsService: eligible_years column not found. Retrying without it.');
        JobsService.eligibleYearsSupported = false;
        const fallbackPayload = { ...insertData };
        delete fallbackPayload.eligible_years;
        ({ data: newJob, error } = await attemptInsert(fallbackPayload));
      }

      if (error) {
        console.error('JobsService: Error creating job listing:', error);
        throw new Error(
          `Failed to create job listing: ${error.message}\n\n` +
          `Error Code: ${error.code || 'UNKNOWN'}\n` +
          `Hint: ${error.hint || 'No additional information'}`
        );
      }

      console.log('JobsService: Job listing created successfully with ID:', newJob.id);

      // Trigger AI polish in background (don't wait for it)
      this.polishJobDescriptionInBackground(newJob.id, newJob).catch(err => {
        console.warn('JobsService: AI polish failed, job will use original description:', err);
      });

      return newJob;
    } catch (error) {
      console.error('JobsService: Error in createJobListing:', error);
      throw error;
    }
  }

  // Get a single job listing by ID
  async getJobListingById(jobId: string): Promise<JobListing | null> {
    try {
      const { data: job, error } = await supabase
        .from('job_listings')
        .select('*')
        .eq('id', jobId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching job listing:', error);
        throw new Error(`Failed to fetch job: ${error.message}`);
      }

      return job;
    } catch (error) {
      console.error('Error in getJobListingById:', error);
      throw error;
    }
  }

  // Store optimized resume data
  async storeOptimizedResume(
    userId: string,
    jobId: string,
    resumeData: ResumeData
  ): Promise<string> {
    try {
      console.log('JobsService: Storing optimized resume for user:', userId, 'job:', jobId);
      const optimizationScore = Math.floor(Math.random() * 20) + 80;

      const placeholderPdfUrl = `https://example.com/resumes/optimized_${userId}_${jobId}.pdf`;
      const placeholderDocxUrl = `https://example.com/resumes/optimized_${userId}_${jobId}.docx`;

      const { data: optimizedResume, error } = await supabase
        .from('optimized_resumes')
        .insert({
          user_id: userId,
          job_listing_id: jobId,
          resume_content: resumeData,
          pdf_url: placeholderPdfUrl,
          docx_url: placeholderDocxUrl,
          optimization_score: optimizationScore
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error storing optimized resume:', error);
        throw new Error('Failed to store optimized resume');
      }

      console.log('JobsService: Optimized resume stored with ID:', optimizedResume.id);
      return optimizedResume.id;
    } catch (error) {
      console.error('Error in storeOptimizedResume:', error);
      throw error;
    }
  }

  async getOptimizedResumeById(optimizedResumeId: string): Promise<OptimizedResume | null> {
    try {
      const { data: optimizedResume, error } = await supabase
        .from('optimized_resumes')
        .select('*')
        .eq('id', optimizedResumeId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching optimized resume:', error);
        return null;
      }
      return optimizedResume;
    } catch (error) {
      console.error('Error in getOptimizedResumeById:', error);
      return null;
    }
  }

async getJobListings(filters: JobFilters = {}, limit = 20, offset = 0): Promise<{
  jobs: JobListing[];
  total: number;
  hasMore: boolean;
  totalPages: number;
  totalCompanies: number;
}> {
    try {
      console.log('JobsService: Fetching job listings from database with filters:', filters);

      // Start building the query
      let query = supabase
        .from('job_listings')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

      // Apply filters
      if (filters.domain) {
        query = query.eq('domain', filters.domain);
      }

      if (filters.location_type) {
        query = query.eq('location_type', filters.location_type);
      }

      if (filters.experience_required) {
        query = query.eq('experience_required', filters.experience_required);
      }

      if (filters.eligible_year && JobsService.eligibleYearsSupported) {
        query = query.ilike('eligible_years', `%${filters.eligible_year}%`);
      }

      if (filters.package_min) {
        query = query.gte('package_amount', filters.package_min);
      }

      if (filters.package_max) {
        query = query.lte('package_amount', filters.package_max);
      }

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        query = query.or(`role_title.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,domain.ilike.%${searchTerm}%`);
      }

      // Apply sorting
      if (filters.sort_by) {
        const ascending = filters.sort_order === 'asc';
        query = query.order(filters.sort_by, { ascending });
      } else {
        // Default sorting by posted_date (newest first)
        query = query.order('posted_date', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      // Execute query
      const { data: jobs, error, count } = await query;

      if (error) {
        console.error('JobsService: Database error:', error);
        throw new Error(`Failed to fetch jobs: ${error.message}`);
      }

      console.log(`JobsService: Fetched ${jobs?.length || 0} jobs from database (total: ${count})`);

      // Get total unique companies count from ALL active jobs
      const { data: companiesData, error: companiesError } = await supabase
        .from('job_listings')
        .select('company_name')
        .eq('is_active', true);

      const totalCompanies = companiesError ? 0 : new Set(companiesData?.map(c => c.company_name) || []).size;

      const total = count || 0;
      const hasMore = offset + limit < total;
      const totalPages = Math.ceil(total / limit);

      return {
        jobs: jobs || [],
        total,
        hasMore,
        totalPages,
        totalCompanies
      };

    } catch (error) {
      console.error('JobsService: Error fetching job listings:', error);
      throw error;
    }
  }


  // Get all active jobs (used for AI matching)
  async getAllJobs(): Promise<JobListing[]> {
    try {
      console.log('JobsService: Fetching all jobs for AI matching...');

      const { data: jobs, error } = await supabase
        .from('job_listings')
        .select('*')
        .eq('is_active', true)
        .order('posted_date', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('JobsService: Database error fetching all jobs:', error);
        throw new Error(`Failed to fetch jobs: ${error.message}`);
      }

      console.log(`JobsService: Fetched ${jobs?.length || 0} jobs for AI matching`);
      return jobs || [];
    } catch (error) {
      console.error('JobsService: Error fetching all jobs:', error);
      throw error;
    }
  }

  async optimizeResumeForJob(jobId: string, userResumeText?: string): Promise<OptimizedResume> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-resume-for-job`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId, userResumeText }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to optimize resume');
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Resume optimization failed');

      return {
        id: data.resumeId,
        user_id: session.user.id,
        job_listing_id: jobId,
        resume_content: data.resumeContent,
        pdf_url: data.pdfUrl,
        docx_url: data.docxUrl,
        optimization_score: data.optimizationScore,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error optimizing resume for job:', error);
      throw error;
    }
  }

  async logManualApplication(jobId: string, optimizedResumeId: string, redirectUrl: string): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const { error } = await supabase
        .from('manual_apply_logs')
        .insert({
          user_id: session.user.id,
          job_listing_id: jobId,
          optimized_resume_id: optimizedResumeId,
          application_date: new Date().toISOString(),
          status: 'submitted',
          redirect_url: redirectUrl
        });

      if (error) {
        console.error('Error logging manual application:', error);
        throw new Error('Failed to log manual application');
      }
    } catch (error) {
      console.error('Error in logManualApplication:', error);
      throw error;
    }
  }

  async autoApplyForJob(jobId: string, optimizedResumeId: string): Promise<AutoApplyResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-apply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId, optimizedResumeId }),
        }
      );

      const data = await response.json();
      return {
        success: data.success,
        message: data.message,
        applicationId: data.applicationId,
        status: data.status,
        screenshotUrl: data.screenshotUrl,
        resumeUrl: data.resumeUrl,
        fallbackUrl: data.fallbackUrl,
        error: data.error
      };
    } catch (error) {
      console.error('Error in auto apply:', error);
      throw new Error('Auto-apply failed');
    }
  }

  async getApplicationHistory(filters: { status?: string; method?: string } = {}): Promise<ApplicationHistory> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const params = new URLSearchParams({
        ...(filters.status && { status: filters.status }),
        ...(filters.method && { method: filters.method }),
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-application-history?${params}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`Failed to fetch application history: ${response.statusText}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching application history:', error);
      throw new Error('Failed to fetch application history');
    }
  }

  // Background AI polish job description using DeepSeek
  private async polishJobDescriptionInBackground(jobId: string, job: JobListing): Promise<void> {
    try {
      // Dynamically import deepseek service to avoid circular dependencies
      const { deepseekService } = await import('./deepseekService');

      if (!deepseekService.isConfigured()) {
        console.log('JobsService: DeepSeek not configured, skipping AI polish');
        return;
      }

      console.log('JobsService: Starting AI polish for job:', jobId);

      // Polish the full job description
      const polishedDescription = await deepseekService.polishJobDescription({
        companyName: job.company_name,
        roleTitle: job.role_title,
        domain: job.domain,
        description: job.full_description,
        qualification: job.qualification,
        experienceRequired: job.experience_required,
      });

      // Generate company description if not provided
      let companyDescription = job.company_description;
      if (!companyDescription) {
        companyDescription = await deepseekService.generateCompanyDescription({
          companyName: job.company_name,
          roleTitle: job.role_title,
          domain: job.domain,
          jobDescription: job.full_description,
          qualification: job.qualification,
          experienceRequired: job.experience_required,
        });
      }

      // Update job with polished content
      const { error } = await supabase
        .from('job_listings')
        .update({
          full_description: polishedDescription,
          description: polishedDescription,
          company_description: companyDescription,
          ai_polished: true,
          ai_polished_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) {
        console.error('JobsService: Failed to update job with AI polish:', error);
      } else {
        console.log('JobsService: AI polish completed successfully for job:', jobId);
      }
    } catch (error) {
      console.error('JobsService: Error in AI polish background task:', error);
      // Don't throw - this is a background task
    }
  }

  async getFilterOptions(): Promise<{
    domains: string[];
    locationTypes: string[];
    experienceLevels: string[];
    eligibleYears: string[];
    packageRanges: { min: number; max: number };
  }> {
    try {
      const { data: domains } = await supabase.from('job_listings').select('domain').eq('is_active', true);
      const { data: locations } = await supabase.from('job_listings').select('location_type').eq('is_active', true);
      const { data: experiences } = await supabase.from('job_listings').select('experience_required').eq('is_active', true);
      const { data: packages } = await supabase
        .from('job_listings')
        .select('package_amount')
        .eq('is_active', true)
        .not('package_amount', 'is', null);
      let eligibleYears: string[] = [];

      if (JobsService.eligibleYearsSupported) {
        const { data: eligibleYearRows, error: eligibleYearsError } = await supabase
          .from('job_listings')
          .select('eligible_years')
          .eq('is_active', true);

        if (eligibleYearsError) {
          if (isEligibleYearsColumnMissing(eligibleYearsError)) {
            JobsService.eligibleYearsSupported = false;
          } else {
            console.error('Error fetching eligible years:', eligibleYearsError);
          }
        } else if (eligibleYearRows) {
          const yearSet = new Set<string>();
          eligibleYearRows.forEach((row: { eligible_years?: string | null }) => {
            if (!row?.eligible_years) return;
            const tokens = row.eligible_years.includes(',') || row.eligible_years.includes('|') || row.eligible_years.includes('/')
              ? row.eligible_years.split(/[,|/]/)
              : row.eligible_years.split(/\s+/);
            tokens
              .map((token) => token.trim())
              .filter(Boolean)
              .forEach((token) => yearSet.add(token));
          });
          eligibleYears = Array.from(yearSet).sort();
        }
      }

      const uniqueDomains = [...new Set(domains?.map(d => d.domain) || [])];
      const uniqueLocations = [...new Set(locations?.map(l => l.location_type) || [])];
      const uniqueExperiences = [...new Set(experiences?.map(e => e.experience_required) || [])];

      const packageAmounts = packages?.map(p => p.package_amount).filter(Boolean) || [];
      const packageRanges = {
        min: Math.min(...packageAmounts, 0),
        max: Math.max(...packageAmounts, 1000000)
      };

      return {
        domains: uniqueDomains,
        locationTypes: uniqueLocations,
        experienceLevels: uniqueExperiences,
        eligibleYears,
        packageRanges
      };
    } catch (error) {
      console.error('Error getting filter options:', error);
      return {
        domains: ['SDE', 'Data Science', 'Product', 'Marketing', 'Analytics'],
        locationTypes: ['Remote', 'Onsite', 'Hybrid'],
        experienceLevels: ['0-1 years', '0-2 years', '1-2 years', '1-3 years', '2-4 years', '3-5 years'],
        eligibleYears: ['2022', '2023', '2024', '2025', '2026'],
        packageRanges: { min: 0, max: 1000000 }
      };
    }
  }
}

export const jobsService = new JobsService();
