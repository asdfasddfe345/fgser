export type UserType = 'fresher' | 'student' | 'experienced';

export type TemplateId = 'aurum' | 'nova' | 'slate' | 'vector' | 'scholar';

export type ColorMode = 'light' | 'dark' | 'auto';

export type DeploymentStatus = 'pending' | 'building' | 'success' | 'failed';

export interface PortfolioProfile {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface WorkExperience {
  role: string;
  company: string;
  duration: string;
  bullets: string[];
  location?: string;
}

export interface Project {
  title: string;
  description: string;
  techStack?: string[];
  bullets: string[];
  links?: {
    github?: string;
    demo?: string;
    other?: string;
  };
}

export interface Education {
  degree: string;
  institution: string;
  year: string;
  gpa?: string;
  location?: string;
  coursework?: string[];
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface Certification {
  title: string;
  issuer?: string;
  date?: string;
  url?: string;
}

export interface PortfolioData {
  id?: string;
  userId?: string;
  profile: PortfolioProfile;
  about?: string;
  userType: UserType;
  targetRole?: string;
  professionalSummary?: string;
  careerObjective?: string;
  experience: WorkExperience[];
  projects: Project[];
  education: Education[];
  skills: SkillCategory[];
  certifications: Certification[];
  achievements: string[];
  additionalSections?: AdditionalSection[];
  seo?: {
    title: string;
    description: string;
    keywords: string[];
  };
  originalResumeText?: string;
  jobDescriptionContext?: string;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdditionalSection {
  title: string;
  bullets: string[];
}

export interface PortfolioTemplate {
  id?: string;
  userId?: string;
  portfolioDataId?: string;
  templateId: TemplateId;
  accentColor: string;
  fontFamily: string;
  colorMode: ColorMode;
  visibleSections: {
    contact: boolean;
    about: boolean;
    summary: boolean;
    objective: boolean;
    skills: boolean;
    experience: boolean;
    projects: boolean;
    education: boolean;
    certifications: boolean;
    achievements: boolean;
    additionalSections: boolean;
  };
  sectionOrder: string[];
  customCss?: string;
  customFonts?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortfolioDeployment {
  id?: string;
  userId?: string;
  portfolioDataId?: string;
  netlifySiteId?: string;
  netlifyDeployId?: string;
  deploymentUrl: string;
  customDomain?: string;
  subdomain?: string;
  status: DeploymentStatus;
  buildLog?: string;
  errorMessage?: string;
  viewCount?: number;
  shareCount?: number;
  analyticsData?: Record<string, any>;
  deployedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  description: string;
  category: string;
  preview: string;
  defaultAccentColor: string;
  defaultFont: string;
  features: string[];
  bestFor: string[];
}

export const TEMPLATE_CONFIGS: Record<TemplateId, TemplateConfig> = {
  aurum: {
    id: 'aurum',
    name: 'Aurum',
    description: 'Minimal resume-first design with clean typography',
    category: 'Minimal',
    preview: '/templates/aurum-preview.png',
    defaultAccentColor: '#1F2937',
    defaultFont: 'Inter',
    features: ['Clean layout', 'Typography-focused', 'Professional'],
    bestFor: ['Backend Developers', 'Data Analysts', 'Researchers'],
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    description: 'Hero card layout with KPI counters and skill badges',
    category: 'Modern',
    preview: '/templates/nova-preview.png',
    defaultAccentColor: '#3B82F6',
    defaultFont: 'Inter',
    features: ['Hero section', 'Metrics display', 'Interactive badges'],
    bestFor: ['Frontend Developers', 'UI/UX Designers', 'Product Managers'],
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    description: 'Masonry projects grid with case-study detail pages',
    category: 'Creative',
    preview: '/templates/slate-preview.png',
    defaultAccentColor: '#8B5CF6',
    defaultFont: 'Poppins',
    features: ['Project showcase', 'Case studies', 'Visual portfolio'],
    bestFor: ['Designers', 'Full-stack Developers', 'Creative Professionals'],
  },
  vector: {
    id: 'vector',
    name: 'Vector',
    description: 'Neon dark theme with metric chips and timeline',
    category: 'Tech',
    preview: '/templates/vector-preview.png',
    defaultAccentColor: '#10B981',
    defaultFont: 'Roboto Mono',
    features: ['Dark mode', 'Neon accents', 'Timeline view'],
    bestFor: ['DevOps Engineers', 'Cloud Architects', 'System Administrators'],
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    description: 'Academic-focused layout with publications section',
    category: 'Academic',
    preview: '/templates/scholar-preview.png',
    defaultAccentColor: '#DC2626',
    defaultFont: 'Merriweather',
    features: ['Publications', 'Research focus', 'Citation-ready'],
    bestFor: ['Researchers', 'Data Scientists', 'ML Engineers'],
  },
};

export const DEFAULT_SECTION_ORDER = [
  'contact',
  'about',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'achievements',
];

export const DEFAULT_VISIBLE_SECTIONS = {
  contact: true,
  about: true,
  summary: true,
  objective: true,
  skills: true,
  experience: true,
  projects: true,
  education: true,
  certifications: true,
  achievements: true,
  additionalSections: true,
};

export interface PortfolioCreationParams {
  resumeText?: string;
  resumeFile?: File;
  linkedinPaste?: string;
  userType: UserType;
  targetRole?: string;
  profile?: Partial<PortfolioProfile>;
}

export interface PortfolioEnrichmentResult {
  portfolioData: PortfolioData;
  suggestions: {
    skills: string[];
    projects: string[];
    improvements: string[];
  };
}

export interface DeploymentOptions {
  subdomain?: string;
  customDomain?: string;
  enableAnalytics?: boolean;
}
