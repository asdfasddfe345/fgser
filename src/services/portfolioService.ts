import { supabase } from '../lib/supabaseClient';
import { agentRouterService } from './agentRouterService';
import {
  PortfolioData,
  PortfolioTemplate,
  PortfolioDeployment,
  UserType,
  TemplateId,
  PortfolioCreationParams,
  DeploymentOptions,
} from '../types/portfolio';

class PortfolioService {
  async createPortfolio(params: PortfolioCreationParams): Promise<{ portfolioId: string; data: PortfolioData }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let resumeText = params.resumeText || '';

    if (params.resumeFile) {
      resumeText = await this.extractTextFromFile(params.resumeFile);
    } else if (params.linkedinPaste) {
      resumeText = params.linkedinPaste;
    }

    if (!resumeText) {
      throw new Error('Please provide resume text, upload a file, or paste LinkedIn content');
    }

    const enrichedData = await agentRouterService.enrichPortfolioContent({
      resumeText,
      userType: params.userType,
      targetRole: params.targetRole,
      name: params.profile?.name,
      email: params.profile?.email,
      phone: params.profile?.phone,
      location: params.profile?.location,
      linkedinUrl: params.profile?.linkedinUrl,
      githubUrl: params.profile?.githubUrl,
    });

    const seoData = await agentRouterService.optimizeForSEO({
      name: enrichedData.profile?.name || params.profile?.name || 'Professional',
      targetRole: params.targetRole || 'Professional',
      skills: enrichedData.skills?.flatMap((s: any) => s.items || []) || [],
      experience: enrichedData.experience?.[0]?.role || '',
    });

    const portfolioData: any = {
      user_id: user.id,
      full_name: enrichedData.profile?.name || params.profile?.name || '',
      email: enrichedData.profile?.email || params.profile?.email || '',
      phone: enrichedData.profile?.phone || params.profile?.phone || '',
      location: enrichedData.profile?.location || params.profile?.location || '',
      linkedin_url: params.profile?.linkedinUrl || '',
      github_url: params.profile?.githubUrl || '',
      user_type: params.userType,
      target_role: params.targetRole || enrichedData.targetRole || '',
      professional_summary: enrichedData.professionalSummary || enrichedData.about || '',
      career_objective: enrichedData.careerObjective || '',
      work_experience: enrichedData.experience || [],
      projects: enrichedData.projects || [],
      education: enrichedData.education || [],
      skills: enrichedData.skills || [],
      certifications: enrichedData.certifications || [],
      achievements: enrichedData.achievements || [],
      additional_sections: enrichedData.additionalSections || [],
      seo_title: seoData.title,
      seo_description: seoData.description,
      seo_keywords: seoData.keywords,
      original_resume_text: resumeText,
      is_published: false,
    };

    const { data: savedPortfolio, error } = await supabase
      .from('portfolio_data')
      .insert(portfolioData)
      .select()
      .single();

    if (error) {
      console.error('Error saving portfolio:', error);
      throw new Error('Failed to save portfolio data');
    }

