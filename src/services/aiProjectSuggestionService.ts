import { geminiService } from './geminiServiceWrapper';
import { supabase } from '../lib/supabaseClient';

export interface ProjectSuggestion {
  id?: string;
  projectTitle: string;
  projectSummary: string;
  techStack: string[];
  githubLink: string;
  liveDemoLink: string;
  codeSnippet: string;
  impactDescription: string;
  wasSelected?: boolean;
  selectionType?: 'replace' | 'add' | 'skip';
}

export interface ProjectGenerationResult {
  projects: ProjectSuggestion[];
  matchScoreImprovement: number;
  reasoning: string;
}

class AIProjectSuggestionService {
  async generateProjectSuggestions(
    jobDescription: string,
    currentResume: string,
    matchScore: number
  ): Promise<ProjectGenerationResult> {
    try {
      const prompt = this.buildProjectGenerationPrompt(
        jobDescription,
        currentResume,
        matchScore
      );

      const response = await geminiService.generateContent(prompt);
      const result = this.parseProjectSuggestions(response);

      return result;
    } catch (error) {
      console.error('Error generating project suggestions:', error);
      throw new Error('Failed to generate project suggestions');
    }
  }

  private buildProjectGenerationPrompt(
    jobDescription: string,
    currentResume: string,
    matchScore: number
  ): string {
    return `You are an expert career advisor and technical project designer. Analyze the following job description and candidate's resume to suggest 3 highly relevant projects that would significantly improve their chances of getting hired.

**Job Description:**
${jobDescription}

**Current Resume:**
${currentResume}

**Current Match Score:** ${matchScore}%

**Your Task:**
Generate 3 project suggestions that:
1. Directly address missing skills or weak areas in the resume
2. Demonstrate expertise relevant to the job requirements
3. Are realistic and implementable
4. Include specific technical details and measurable impact
5. Would increase the match score by at least 10-15%

For each project, provide:
- **Project Title**: Concise, professional title
- **Project Summary**: 3-4 sentences explaining what the project does and its value
- **Tech Stack**: Array of technologies used (matching job requirements)
- **GitHub Link**: Suggested repo structure (e.g., "github.com/user/ai-chatbot-assistant")
- **Live Demo Link**: Suggested deployment URL (e.g., "ai-chatbot.vercel.app")
- **Code Snippet**: A realistic 10-15 line code sample showcasing key functionality
- **Impact Description**: Specific metrics or outcomes (e.g., "Reduced response time by 40%", "Processed 10K+ requests/day")

**Output Format (JSON):**
{
  "projects": [
    {
      "projectTitle": "...",
      "projectSummary": "...",
      "techStack": ["React", "Node.js", "MongoDB"],
      "githubLink": "...",
      "liveDemoLink": "...",
      "codeSnippet": "...",
      "impactDescription": "..."
    }
  ],
  "matchScoreImprovement": 12,
  "reasoning": "These projects address the following gaps: ..."
}

Return ONLY valid JSON, no markdown formatting.`;
  }

