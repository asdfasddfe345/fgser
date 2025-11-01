import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { supabase } from '../lib/supabaseClient';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedProject {
  name: string;
  description: string;
  technologies: string[];
  role?: string;
  duration?: string;
  achievements?: string[];
}

export interface ParsedResume {
  rawText: string;
  projects: ParsedProject[];
  skills: string[];
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead' | 'unknown';
  education?: string[];
  workExperience?: string[];
  totalYearsOfExperience?: number;
}

export interface ResumeUploadResult {
  resumeId: string;
  parsedData: ParsedResume;
  success: boolean;
  error?: string;
}

class ResumeParsingAdvancedService {
  async uploadAndParseResume(file: File, userId: string): Promise<ResumeUploadResult> {
    try {
      const rawText = await this.extractTextFromFile(file);
      const parsedData = await this.parseResumeContent(rawText);

      const { data: resumeData, error } = await supabase
        .from('interview_resumes')
        .insert({
          user_id: userId,
          original_filename: file.name,
          raw_text: rawText,
          parsed_data: parsedData,
          projects_extracted: parsedData.projects,
          skills: parsedData.skills,
          experience_level: parsedData.experienceLevel
        })
        .select()
        .single();

      if (error) throw error;

      return {
        resumeId: resumeData.id,
        parsedData,
        success: true
      };
    } catch (error) {
      console.error('Resume parsing error:', error);
      return {
        resumeId: '',
        parsedData: {
          rawText: '',
          projects: [],
          skills: [],
          experienceLevel: 'unknown'
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type;

    if (fileType === 'application/pdf') {
      return this.extractTextFromPDF(file);
    } else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword'
    ) {
      return this.extractTextFromWord(file);
    } else if (fileType === 'text/plain') {
      return this.extractTextFromPlain(file);
    } else {
      throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT file.');
    }
  }

  private async extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }

  private async extractTextFromWord(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractTextFromPlain(file: File): Promise<string> {
    return await file.text();
  }

  private async parseResumeContent(text: string): Promise<ParsedResume> {
    const projects = this.extractProjects(text);
    const skills = this.extractSkills(text);
    const experienceLevel = this.determineExperienceLevel(text);
    const education = this.extractEducation(text);
    const workExperience = this.extractWorkExperience(text);
    const totalYearsOfExperience = this.calculateYearsOfExperience(text);

    return {
      rawText: text,
      projects,
      skills,
      experienceLevel,
      education,
      workExperience,
      totalYearsOfExperience
    };
  }

  private extractProjects(text: string): ParsedProject[] {
    const projects: ParsedProject[] = [];
    const projectSectionRegex = /(?:projects?|personal projects?|academic projects?|portfolio)[:\s]*([\s\S]*?)(?=(?:experience|education|skills|certifications|$))/gi;
    const matches = text.match(projectSectionRegex);

    if (matches) {
      matches.forEach(section => {
        const projectBlocks = section.split(/\n\s*\n/);

        projectBlocks.forEach(block => {
          const lines = block.split('\n').filter(line => line.trim());
          if (lines.length === 0) return;

          const nameMatch = lines[0].match(/^[•\-\*]?\s*(.+?)(?:\s*[\|\-]\s*(.+))?$/);
          const name = nameMatch ? nameMatch[1].trim() : lines[0].trim();

          const technologies = this.extractTechnologiesFromBlock(block);
          const description = this.extractDescriptionFromBlock(block);
          const achievements = this.extractAchievementsFromBlock(block);

          if (name && (technologies.length > 0 || description)) {
            projects.push({
              name,
              description: description || '',
              technologies,
              achievements
            });
          }
        });
      });
    }

    const fallbackProjects = this.extractProjectsUsingPatterns(text);
    fallbackProjects.forEach(proj => {
      if (!projects.some(p => p.name.toLowerCase() === proj.name.toLowerCase())) {
        projects.push(proj);
      }
    });

    return projects;
  }

  private extractProjectsUsingPatterns(text: string): ParsedProject[] {
    const projects: ParsedProject[] = [];
    const lines = text.split('\n');
    const techKeywords = ['react', 'node', 'python', 'java', 'angular', 'vue', 'django', 'flask', 'spring', 'mongodb', 'sql', 'aws', 'docker', 'kubernetes'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextFewLines = lines.slice(i, i + 5).join(' ').toLowerCase();

      const hasTechKeyword = techKeywords.some(keyword => nextFewLines.includes(keyword));
      const looksLikeProjectTitle = /^[•\-\*]?\s*[A-Z][a-zA-Z\s]{3,50}(?:\s*[\|\-]|$)/.test(line);

      if (looksLikeProjectTitle && hasTechKeyword && line.length > 5 && line.length < 100) {
        const blockText = lines.slice(i, i + 8).join(' ');
        const technologies = this.extractTechnologiesFromBlock(blockText);

        if (technologies.length > 0) {
          projects.push({
            name: line.replace(/^[•\-\*]\s*/, ''),
            description: this.extractDescriptionFromBlock(blockText) || '',
            technologies
          });
        }
      }
    }

    return projects;
  }

  private extractTechnologiesFromBlock(block: string): string[] {
    const techPatterns = [
      /(?:technologies?|tech stack|tools?|built with|using)[:\s]*(.*?)(?:\n|$)/gi,
      /\((.*?)\)/g
    ];

    const technologies = new Set<string>();
    const commonTechs = [
      'react', 'angular', 'vue', 'svelte', 'node.js', 'express', 'django', 'flask', 'spring boot',
      'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'rust', 'kotlin', 'swift',
      'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git',
      'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy',
      'graphql', 'rest api', 'websocket', 'microservices'
    ];

    techPatterns.forEach(pattern => {
      const matches = block.matchAll(pattern);
      for (const match of matches) {
        const techText = match[1]?.toLowerCase() || '';
        commonTechs.forEach(tech => {
          if (techText.includes(tech.toLowerCase())) {
            technologies.add(tech);
          }
        });
      }
    });

    const blockLower = block.toLowerCase();
    commonTechs.forEach(tech => {
      if (blockLower.includes(tech.toLowerCase())) {
        technologies.add(tech);
      }
    });

    return Array.from(technologies);
  }

  private extractDescriptionFromBlock(block: string): string {
    const lines = block.split('\n').filter(line => line.trim());
    const descLines = lines.filter(line => {
      const l = line.trim();
      return l.length > 20 &&
             !l.match(/^(?:technologies?|tech stack|tools?|duration|role)[:\s]/i) &&
             !l.match(/^\(.*\)$/);
    });

    return descLines.slice(0, 3).join(' ').trim();
  }

  private extractAchievementsFromBlock(block: string): string[] {
    const achievements: string[] = [];
    const lines = block.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.match(/^[•\-\*]\s*.{20,}/)) {
        achievements.push(trimmed.replace(/^[•\-\*]\s*/, ''));
      }
    });