    return {
      portfolioId: savedPortfolio.id,
      data: this.mapToPortfolioData(savedPortfolio),
    };
  }

  async getPortfolio(portfolioId: string): Promise<PortfolioData> {
    const { data, error } = await supabase
      .from('portfolio_data')
      .select('*')
      .eq('id', portfolioId)
      .single();

    if (error) {
      console.error('Error fetching portfolio:', error);
      throw new Error('Portfolio not found');
    }

    return this.mapToPortfolioData(data);
  }

  async getUserPortfolios(): Promise<PortfolioData[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('portfolio_data')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching portfolios:', error);
      throw new Error('Failed to fetch portfolios');
    }

    return data.map(this.mapToPortfolioData);
  }

  async updatePortfolio(portfolioId: string, updates: Partial<PortfolioData>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {};

    if (updates.profile) {
      if (updates.profile.name) updateData.full_name = updates.profile.name;
      if (updates.profile.email) updateData.email = updates.profile.email;
      if (updates.profile.phone) updateData.phone = updates.profile.phone;
      if (updates.profile.location) updateData.location = updates.profile.location;
      if (updates.profile.linkedinUrl !== undefined) updateData.linkedin_url = updates.profile.linkedinUrl;
      if (updates.profile.githubUrl !== undefined) updateData.github_url = updates.profile.githubUrl;
    }

    if (updates.targetRole !== undefined) updateData.target_role = updates.targetRole;
    if (updates.professionalSummary !== undefined) updateData.professional_summary = updates.professionalSummary;
    if (updates.careerObjective !== undefined) updateData.career_objective = updates.careerObjective;
    if (updates.experience !== undefined) updateData.work_experience = updates.experience;
    if (updates.projects !== undefined) updateData.projects = updates.projects;
    if (updates.education !== undefined) updateData.education = updates.education;
    if (updates.skills !== undefined) updateData.skills = updates.skills;
    if (updates.certifications !== undefined) updateData.certifications = updates.certifications;
    if (updates.achievements !== undefined) updateData.achievements = updates.achievements;
    if (updates.additionalSections !== undefined) updateData.additional_sections = updates.additionalSections;

    const { error } = await supabase
      .from('portfolio_data')
      .update(updateData)
      .eq('id', portfolioId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating portfolio:', error);
      throw new Error('Failed to update portfolio');
    }
  }

  async deletePortfolio(portfolioId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('portfolio_data')
      .delete()
      .eq('id', portfolioId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting portfolio:', error);
      throw new Error('Failed to delete portfolio');
    }
  }

  async createTemplate(portfolioId: string, templateId: TemplateId): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const templateData = {
      user_id: user.id,
      portfolio_data_id: portfolioId,
      template_id: templateId,
      accent_color: '#3B82F6',
      font_family: 'Inter',
      color_mode: 'light',
      visible_sections: {
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
      },
      section_order: ['contact', 'about', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements'],
    };

    const { data, error } = await supabase
      .from('portfolio_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      throw new Error('Failed to create template');
    }

    return data.id;
  }

  async updateTemplate(portfolioId: string, updates: Partial<PortfolioTemplate>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {};

    if (updates.templateId !== undefined) updateData.template_id = updates.templateId;
    if (updates.accentColor !== undefined) updateData.accent_color = updates.accentColor;
    if (updates.fontFamily !== undefined) updateData.font_family = updates.fontFamily;
    if (updates.colorMode !== undefined) updateData.color_mode = updates.colorMode;
    if (updates.visibleSections !== undefined) updateData.visible_sections = updates.visibleSections;
    if (updates.sectionOrder !== undefined) updateData.section_order = updates.sectionOrder;
    if (updates.customCss !== undefined) updateData.custom_css = updates.customCss;

    const { error } = await supabase
      .from('portfolio_templates')
      .update(updateData)
      .eq('portfolio_data_id', portfolioId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating template:', error);
      throw new Error('Failed to update template');
    }
  }

  async getTemplate(portfolioId: string): Promise<PortfolioTemplate | null> {
    const { data, error } = await supabase
      .from('portfolio_templates')
      .select('*')
      .eq('portfolio_data_id', portfolioId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    if (!data) return null;

    return this.mapToPortfolioTemplate(data);
  }

  async checkDeploymentCredits(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('check_portfolio_deployment_credits', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Error checking credits:', error);
      return false;
    }

    return data;
  }

  async createDeployment(portfolioId: string, options: DeploymentOptions = {}): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const hasCredits = await this.checkDeploymentCredits();
    if (!hasCredits) {
      throw new Error('Insufficient deployment credits. Please upgrade your plan.');
    }

    const subdomain = options.subdomain || `${user.id.substring(0, 8)}-portfolio`;
    const deploymentUrl = `https://${subdomain}.netlify.app`;

    const deploymentData = {
      user_id: user.id,
      portfolio_data_id: portfolioId,
      deployment_url: deploymentUrl,
      subdomain,
      custom_domain: options.customDomain,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('portfolio_deployments')
      .insert(deploymentData)
      .select()
      .single();

    if (error) {
      console.error('Error creating deployment:', error);
      throw new Error('Failed to create deployment');
    }

    return data.id;
  }

  async updateDeploymentStatus(
    deploymentId: string,
    status: 'pending' | 'building' | 'success' | 'failed',
    details?: { buildLog?: string; errorMessage?: string; netlifySiteId?: string; netlifyDeployId?: string }
  ): Promise<void> {
    const updateData: any = { status };

    if (details?.buildLog) updateData.build_log = details.buildLog;
    if (details?.errorMessage) updateData.error_message = details.errorMessage;
    if (details?.netlifySiteId) updateData.netlify_site_id = details.netlifySiteId;
    if (details?.netlifyDeployId) updateData.netlify_deploy_id = details.netlifyDeployId;
    if (status === 'success') updateData.deployed_at = new Date().toISOString();

    const { error } = await supabase
      .from('portfolio_deployments')
      .update(updateData)
      .eq('id', deploymentId);

    if (error) {
      console.error('Error updating deployment status:', error);
      throw new Error('Failed to update deployment status');
    }
  }

  async getDeployment(deploymentId: string): Promise<PortfolioDeployment> {
    const { data, error } = await supabase
      .from('portfolio_deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();

    if (error) {
      console.error('Error fetching deployment:', error);
      throw new Error('Deployment not found');
    }

    return this.mapToPortfolioDeployment(data);
  }

  async getUserDeployments(): Promise<PortfolioDeployment[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('portfolio_deployments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deployments:', error);
      throw new Error('Failed to fetch deployments');
    }

    return data.map(this.mapToPortfolioDeployment);
  }

  private async extractTextFromFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          resolve(text);
        } catch (error) {
          reject(new Error('Failed to extract text from file'));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private mapToPortfolioData(data: any): PortfolioData {
    return {
      id: data.id,
      userId: data.user_id,
      profile: {
        name: data.full_name,
        email: data.email,
        phone: data.phone,
        location: data.location,
        linkedinUrl: data.linkedin_url,
        githubUrl: data.github_url,
        portfolioUrl: data.portfolio_url,
      },
      about: data.professional_summary || data.career_objective,
      userType: data.user_type,
      targetRole: data.target_role,
      professionalSummary: data.professional_summary,
      careerObjective: data.career_objective,
      experience: data.work_experience || [],
      projects: data.projects || [],
      education: data.education || [],
      skills: data.skills || [],
      certifications: data.certifications || [],
      achievements: data.achievements || [],
      additionalSections: data.additional_sections || [],
      seo: data.seo_title ? {
        title: data.seo_title,
        description: data.seo_description,
        keywords: data.seo_keywords || [],
      } : undefined,
      originalResumeText: data.original_resume_text,
      jobDescriptionContext: data.job_description_context,
      isPublished: data.is_published,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapToPortfolioTemplate(data: any): PortfolioTemplate {
    return {
      id: data.id,
      userId: data.user_id,
      portfolioDataId: data.portfolio_data_id,
      templateId: data.template_id,
      accentColor: data.accent_color,
      fontFamily: data.font_family,
      colorMode: data.color_mode,
      visibleSections: data.visible_sections,
      sectionOrder: data.section_order,
      customCss: data.custom_css,
      customFonts: data.custom_fonts,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapToPortfolioDeployment(data: any): PortfolioDeployment {
    return {
      id: data.id,
      userId: data.user_id,
      portfolioDataId: data.portfolio_data_id,
      netlifySiteId: data.netlify_site_id,
      netlifyDeployId: data.netlify_deploy_id,
      deploymentUrl: data.deployment_url,
      customDomain: data.custom_domain,
      subdomain: data.subdomain,
      status: data.status,
      buildLog: data.build_log,
      errorMessage: data.error_message,
      viewCount: data.view_count,
      shareCount: data.share_count,
      analyticsData: data.analytics_data,
      deployedAt: data.deployed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export const portfolioService = new PortfolioService();
