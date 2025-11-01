import { supabase } from '../lib/supabaseClient';
import { resumeParsingService } from './resumeParsingService';
import { geminiService } from './geminiServiceWrapper';
import {
  UserResume,
  ResumeAnalysisRequest,
  ResumeAnalysisResponse,
  ParsedResumeData,
  ExperienceLevel,
  ResumeAnalysisMetadata
} from '../types/resumeInterview';

class ResumeAnalysisService {
  async uploadAndAnalyzeResume(
    file: File,
    userId: string
  ): Promise<UserResume> {
    const validation = resumeParsingService.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid file');
    }

    // Sanitize filename to avoid Supabase Storage "Invalid key" (non-ASCII or reserved chars)
    const sanitizeFilename = (name: string): string => {
      // Keep base and extension separate
      const lastDot = name.lastIndexOf('.');
      const base = (lastDot > 0 ? name.slice(0, lastDot) : name)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacritics
        .replace(/[^A-Za-z0-9._-]+/g, '-') // replace non-ASCII/unsafe with '-'
        .replace(/-{2,}/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '');
      const ext = (lastDot > 0 ? name.slice(lastDot + 1) : '')
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, 10);
      const safe = (ext ? `${base}.${ext}` : base) || `resume_${Date.now()}.pdf`;
      // Limit overall length to be safe for URLs
      return safe.slice(0, 120);
    };

    const safeFileName = sanitizeFilename(file.name);
    const filePath = `${userId}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-resumes')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload resume: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('user-resumes')
      .getPublicUrl(filePath);

    const parsedResume = await resumeParsingService.parseResume(file);

    if (parsedResume.hasError) {
      throw new Error(parsedResume.errorMessage || 'Failed to parse resume');
    }

    const { data: resumeRecord, error: insertError } = await supabase
      .from('user_resumes')
      .insert({
        user_id: userId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        parsed_text: parsedResume.text,
        parsed_data: {},
        skills_detected: parsedResume.skills,
        analysis_completed: false,
        is_primary: false
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save resume: ${insertError.message}`);
    }

    this.analyzeResumeInBackground(resumeRecord.id, parsedResume.text, userId);

    return resumeRecord;
  }

  private async analyzeResumeInBackground(
    resumeId: string,
    resumeText: string,
    userId: string
  ): Promise<void> {
    try {
      const analysis = await this.performDeepAnalysis(resumeText);

      await supabase
        .from('user_resumes')
        .update({
          parsed_data: analysis.parsed_data,
          skills_detected: analysis.skills_detected,
          experience_level: analysis.experience_level,
          years_of_experience: analysis.years_of_experience,
          domains: analysis.domains,
          analysis_metadata: analysis.analysis_metadata,
          analysis_completed: true
        })
        .eq('id', resumeId);
    } catch (error) {
      console.error('Background analysis failed:', error);
    }
  }

  async performDeepAnalysis(resumeText: string): Promise<ResumeAnalysisResponse> {
    const prompt = `Analyze this resume and extract structured information. Return a valid JSON object with the following structure:

{
  "parsed_data": {
    "name": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "summary": "string or null",
    "education": [{"degree": "string", "institution": "string", "year": "string", "gpa": "string", "location": "string"}],
    "work_experience": [{"title": "string", "company": "string", "duration": "string", "location": "string", "responsibilities": ["string"], "technologies": ["string"]}],
    "projects": [{"name": "string", "description": "string", "technologies": ["string"], "url": "string", "highlights": ["string"]}],
    "skills": [{"category": "string", "skills": ["string"]}],
    "certifications": ["string"],
    "achievements": ["string"]
  },
  "skills_detected": ["string"],
  "experience_level": "entry|junior|mid|senior|lead|executive",
  "years_of_experience": number,
  "domains": ["string"],
  "analysis_metadata": {
    "total_skills_count": number,
    "technical_skills_count": number,
    "soft_skills_count": number,
    "projects_count": number,
    "work_experiences_count": number,
    "education_count": number,
    "confidence_score": number (0-1),
    "analysis_version": "1.0",
    "analyzed_at": "ISO timestamp"
  }
}

Resume Text:
${resumeText}

IMPORTANT: Return ONLY the JSON object, no additional text or explanation.`;

    try {
      const response = await geminiService.generateText(prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleaned);

      return {
        parsed_data: analysis.parsed_data || this.getDefaultParsedData(),
        skills_detected: analysis.skills_detected || [],
        experience_level: analysis.experience_level || 'junior',
        years_of_experience: analysis.years_of_experience || 0,
        domains: analysis.domains || [],
        analysis_metadata: analysis.analysis_metadata || this.getDefaultMetadata()
      };
    } catch (error) {
      console.error('AI analysis failed, using fallback:', error);
      return this.getFallbackAnalysis(resumeText);
    }
  }

  private getDefaultParsedData(): ParsedResumeData {
    return {
      education: [],
      work_experience: [],
      projects: [],
      skills: [],
      certifications: [],
      achievements: []
    };
  }

  private getDefaultMetadata(): ResumeAnalysisMetadata {
    return {
      total_skills_count: 0,
      technical_skills_count: 0,
      soft_skills_count: 0,
      projects_count: 0,
      work_experiences_count: 0,
      education_count: 0,
      confidence_score: 0,
      analysis_version: '1.0',
      analyzed_at: new Date().toISOString()
    };
  }

  private getFallbackAnalysis(resumeText: string): ResumeAnalysisResponse {
    const commonSkills = [
      'JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'Java',
      'SQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Git'
    ];

    const detectedSkills = commonSkills.filter(skill =>
      resumeText.toLowerCase().includes(skill.toLowerCase())
    );

    const yearsMatch = resumeText.match(/(\d+)\+?\s*years?/i);
    const years = yearsMatch ? parseInt(yearsMatch[1]) : 1;

    let level: ExperienceLevel = 'junior';
    if (years >= 7) level = 'senior';
    else if (years >= 4) level = 'mid';
    else if (years >= 2) level = 'junior';
    else level = 'entry';

    return {
      parsed_data: this.getDefaultParsedData(),
      skills_detected: detectedSkills,
      experience_level: level,
      years_of_experience: years,
      domains: this.detectDomains(resumeText),
      analysis_metadata: {
        ...this.getDefaultMetadata(),
        total_skills_count: detectedSkills.length,
        technical_skills_count: detectedSkills.length,
        confidence_score: 0.5
      }
    };
  }

  private detectDomains(text: string): string[] {
    const domains = [
      'Frontend Development',
      'Backend Development',
      'Full Stack Development',
      'Mobile Development',
      'Data Science',
      'Machine Learning',
      'DevOps',
      'Cloud Engineering'
    ];

    return domains.filter(domain =>
      text.toLowerCase().includes(domain.toLowerCase())
    );
  }

  async getUserResumes(userId: string): Promise<UserResume[]> {
    const { data, error } = await supabase
      .from('user_resumes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch resumes: ${error.message}`);
    }

    return data || [];
  }

  async getPrimaryResume(userId: string): Promise<UserResume | null> {
    const { data, error } = await supabase
      .from('user_resumes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch primary resume: ${error.message}`);
    }

    return data;
  }

  async getResumeById(resumeId: string): Promise<UserResume | null> {
    const { data, error } = await supabase
      .from('user_resumes')
      .select('*')
      .eq('id', resumeId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch resume: ${error.message}`);
    }

    return data;
  }

  async setPrimaryResume(resumeId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_resumes')
      .update({ is_primary: true })
      .eq('id', resumeId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to set primary resume: ${error.message}`);
    }
  }

  async deleteResume(resumeId: string, userId: string): Promise<void> {
    const resume = await this.getResumeById(resumeId);

    if (!resume || resume.user_id !== userId) {
      throw new Error('Resume not found or unauthorized');
    }

    const filePath = resume.file_url.split('/user-resumes/')[1];

    if (filePath) {
      await supabase.storage
        .from('user-resumes')
        .remove([filePath]);
    }

    const { error } = await supabase
      .from('user_resumes')
      .delete()
      .eq('id', resumeId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete resume: ${error.message}`);
    }
  }

  async waitForAnalysis(resumeId: string, maxWaitSeconds: number = 30): Promise<UserResume> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      const resume = await this.getResumeById(resumeId);

      if (resume?.analysis_completed) {
        return resume;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const resume = await this.getResumeById(resumeId);
    if (!resume) {
      throw new Error('Resume not found');
    }

    return resume;
  }
}

export const resumeAnalysisService = new ResumeAnalysisService();
