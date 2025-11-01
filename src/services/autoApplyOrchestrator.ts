// src/services/autoApplyOrchestrator.ts
import { profileResumeService } from '../services/profileResumeService';
import { jobsService } from '../services/jobsService';
import { optimizeResume } from '../services/geminiService';
import { analyzeProjectSuitability } from '../services/projectAnalysisService';
import { exportToPDF } from '../utils/exportUtils';
import { supabase } from '../lib/supabaseClient';
import { ResumeData, UserType } from '../types/resume';
import { JobListing, AutoApplyResult } from '../types/jobs';

interface AutoApplyRequest {
  jobId: string;
  userType: UserType;
  userId: string;
}

interface AutoApplyResponse {
  success: boolean;
  message: string;
  optimizedResumeId?: string;
  applicationResult?: AutoApplyResult;
  error?: string;
}

class AutoApplyOrchestrator {
  async initiateAutoApply(request: AutoApplyRequest): Promise<AutoApplyResponse> {
    const { jobId, userType, userId } = request;

    try {
      console.log('AutoApplyOrchestrator: Starting auto-apply process for job:', jobId);

      // Step 1: Validate user profile completeness
      const profileValidation = await profileResumeService.isProfileCompleteForAutoApply(userId);
      if (!profileValidation.isComplete) {
        throw new Error(`Profile incomplete. Missing: ${profileValidation.missingFields.join(', ')}`);
      }

      // Step 2: Fetch job details
      const jobListing = await jobsService.getJobListingById(jobId);
      if (!jobListing) {
        throw new Error('Job listing not found');
      }

      console.log('AutoApplyOrchestrator: Job listing fetched:', jobListing.role_title);

      // Step 3: Build base resume from user profile
      const baseResumeData = await profileResumeService.buildResumeDataFromProfile(userId, userType);
      console.log('AutoApplyOrchestrator: Base resume data constructed from profile');

      // Step 4: Set target role from job
      baseResumeData.targetRole = jobListing.role_title;

      // Step 5: Analyze and enhance projects based on job description
      let enhancedResumeData = baseResumeData;
      
      if (jobListing.full_description && baseResumeData.projects.length > 0) {
        try {
          console.log('AutoApplyOrchestrator: Analyzing project suitability...');
          const projectAnalysis = await analyzeProjectSuitability(
            baseResumeData,
            jobListing.full_description,
            jobListing.role_title
          );

          // Apply project recommendations if any projects need replacement
          if (projectAnalysis.projectAnalysis.some(p => !p.suitable)) {
            const suitableProjects = projectAnalysis.projectAnalysis
              .filter(p => p.suitable)
              .map(p => baseResumeData.projects.find(proj => proj.title === p.title))
              .filter(Boolean) as Project[];

            const replacementProjects = projectAnalysis.projectAnalysis
              .filter(p => !p.suitable && p.replacementSuggestion)
              .map(p => ({
                title: p.replacementSuggestion!.title,
                bullets: p.replacementSuggestion!.bulletPoints,
                githubUrl: p.replacementSuggestion!.githubUrl
              }));

            enhancedResumeData = {
              ...baseResumeData,
              projects: [...suitableProjects, ...replacementProjects].slice(0, 4) // Limit to 4 projects
            };

            console.log('AutoApplyOrchestrator: Projects enhanced based on job requirements');
          }
        } catch (projectError) {
          console.warn('AutoApplyOrchestrator: Project analysis failed, using original projects:', projectError);
          // Continue with original projects if analysis fails
        }
      }

      // Step 6: Perform AI optimization with job description
      console.log('AutoApplyOrchestrator: Starting AI optimization...');
      const optimizedResumeData = await optimizeResume(
        this.resumeDataToText(enhancedResumeData),
        jobListing.full_description,
        userType,
        enhancedResumeData.name,
        enhancedResumeData.email,
        enhancedResumeData.phone,
        enhancedResumeData.linkedin,
        enhancedResumeData.github,
        undefined,
        undefined,
        jobListing.role_title
      );

      // Ensure optimized resume has the target role set
      optimizedResumeData.targetRole = jobListing.role_title;
      optimizedResumeData.origin = 'auto_apply_optimized';

      console.log('AutoApplyOrchestrator: AI optimization completed');

      // Step 7: Store optimized resume and generate files
      const optimizedResumeId = await jobsService.storeOptimizedResume(
        userId,
        jobId,
        optimizedResumeData
      );

      console.log('AutoApplyOrchestrator: Optimized resume stored with ID:', optimizedResumeId);

      // Step 8: Trigger server-side auto-apply
      const applicationResult = await jobsService.autoApplyForJob(jobId, optimizedResumeId);

      console.log('AutoApplyOrchestrator: Auto-apply process completed:', applicationResult.success);

      return {
        success: true,
        message: 'Auto-apply process completed successfully',
        optimizedResumeId,
        applicationResult
      };

    } catch (error) {
      console.error('AutoApplyOrchestrator: Error in auto-apply process:', error);
      return {
        success: false,
        message: 'Auto-apply process failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper method to convert ResumeData back to text format for AI processing
  private resumeDataToText(resumeData: ResumeData): string {
    const sections = [];

    sections.push(`Name: ${resumeData.name}`);
    if (resumeData.phone) sections.push(`Phone: ${resumeData.phone}`);
    if (resumeData.email) sections.push(`Email: ${resumeData.email}`);
    if (resumeData.linkedin) sections.push(`LinkedIn: ${resumeData.linkedin}`);
    if (resumeData.github) sections.push(`GitHub: ${resumeData.github}`);
    if (resumeData.location) sections.push(`Location: ${resumeData.location}`);

    if (resumeData.summary) {
      sections.push(`\nPROFESSIONAL SUMMARY:\n${resumeData.summary}`);
    } else if (resumeData.careerObjective) {
      sections.push(`\nCAREER OBJECTIVE:\n${resumeData.careerObjective}`);
    }

    if (resumeData.education && resumeData.education.length > 0) {
      sections.push('\nEDUCATION:');
      resumeData.education.forEach((edu: Education) => {
        sections.push(`${edu.degree} from ${edu.school} (${edu.year})`);
        if (edu.cgpa) sections.push(`CGPA: ${edu.cgpa}`);
      });
    }

    if (resumeData.workExperience && resumeData.workExperience.length > 0) {
      sections.push('\nWORK EXPERIENCE:');
      resumeData.workExperience.forEach((job: WorkExperience) => {
        sections.push(`${job.role} at ${job.company} (${job.year})`);
        if (job.bullets) {
          job.bullets.forEach((bullet: string) => sections.push(`• ${bullet}`));
        }
      });
    }

    if (resumeData.projects && resumeData.projects.length > 0) {
      sections.push('\nPROJECTS:');
      resumeData.projects.forEach((project: Project) => {
        sections.push(`${project.title}`);
        if (project.bullets) {
          project.bullets.forEach((bullet: string) => sections.push(`• ${bullet}`));
        }
      });
    }

    if (resumeData.skills && resumeData.skills.length > 0) {
      sections.push('\nSKILLS:');
      resumeData.skills.forEach((skill: Skill) => {
        sections.push(`${skill.category}: ${skill.list ? skill.list.join(', ') : ''}`);
      });
    }

    if (resumeData.certifications && resumeData.certifications.length > 0) {
      sections.push('\nCERTIFICATIONS:');
      resumeData.certifications.forEach((cert: string | Certification) => {
        if (typeof cert === 'string') {
          sections.push(`• ${cert}`);
        } else {
          sections.push(`• ${cert.title}${cert.description ? `: ${cert.description}` : ''}`);
        }
      });
    }

    if (resumeData.achievements && resumeData.achievements.length > 0) {
      sections.push('\nACHIEVEMENTS:');
      resumeData.achievements.forEach((achievement: string) => sections.push(`• ${achievement}`));
    }

    return sections.join('\n');
  }

  // Method to determine user type from profile data
  async getUserTypeFromProfile(userId: string): Promise<UserType> {
    const { data: profileData, error } = await supabase
      .from('user_profiles')
      .select('experience_details, education_details, program_start_date')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profileData) {
      return 'fresher'; // Default fallback
    }

    // Check if user has work experience
    const hasWorkExperience = profileData.experience_details && 
      Array.isArray(profileData.experience_details) && 
      profileData.experience_details.length > 0;

    // Check if user is currently in a program (student)
    const isCurrentStudent = profileData.program_start_date && 
      new Date(profileData.program_start_date) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Within last year

    if (isCurrentStudent) {
      return 'student';
    } else if (hasWorkExperience) {
      return 'experienced';
    } else {
      return 'fresher';
    }
  }
}

export const autoApplyOrchestrator = new AutoApplyOrchestrator();