    return achievements;
  }

  private extractSkills(text: string): string[] {
    const skillsSection = text.match(/(?:skills?|technical skills?|core competencies)[:\s]*([\s\S]*?)(?=(?:experience|education|projects|certifications|$))/gi);
    const skills = new Set<string>();

    if (skillsSection) {
      const allSkills = [
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
        'react', 'angular', 'vue', 'svelte', 'next.js', 'nuxt.js',
        'node.js', 'express', 'django', 'flask', 'spring boot', 'asp.net',
        'mongodb', 'postgresql', 'mysql', 'redis', 'dynamodb', 'cassandra',
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
        'git', 'ci/cd', 'jenkins', 'github actions',
        'machine learning', 'deep learning', 'nlp', 'computer vision',
        'tensorflow', 'pytorch', 'scikit-learn',
        'html', 'css', 'sass', 'tailwind',
        'rest api', 'graphql', 'grpc', 'websocket',
        'agile', 'scrum', 'tdd', 'microservices'
      ];

      const sectionText = skillsSection[0].toLowerCase();
      allSkills.forEach(skill => {
        if (sectionText.includes(skill.toLowerCase())) {
          skills.add(skill);
        }
      });
    }

    const textLower = text.toLowerCase();
    ['react', 'python', 'java', 'node.js', 'aws', 'docker'].forEach(popularSkill => {
      if (textLower.includes(popularSkill)) {
        skills.add(popularSkill);
      }
    });

    return Array.from(skills);
  }

  private extractEducation(text: string): string[] {
    const educationSection = text.match(/(?:education|academic background)[:\s]*([\s\S]*?)(?=(?:experience|projects|skills|certifications|$))/gi);

    if (educationSection) {
      return educationSection[0]
        .split('\n')
        .filter(line => line.trim().length > 10)
        .map(line => line.trim())
        .slice(0, 5);
    }

    return [];
  }

  private extractWorkExperience(text: string): string[] {
    const experienceSection = text.match(/(?:work experience|professional experience|employment history)[:\s]*([\s\S]*?)(?=(?:education|projects|skills|certifications|$))/gi);

    if (experienceSection) {
      return experienceSection[0]
        .split('\n\n')
        .filter(block => block.trim().length > 20)
        .map(block => block.trim())
        .slice(0, 5);
    }

    return [];
  }

  private determineExperienceLevel(text: string): 'junior' | 'mid' | 'senior' | 'lead' | 'unknown' {
    const years = this.calculateYearsOfExperience(text);

    if (years === null) {
      const textLower = text.toLowerCase();
      if (textLower.includes('senior') || textLower.includes('lead') || textLower.includes('architect')) {
        return 'senior';
      } else if (textLower.includes('junior') || textLower.includes('intern') || textLower.includes('fresher')) {
        return 'junior';
      }
      return 'unknown';
    }

    if (years < 2) return 'junior';
    if (years < 5) return 'mid';
    if (years < 8) return 'senior';
    return 'lead';
  }

  private calculateYearsOfExperience(text: string): number | null {
    const patterns = [
      /(\d+)\+?\s*years?\s*of\s*experience/i,
      /experience[:\s]*(\d+)\+?\s*years?/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    const datePattern = /(\d{4})\s*-\s*(?:(\d{4})|present|current)/gi;
    const dateMatches = Array.from(text.matchAll(datePattern));

    if (dateMatches.length > 0) {
      let totalYears = 0;
      dateMatches.forEach(match => {
        const startYear = parseInt(match[1], 10);
        const endYear = match[2] ? parseInt(match[2], 10) : new Date().getFullYear();
        totalYears += (endYear - startYear);
      });
      return Math.max(0, totalYears);
    }

    return null;
  }

  async getResumeById(resumeId: string, userId: string) {
    const { data, error } = await supabase
      .from('interview_resumes')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async getUserResumes(userId: string) {
    const { data, error } = await supabase
      .from('interview_resumes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export const resumeParsingAdvancedService = new ResumeParsingAdvancedService();
