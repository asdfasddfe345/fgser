// src/types/autoApply.ts

export interface AutoApplyFormData {
  fullName: string;
  email: string;
  phone: string;
  linkedin?: string;
  github?: string;
  location?: string;
  education: EducationFormData[];
  workExperience: WorkExperienceFormData[];
  skills: SkillFormData[];
  certifications: CertificationFormData[];
  summary?: string;
  careerObjective?: string;
  coverLetter?: string;
  portfolioUrl?: string;
  expectedSalary?: string;
  noticePeriod?: string;
  workAuthorization?: string;
  willingToRelocate?: boolean;
}

export interface EducationFormData {
  degree: string;
  school: string;
  year: string;
  cgpa?: string;
  location?: string;
}

export interface WorkExperienceFormData {
  role: string;
  company: string;
  year: string;
  description: string;
  location?: string;
}

export interface SkillFormData {
  category: string;
  skills: string[];
}

export interface CertificationFormData {
  title: string;
  description?: string;
  issuer?: string;
  year?: string;
}

export interface FormFieldMapping {
  fieldName: string;
  fieldType: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'file' | 'checkbox' | 'radio';
  value: string | boolean;
  selector?: string; // CSS selector for the field
  alternatives?: string[]; // Alternative field names/selectors
}

export interface AutoApplyJobDetails {
  title: string;
  company: string;
  domain: string;
  experience: string;
  qualification: string;
  applicationUrl: string;
}

export interface AutoApplyMetadata {
  userId: string;
  jobId: string;
  optimizedResumeId: string;
  timestamp: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AutoApplyRequest {
  applicationUrl: string;
  userData: AutoApplyFormData;
  resumeFileUrl: string;
  jobDetails: AutoApplyJobDetails;
  metadata: AutoApplyMetadata;
}

export interface AutoApplyResponse {
  success: boolean;
  message: string;
  status: 'submitted' | 'failed' | 'partial';
  screenshotUrl?: string;
  error?: string;
  formFieldsFilled?: { [fieldName: string]: string };
  applicationConfirmationText?: string;
  redirectUrl?: string;
  processingTimeMs?: number;
  browserLogs?: string[];
}

export interface FormAnalysisResult {
  detectedFields: FormFieldMapping[];
  requiredFields: string[];
  optionalFields: string[];
  hasFileUpload: boolean;
  hasCaptcha: boolean;
  formMethod: string;
  formAction: string;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}