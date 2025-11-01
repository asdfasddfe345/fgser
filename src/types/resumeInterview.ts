export interface UserResume {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  parsed_text?: string;
  parsed_data: ParsedResumeData;
  skills_detected: string[];
  experience_level?: ExperienceLevel;
  years_of_experience?: number;
  domains: string[];
  is_primary: boolean;
  analysis_completed: boolean;
  analysis_metadata: ResumeAnalysisMetadata;
  created_at: string;
  updated_at: string;
}

export type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive';

export interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  education: EducationEntry[];
  work_experience: WorkExperienceEntry[];
  projects: ProjectEntry[];
  skills: SkillCategory[];
  certifications: string[];
  achievements: string[];
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
  gpa?: string;
  location?: string;
}

export interface WorkExperienceEntry {
  title: string;
  company: string;
  duration: string;
  location?: string;
  responsibilities: string[];
  technologies?: string[];
}

export interface ProjectEntry {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
  highlights: string[];
}

export interface SkillCategory {
  category: string;
  skills: string[];
}

export interface ResumeAnalysisMetadata {
  total_skills_count: number;
  technical_skills_count: number;
  soft_skills_count: number;
  projects_count: number;
  work_experiences_count: number;
  education_count: number;
  confidence_score: number;
  analysis_version: string;
  analyzed_at: string;
}

export interface ResumeAnalysisRequest {
  resumeText: string;
  fileName: string;
  userId: string;
}

export interface ResumeAnalysisResponse {
  parsed_data: ParsedResumeData;
  skills_detected: string[];
  experience_level: ExperienceLevel;
  years_of_experience: number;
  domains: string[];
  analysis_metadata: ResumeAnalysisMetadata;
}

export type QuestionGenerationMode = 'database_only' | 'ai_only' | 'hybrid';

export interface ResumeBasedInterviewConfig {
  resumeId: string;
  generationMode: QuestionGenerationMode;
  databaseQuestionsRatio: number;
  aiQuestionsRatio: number;
  focusAreas?: string[];
}

export interface DynamicQuestionContext {
  resume_id: string;
  user_id: string;
  skill_being_tested: string;
  experience_level: ExperienceLevel;
  specific_project?: string;
  specific_technology?: string;
  previous_answers?: string[];
}

export interface GeneratedQuestion {
  question_text: string;
  category: string;
  difficulty: string;
  resume_context: DynamicQuestionContext;
  generation_rationale: string;
  expected_topics: string[];
}

export interface ResumeSkillValidation {
  skill_name: string;
  claimed_on_resume: boolean;
  validated_in_interview: boolean;
  confidence_level: 'high' | 'medium' | 'low' | 'not_tested';
  evidence_from_answer?: string;
  discrepancy_notes?: string;
}

export interface ResumeInterviewAlignment {
  overall_alignment_score: number;
  skills_validated: ResumeSkillValidation[];
  projects_discussed: string[];
  experience_verified: boolean;
  credibility_assessment: {
    overall_score: number;
    consistent_answers: number;
    inconsistent_answers: number;
    inflated_claims: string[];
    verified_claims: string[];
  };
  recommendations: string[];
}
