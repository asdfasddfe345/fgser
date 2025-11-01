// src/types/jobs.ts

export interface JobListing {
  id: string;
  company_name: string;
  company_logo_url?: string;
  company_website?: string;
  company_description?: string;
  role_title: string;
  package_amount?: number;
  package_type?: 'CTC' | 'stipend' | 'hourly';
  domain: string;
  location_type: 'Remote' | 'Onsite' | 'Hybrid';
  location_city?: string;
  experience_required: string;
  qualification: string;
  eligible_years?: string | string[] | null;
  short_description: string;
  description: string;
  full_description: string;
  application_link: string;
  posted_date: string;
  source_api: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Referral Information
  referral_person_name?: string;
  referral_email?: string;
  referral_code?: string;
  referral_link?: string;
  referral_bonus_amount?: number;
  referral_terms?: string;
  has_referral?: boolean;

  // Test Pattern Information
  test_requirements?: string;
  has_coding_test?: boolean;
  has_aptitude_test?: boolean;
  has_technical_interview?: boolean;
  has_hr_interview?: boolean;
  test_duration_minutes?: number;

  // AI Polish Information
  ai_polished?: boolean;
  ai_polished_at?: string;
  original_description?: string;

  // Skills and Commission
  skills?: string[];
  commission_percentage?: number;

  // User Application Status (populated for authenticated users)
  user_has_applied?: boolean;
  user_application_method?: 'manual' | 'auto';
  user_application_date?: string;
  user_application_status?: 'pending' | 'submitted' | 'failed';
}

export interface OptimizedResume {
  id: string;
  user_id: string;
  job_listing_id: string;
  resume_content: any; // ResumeData from existing types
  pdf_url?: string;
  docx_url?: string;
  optimization_score: number;
  created_at: string;
}

export interface ApplicationLog {
  application_id: string;
  job_id: string;
  company_name: string;
  role_title: string;
  application_date: string;
  application_method: 'manual' | 'auto';
  status: 'pending' | 'submitted' | 'failed';
  resume_pdf_url?: string;
  screenshot_url?: string;
  redirect_url?: string;
}

export interface JobFilters {
  domain?: string;
  location_type?: string;
  experience_required?: string;
  package_min?: number;
  package_max?: number;
  eligible_year?: string;
  search?: string;
  sort_by?: 'posted_date' | 'package_amount' | 'company_name';
  sort_order?: 'asc' | 'desc';
}

export interface AutoApplyProfile {
  full_name: string;
  email_address: string;
  phone: string;
  education_details?: any;
  experience_details?: any;
  skills_details?: any;
  linkedin_profile_url?: string;
  github_profile_url?: string;
  resume_headline?: string;
  current_location?: string;
}

export interface AutoApplyResult {
  success: boolean;
  message: string;
  applicationId: string;
  status: 'submitted' | 'failed';
  screenshotUrl?: string;
  resumeUrl?: string;
  fallbackUrl?: string;
  error?: string;
}

export interface ApplicationHistory {
  applications: ApplicationLog[];
  stats: {
    total: number;
    manual: number;
    auto: number;
    submitted: number;
    pending: number;
    failed: number;
  };
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export interface TestPattern {
  id: string;
  test_name: string;
  test_type: 'coding' | 'aptitude' | 'technical_interview' | 'hr_interview' | 'other';
  domain: string;
  difficulty_level?: 'easy' | 'medium' | 'hard';
  description?: string;
  sample_questions?: any;
  duration_minutes?: number;
  passing_score?: number;
  tips?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobTestPattern {
  id: string;
  job_listing_id: string;
  test_pattern_id: string;
  is_mandatory: boolean;
  display_order: number;
  created_at: string;
  test_pattern?: TestPattern;
}
