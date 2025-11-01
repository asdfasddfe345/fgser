export type InterviewType = 'general' | 'company-based';
export type InterviewCategory = 'technical' | 'hr' | 'behavioral' | 'mixed';
export type QuestionCategory = 'HR' | 'Technical' | 'Behavioral' | 'Coding' | 'Projects' | 'Aptitude';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned' | 'paused';

export interface InterviewQuestion {
  id: string;
  question_text: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  interview_type: 'general' | 'company-specific';
  company_name?: string;
  role?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockInterviewSession {
  id: string;
  user_id: string;
  session_type: InterviewType;
  interview_category: InterviewCategory;
  company_name?: string;
  target_role?: string;
  domain?: string;
  duration_minutes: number;
  actual_duration_seconds?: number;
  overall_score?: number;
  status: SessionStatus;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  tab_switches_count?: number;
  fullscreen_exits_count?: number;
  total_violation_time?: number;
  violations_log?: Array<{
    type: string;
    timestamp: number;
    duration: number;
  }>;
  security_score?: number;
}

export interface InterviewResponse {
  id: string;
  session_id: string;
  question_id: string;
  question_order: number;
  user_answer_text?: string;
  audio_url?: string;
  video_url?: string;
  audio_transcript?: string;
  ai_feedback_json?: AIFeedback;
  individual_score?: number;
  tone_rating?: string;
  confidence_rating?: number;
  response_duration_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface AIFeedback {
  score: number;
  missed_points: string[];
  suggestions: string[];
  tone_confidence_rating: string;
  strengths?: string[];
  improvement_areas?: string[];
}

export interface InterviewConfig {
  sessionType: InterviewType;
  interviewCategory: InterviewCategory;
  companyName?: string;
  targetRole?: string;
  domain?: string;
  durationMinutes: number;
}

export interface InterviewSessionWithQuestions extends MockInterviewSession {
  questions: InterviewQuestion[];
  responses: InterviewResponse[];
}

export interface InterviewSummary {
  sessionId: string;
  overallScore: number;
  totalQuestions: number;
  answeredQuestions: number;
  averageScore: number;
  totalDuration: string;
  strengths: string[];
  improvementAreas: string[];
  detailedFeedback: {
    question: string;
    userAnswer: string;
    score: number;
    feedback: AIFeedback;
  }[];
}

export interface CompanyOption {
  name: string;
  roles: string[];
  categories: QuestionCategory[];
}

export const POPULAR_COMPANIES: CompanyOption[] = [
  {
    name: 'Google',
    roles: ['SWE L3', 'SWE L4', 'SRE', 'Data Engineer'],
    categories: ['Technical', 'Coding', 'Behavioral']
  },
  {
    name: 'Amazon',
    roles: ['SDE 1', 'SDE 2', 'Solutions Architect'],
    categories: ['Technical', 'Coding', 'Behavioral']
  },
  {
    name: 'Microsoft',
    roles: ['SWE', 'Senior SWE', 'Program Manager'],
    categories: ['Technical', 'Coding', 'HR']
  },
  {
    name: 'Meta',
    roles: ['E3', 'E4', 'E5'],
    categories: ['Technical', 'Coding', 'Behavioral']
  },
  {
    name: 'Apple',
    roles: ['ICT2', 'ICT3', 'Software Engineer'],
    categories: ['Technical', 'Coding', 'Behavioral']
  },
  {
    name: 'Netflix',
    roles: ['Senior Software Engineer', 'Staff Engineer'],
    categories: ['Technical', 'Coding', 'Behavioral']
  },
  {
    name: 'Infosys',
    roles: ['Systems Engineer', 'Senior Systems Engineer', 'Technology Lead'],
    categories: ['Technical', 'HR', 'Aptitude']
  },
  {
    name: 'TCS',
    roles: ['Assistant Systems Engineer', 'Systems Engineer', 'IT Analyst'],
    categories: ['Technical', 'HR', 'Aptitude']
  },
  {
    name: 'Wipro',
    roles: ['Project Engineer', 'Senior Project Engineer'],
    categories: ['Technical', 'HR', 'Aptitude']
  },
  {
    name: 'Cognizant',
    roles: ['Programmer Analyst', 'Associate', 'Senior Associate'],
    categories: ['Technical', 'HR', 'Aptitude']
  }
];

export const TECHNICAL_DOMAINS = [
  'Frontend Development',
  'Backend Development',
  'Full Stack Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning',
  'DevOps',
  'Cloud Engineering',
  'QA/Testing',
  'Database Administration',
  'Security Engineering',
  'Blockchain'
];

export const DURATION_OPTIONS = [10, 15, 20, 25, 30, 35, 40];