  private parseProjectSuggestions(response: string): ProjectGenerationResult {
    try {
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);

      if (!parsed.projects || !Array.isArray(parsed.projects)) {
        throw new Error('Invalid response format');
      }

      return {
        projects: parsed.projects.map((p: any) => ({
          projectTitle: p.projectTitle || p.project_title || '',
          projectSummary: p.projectSummary || p.project_summary || '',
          techStack: p.techStack || p.tech_stack || [],
          githubLink: p.githubLink || p.github_link || '',
          liveDemoLink: p.liveDemoLink || p.live_demo_link || '',
          codeSnippet: p.codeSnippet || p.code_snippet || '',
          impactDescription: p.impactDescription || p.impact_description || '',
        })),
        matchScoreImprovement: parsed.matchScoreImprovement || parsed.match_score_improvement || 0,
        reasoning: parsed.reasoning || '',
      };
    } catch (error) {
      console.error('Error parsing project suggestions:', error);
      return this.getFallbackProjects();
    }
  }

  private getFallbackProjects(): ProjectGenerationResult {
    return {
      projects: [
        {
          projectTitle: 'AI-Powered Task Automation System',
          projectSummary:
            'Built an intelligent task automation platform that uses machine learning to optimize workflow efficiency. The system analyzes user behavior patterns and automatically suggests task prioritization and automation opportunities.',
          techStack: ['Python', 'TensorFlow', 'FastAPI', 'React', 'PostgreSQL'],
          githubLink: 'github.com/user/ai-task-automation',
          liveDemoLink: 'task-automation.vercel.app',
          codeSnippet: `
def analyze_task_patterns(user_id: str) -> Dict:
    tasks = db.get_user_tasks(user_id)
    patterns = ml_model.predict_patterns(tasks)
    recommendations = generate_recommendations(patterns)
    return {
        'efficiency_score': patterns.score,
        'recommendations': recommendations,
        'time_saved': calculate_time_saved(tasks, patterns)
    }`,
          impactDescription:
            'Reduced manual task processing time by 45%, processed 50K+ tasks with 92% accuracy',
        },
        {
          projectTitle: 'Real-Time Data Analytics Dashboard',
          projectSummary:
            'Developed a comprehensive analytics dashboard with real-time data visualization and interactive filtering capabilities. Integrated multiple data sources and provided actionable insights through customizable widgets.',
          techStack: ['React', 'TypeScript', 'D3.js', 'Node.js', 'Redis', 'WebSocket'],
          githubLink: 'github.com/user/analytics-dashboard',
          liveDemoLink: 'analytics-dash.netlify.app',
          codeSnippet: `
const processRealTimeData = (stream: DataStream) => {
  return stream
    .map(data => transformData(data))
    .filter(data => data.isValid)
    .reduce((acc, data) => aggregateMetrics(acc, data))
    .subscribe({
      next: metrics => updateDashboard(metrics),
      error: err => handleError(err)
    });
};`,
          impactDescription:
            'Handled 100K+ events/minute with <100ms latency, improved decision-making speed by 60%',
        },
        {
          projectTitle: 'Microservices E-Commerce Platform',
          projectSummary:
            'Architected and implemented a scalable e-commerce platform using microservices architecture. Includes payment integration, inventory management, order processing, and user authentication with high availability.',
          techStack: ['Node.js', 'Docker', 'Kubernetes', 'MongoDB', 'RabbitMQ', 'AWS'],
          githubLink: 'github.com/user/microservices-ecommerce',
          liveDemoLink: 'ecommerce-platform.herokuapp.com',
          codeSnippet: `
class OrderService {
  async processOrder(order: Order): Promise<OrderResult> {
    const payment = await this.paymentService.charge(order);
    if (payment.success) {
      await this.inventoryService.reserve(order.items);
      await this.messageBroker.publish('order.created', order);
      return { status: 'success', orderId: order.id };
    }
  }
}`,
          impactDescription:
            'Achieved 99.9% uptime, processed $500K+ in transactions, scaled to 10K concurrent users',
        },
      ],
      matchScoreImprovement: 15,
      reasoning:
        'These projects demonstrate full-stack expertise, system design skills, and real-world problem-solving abilities relevant to most technical roles.',
    };
  }

  async saveProjectSuggestions(
    userId: string,
    jobListingId: string,
    resumeId: string,
    projects: ProjectSuggestion[]
  ): Promise<void> {
    try {
      const projectsToInsert = projects.map((project) => ({
        user_id: userId,
        job_listing_id: jobListingId,
        resume_id: resumeId,
        project_title: project.projectTitle,
        project_summary: project.projectSummary,
        tech_stack: project.techStack,
        github_link: project.githubLink,
        live_demo_link: project.liveDemoLink,
        code_snippet: project.codeSnippet,
        impact_description: project.impactDescription,
        was_selected: project.wasSelected || false,
        selection_type: project.selectionType || null,
      }));

      const { error } = await supabase
        .from('ai_project_suggestions')
        .insert(projectsToInsert);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving project suggestions:', error);
      throw error;
    }
  }

  async updateProjectSelection(
    projectId: string,
    wasSelected: boolean,
    selectionType: 'replace' | 'add' | 'skip'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_project_suggestions')
        .update({
          was_selected: wasSelected,
          selection_type: selectionType,
        })
        .eq('id', projectId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating project selection:', error);
      throw error;
    }
  }

  async getProjectSuggestions(resumeId: string): Promise<ProjectSuggestion[]> {
    try {
      const { data, error } = await supabase
        .from('ai_project_suggestions')
        .select('*')
        .eq('resume_id', resumeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => ({
        id: item.id,
        projectTitle: item.project_title,
        projectSummary: item.project_summary,
        techStack: item.tech_stack || [],
        githubLink: item.github_link || '',
        liveDemoLink: item.live_demo_link || '',
        codeSnippet: item.code_snippet || '',
        impactDescription: item.impact_description || '',
        wasSelected: item.was_selected,
        selectionType: item.selection_type,
      }));
    } catch (error) {
      console.error('Error fetching project suggestions:', error);
      return [];
    }
  }

  injectProjectIntoResume(
    resumeText: string,
    project: ProjectSuggestion,
    action: 'replace' | 'add'
  ): string {
    const projectSection = this.formatProjectForResume(project);

    if (action === 'replace') {
      return this.replaceExistingProject(resumeText, projectSection);
    } else {
      return this.addNewProject(resumeText, projectSection);
    }
  }

  private formatProjectForResume(project: ProjectSuggestion): string {
    return `
## ${project.projectTitle}
**Tech Stack:** ${project.techStack.join(', ')}
**Links:** [GitHub](${project.githubLink}) | [Live Demo](${project.liveDemoLink})

${project.projectSummary}

**Key Achievement:** ${project.impactDescription}

\`\`\`
${project.codeSnippet}
\`\`\`
`;
  }

  private replaceExistingProject(resumeText: string, newProject: string): string {
    const projectSectionRegex = /##\s+Projects?\s*([\s\S]*?)(?=##|$)/i;
    const match = resumeText.match(projectSectionRegex);

    if (match) {
      const existingProjects = match[1];
      const projectEntries = existingProjects.split(/(?=##)/);

      if (projectEntries.length > 1) {
        projectEntries[projectEntries.length - 1] = newProject;
        const updatedProjects = projectEntries.join('\n');
        return resumeText.replace(projectSectionRegex, `## Projects\n${updatedProjects}`);
      }
    }

    return this.addNewProject(resumeText, newProject);
  }

  private addNewProject(resumeText: string, newProject: string): string {
    const projectSectionRegex = /##\s+Projects?\s*([\s\S]*?)(?=##|$)/i;
    const match = resumeText.match(projectSectionRegex);

    if (match) {
      const existingProjects = match[1];
      const updatedSection = `## Projects\n${existingProjects.trim()}\n\n${newProject}`;
      return resumeText.replace(projectSectionRegex, updatedSection);
    }

    const experienceSectionRegex = /##\s+Experience\s*([\s\S]*?)(?=##|$)/i;
    const experienceMatch = resumeText.match(experienceSectionRegex);

    if (experienceMatch) {
      const insertPosition = experienceMatch.index! + experienceMatch[0].length;
      return (
        resumeText.slice(0, insertPosition) +
        `\n\n## Projects\n${newProject}` +
        resumeText.slice(insertPosition)
      );
    }

    return resumeText + `\n\n## Projects\n${newProject}`;
  }
}

export const aiProjectSuggestionService = new AIProjectSuggestionService();
