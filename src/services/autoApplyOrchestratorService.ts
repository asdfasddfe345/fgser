import { supabase } from '../lib/supabaseClient';
import { resumeAnalysisService } from './resumeAnalysisService';
import {
  aiProjectSuggestionService,
  ProjectSuggestion,
} from './aiProjectSuggestionService';
import jsPDF from 'jspdf';

export interface AutoApplyStatus {
  step: 'analyzing' | 'suggesting_projects' | 'optimizing' | 'generating_pdf' | 'submitting' | 'completed' | 'failed';
  progress: number;
  message: string;
  currentAction?: string;
}

export interface AutoApplyResult {
  success: boolean;
  applicationId?: string;
  resumeId?: string;
  matchScore?: number;
  error?: string;
  pdfUrl?: string;
}

class AutoApplyOrchestratorService {
  private statusCallbacks: Map<string, (status: AutoApplyStatus) => void> = new Map();

  registerStatusCallback(jobId: string, callback: (status: AutoApplyStatus) => void) {
    this.statusCallbacks.set(jobId, callback);
  }

  unregisterStatusCallback(jobId: string) {
    this.statusCallbacks.delete(jobId);
  }

  private updateStatus(jobId: string, status: AutoApplyStatus) {
    const callback = this.statusCallbacks.get(jobId);
    if (callback) {
      callback(status);
    }
  }

  async startAutoApply(
    jobId: string,
    jobDescription: string,
    companyName: string,
    roleTitle: string,
    applicationUrl: string
  ): Promise<AutoApplyResult> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const userId = user.id;

      this.updateStatus(jobId, {
        step: 'analyzing',
        progress: 10,
        message: 'Analyzing your resume against job requirements...',
        currentAction: 'Calculating match score',
      });

      const userResume = await this.getUserResume(userId);
      if (!userResume) {
        throw new Error('Please upload your resume first');
      }

      const analysisResult = await resumeAnalysisService.analyzeResume(
        userResume,
        jobDescription
      );

      const matchScore = analysisResult.overallScore || 0;

      if (matchScore < 80) {
        this.updateStatus(jobId, {
          step: 'suggesting_projects',
          progress: 30,
          message: `Match score: ${matchScore}%. Generating AI project suggestions...`,
          currentAction: 'Creating personalized projects',
        });

        const projectSuggestions = await aiProjectSuggestionService.generateProjectSuggestions(
          jobDescription,
          userResume,
          matchScore
        );

        return {
          success: false,
          matchScore,
          error: 'PROJECT_SUGGESTIONS_REQUIRED',
          ...projectSuggestions,
        } as any;
      }

      return await this.continueAutoApply(
        userId,
        jobId,
        userResume,
        matchScore,
        applicationUrl,
        companyName,
        roleTitle,
        null
      );
    } catch (error: any) {
      console.error('Error in auto-apply:', error);
      this.updateStatus(jobId, {
        step: 'failed',
        progress: 0,
        message: 'Application failed',
        currentAction: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async continueAutoApply(
    userId: string,
    jobId: string,
    resumeText: string,
    matchScore: number,
    applicationUrl: string,
    companyName: string,
    roleTitle: string,
    selectedProject: ProjectSuggestion | null
  ): Promise<AutoApplyResult> {
    try {
      let finalResumeText = resumeText;

      if (selectedProject) {
        this.updateStatus(jobId, {
          step: 'optimizing',
          progress: 50,
          message: 'Injecting selected project into resume...',
          currentAction: 'Optimizing resume structure',
        });

        finalResumeText = aiProjectSuggestionService.injectProjectIntoResume(
          resumeText,
          selectedProject,
          selectedProject.selectionType || 'add'
        );
      }

      this.updateStatus(jobId, {
        step: 'generating_pdf',
        progress: 70,
        message: 'Generating optimized resume PDF...',
        currentAction: 'Creating PDF document',
      });

      const pdfBlob = await this.generateResumePDF(finalResumeText, roleTitle);
      const pdfUrl = await this.uploadResumePDF(userId, jobId, pdfBlob);

      const resumeId = await this.saveOptimizedResume(
        userId,
        jobId,
        resumeText,
        finalResumeText,
        matchScore,
        pdfUrl
      );

      if (selectedProject) {
        await aiProjectSuggestionService.saveProjectSuggestions(
          userId,
          jobId,
          resumeId,
          [selectedProject]
        );
      }

      this.updateStatus(jobId, {
        step: 'submitting',
        progress: 85,
        message: 'Submitting application...',
        currentAction: 'Filling out application form',
      });

      const platform = this.detectPlatform(applicationUrl);

      const applicationId = await this.createApplication(
        userId,
        jobId,
        resumeId,
        platform,
        applicationUrl
      );

      await this.triggerFormSubmission(
        applicationId,
        userId,
        applicationUrl,
        pdfUrl,
        platform
      );

      this.updateStatus(jobId, {
        step: 'completed',
        progress: 100,
        message: 'Application submitted successfully!',
        currentAction: 'Done',
      });

      return {
        success: true,
        applicationId,
        resumeId,
        matchScore,
        pdfUrl,
      };
    } catch (error: any) {
      console.error('Error continuing auto-apply:', error);
      this.updateStatus(jobId, {
        step: 'failed',
        progress: 0,
        message: 'Application failed',
        currentAction: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  private async getUserResume(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('resume_text')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.resume_text || '';
  }

  private async generateResumePDF(resumeText: string, jobTitle: string): Promise<Blob> {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('Resume', margin, 20);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(`Application for: ${jobTitle}`, margin, 30);

    let yPosition = 45;
    const lines = pdf.splitTextToSize(resumeText, maxWidth);

    lines.forEach((line: string) => {
      if (yPosition > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 7;
    });

    return pdf.output('blob');
  }

  private async uploadResumePDF(
    userId: string,
    jobId: string,
    pdfBlob: Blob
  ): Promise<string> {
    const fileName = `${userId}/${jobId}_${Date.now()}.pdf`;

    const { data, error } = await supabase.storage
      .from('optimized-resumes')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from('optimized-resumes').getPublicUrl(data.path);

    return publicUrl;
  }

  private async saveOptimizedResume(
    userId: string,
    jobListingId: string,
    originalText: string,
    optimizedText: string,
    matchScore: number,
    pdfUrl: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('optimized_resumes')
      .insert({
        user_id: userId,
        job_listing_id: jobListingId,
        original_resume_text: originalText,
        optimized_resume_text: optimizedText,
        match_score: matchScore,
        pdf_url: pdfUrl,
        improvements_made: [],
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private detectPlatform(url: string): string {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) return 'linkedin';
    if (lowerUrl.includes('workday.com')) return 'workday';
    if (lowerUrl.includes('greenhouse.io')) return 'greenhouse';
    if (lowerUrl.includes('lever.co')) return 'lever';
    if (lowerUrl.includes('myworkdayjobs.com')) return 'workday';
    return 'other';
  }

  private async createApplication(
    userId: string,
    jobListingId: string,
    resumeVersionId: string,
    platform: string,
    applicationUrl: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .insert({
        user_id: userId,
        job_listing_id: jobListingId,
        resume_version_id: resumeVersionId,
        platform,
        application_url: applicationUrl,
        status: 'filling',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private async triggerFormSubmission(
    applicationId: string,
    userId: string,
    applicationUrl: string,
    resumePdfUrl: string,
    platform: string
  ): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/auto-apply-submit`;

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        applicationId,
        userId,
        applicationUrl,
        resumePdfUrl,
        platform,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Form submission failed: ${error}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Form submission failed');
    }
  }

  async getApplicationStatus(applicationId: string): Promise<any> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error) throw error;
    return data;
  }

  async getUserApplications(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .select(`
        *,
        job_listings (
          id,
          company_name,
          role_title,
          company_logo_url
        ),
        optimized_resumes (
          match_score,
          pdf_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export const autoApplyOrchestratorService = new AutoApplyOrchestratorService();
