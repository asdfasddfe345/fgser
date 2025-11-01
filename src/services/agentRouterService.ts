import { getApiEndpoint } from '../utils/apiConfig';

const MAX_INPUT_LENGTH = 50000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30000;

// Local API endpoints (server proxy), not AgentRouter directly
const getAiEndpoint = () => getApiEndpoint('/ai-enrich');
const getHealthEndpoint = () => getApiEndpoint('/ai-health');

interface AgentRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AgentRouterRequest {
  model: string;
  messages: AgentRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface AgentRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AgentRouterMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class AgentRouterService {
  // Make sure these model IDs exist in your AgentRouter workspace
  private primaryModel: string = 'gpt-4o';
  private fallbackModels: string[] = ['claude-3-5-haiku-20241022', 'deepseek-chat'];

  private async safeFetch(
    messages: AgentRouterMessage[],
    options: { temperature?: number; maxTokens?: number; model?: string } = {}
  ): Promise<AgentRouterResponse> {
    const { temperature = 0.7, maxTokens = 2000, model = this.primaryModel } = options;

    let retries = 0;
    let delay = INITIAL_RETRY_DELAY_MS;
    let currentModel = model;
    let fallbackIndex = 0;

    while (retries < MAX_RETRIES) {
      const requestBody: AgentRouterRequest = {
        model: currentModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      // Timeout controller per request
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(getAiEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          let errorMessage = `AI API error: ${response.status}`;

          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorMessage = `AI API error: ${errorJson.error} (Code: ${errorJson.code || response.status})`;
            }
          } catch {
            if (errorText) errorMessage = `AI API error: ${errorText} (Status: ${response.status})`;
          }

          if (response.status === 400) throw new Error(`Bad Request. ${errorMessage}`);
          if (response.status === 401) throw new Error(`Authentication failed. Please check server configuration.`);
          if (response.status === 402) throw new Error(`Insufficient AI credits. Please upgrade your plan.`);
          if (response.status === 504) throw new Error(`Request timeout. The AI service took too long to respond.`);

          if (response.status === 429 || response.status >= 500) {
            retries++;
            if (retries >= MAX_RETRIES && fallbackIndex < this.fallbackModels.length) {
              console.warn(`Primary model ${currentModel} failed. Trying fallback: ${this.fallbackModels[fallbackIndex]}`);
              currentModel = this.fallbackModels[fallbackIndex++];
              retries = 0;
              delay = INITIAL_RETRY_DELAY_MS;
              continue;
            }
            if (retries >= MAX_RETRIES && fallbackIndex >= this.fallbackModels.length) {
              throw new Error(`AI service unavailable after ${MAX_RETRIES} retries on all models. ${errorMessage}`);
            }
            const jitter = Math.random() * 400;
            console.warn(`AI API: ${errorMessage}. Retrying in ${(delay + jitter) / 1000}s... (Attempt ${retries}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, delay + jitter));
            delay *= 2;
            continue;
          }

          throw new Error(errorMessage);
        }

        const data: AgentRouterResponse = await response.json();
        return data;
      } catch (err: any) {
        clearTimeout(timeout);

        // Timeout from AbortController
        if (err?.name === 'AbortError') {
          retries++;
          if (retries >= MAX_RETRIES) {
            throw new Error(`Request timeout after ${MAX_RETRIES} attempts. The AI service is not responding.`);
          }
          console.warn(`Request timeout. Retrying... (Attempt ${retries}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        // Network failures
        if ((err.message || '').includes('Failed to fetch') || (err.message || '').includes('NetworkError')) {
          retries++;
          if (retries >= MAX_RETRIES) {
            throw new Error(`Network error: Unable to connect to AI service after ${MAX_RETRIES} retries. Please check your internet connection.`);
          }
          console.warn(`Network error: ${err.message}. Retrying in ${delay / 1000}s... (Attempt ${retries}/${MAX_RETRIES})`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        // Other errors → bubble up
        throw err;
      }
    }

    throw new Error(`Failed after ${MAX_RETRIES} retries`);
  }

  async enrichPortfolioContent(params: {
    resumeText: string;
    userType: 'fresher' | 'student' | 'experienced';
    targetRole?: string;
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    githubUrl?: string;
  }): Promise<any> {
    const {
      resumeText,
      userType,
      targetRole = 'Professional Role',
      name = '',
      email = '',
      phone = '',
      location = '',
      linkedinUrl = '',
      githubUrl = '',
    } = params;

    // Auto-condense if too long
    let processedResumeText = resumeText;
    if (resumeText.length > MAX_INPUT_LENGTH) {
      console.log(`Resume too long (${resumeText.length} chars). Auto-condensing...`);
      try {
        processedResumeText = await this.condenseResumeText({
          resumeText,
          userType,
          targetCharLimit: 45000,
        });
        console.log(`Resume condensed from ${resumeText.length} to ${processedResumeText.length} characters`);
      } catch (condenseError) {
        console.error('Failed to condense resume with AI:', condenseError);
        processedResumeText = this.smartTruncateResume(resumeText, 45000);
        console.log(`Fallback truncation: ${processedResumeText.length} characters`);
      }
    }

    const systemPrompt = this.getSystemPromptForUserType(userType);
    const userPrompt = this.getUserPromptForEnrichment({
      resumeText: processedResumeText,
      userType,
      targetRole,
      name,
      email,
      phone,
      location,
      linkedinUrl,
      githubUrl,
    });

    // ✅ Route through safeFetch (no stray fetch(), no undefined requestBody/controller)
    const response = await this.safeFetch(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: 0.25,
        maxTokens: 3000,
      }
    );

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from AI service');
    }

    const content = response.choices[0].message.content.trim();
    return this.parseAndValidateJSON(content);
  }

  async condenseResumeText(params: {
    resumeText: string;
    userType: 'fresher' | 'student' | 'experienced';
    targetCharLimit?: number;
  }): Promise<string> {
    const { resumeText, userType, targetCharLimit = 45000 } = params;

    const prompt = `You are an expert resume optimizer. Your task is to condense a lengthy resume while preserving ALL critical information.

Original Resume (${resumeText.length} characters):
${resumeText}

User Type: ${userType}
Target Length: Under ${targetCharLimit} characters

CRITICAL REQUIREMENTS:
1. PRESERVE ALL: Contact information, names, dates, company names, job titles, education details
2. KEEP: All technical skills, certifications, and key achievements
3. CONDENSE: Remove redundant descriptions, verbose language, and repetitive points
4. OPTIMIZE: Use concise bullet points and remove filler words
5. MAINTAIN: Professional tone and readability
6. PRIORITIZE: Most recent and relevant experience

Your goal: Reduce length to under ${targetCharLimit} characters while keeping the resume comprehensive and impactful.

Return ONLY the condensed resume text, no explanations or markdown formatting.`;

    const response = await this.safeFetch([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      maxTokens: 4000,
    });

    const condensedText = response.choices[0].message.content.trim();
    if (condensedText.length >= resumeText.length) {
      return this.smartTruncateResume(resumeText, targetCharLimit);
    }
    return condensedText;
  }

  private smartTruncateResume(resumeText: string, targetLength: number): string {
    const sections = { contact: '', experience: '', education: '', skills: '' };
    sections.contact = resumeText.substring(0, 500);

    const experienceMatch = resumeText.match(/(?:experience|work history|employment)([\s\S]{0,10000})/i);
    if (experienceMatch) sections.experience = experienceMatch[1].substring(0, 8000);

    const educationMatch = resumeText.match(/(?:education|academic)([\s\S]{0,3000})/i);
    if (educationMatch) sections.education = educationMatch[1].substring(0, 2000);

    const skillsMatch = resumeText.match(/(?:skills|technical skills|competencies)([\s\S]{0,2000})/i);
    if (skillsMatch) sections.skills = skillsMatch[1].substring(0, 1500);

    const truncated = `${sections.contact}\n\nEXPERIENCE\n${sections.experience}\n\nEDUCATION\n${sections.education}\n\nSKILLS\n${sections.skills}`;
    return truncated.substring(0, targetLength);
  }

  async generateAboutSection(params: {
    userType: 'fresher' | 'student' | 'experienced';
    targetRole: string;
    experience?: string;
    skills?: string[];
  }): Promise<string> {
    const { userType, targetRole, experience = '', skills = [] } = params;

    const prompt = `You are an expert portfolio writer specializing in creating compelling About sections.

Generate a compelling 2-3 paragraph About section for a ${userType} targeting ${targetRole} role.

${experience ? `Experience: ${experience}` : ''}
${skills.length > 0 ? `Key Skills: ${skills.join(', ')}` : ''}

Requirements:
1. Write in first person (use "I" and "my")
2. Start with a strong opening highlighting key strengths
3. Showcase relevant experience and achievements
4. Include specific skills and technologies
5. End with career goals and value proposition
6. Keep it professional yet personable
7. Total length: 150-250 words

Return ONLY the About section text, no additional formatting or explanations.`;

    const response = await this.safeFetch([{ role: 'user', content: prompt }], {
      temperature: 0.8,
      maxTokens: 500,
    });

    return response.choices[0].message.content.trim();
  }

  async optimizeForSEO(params: {
    name: string;
    targetRole: string;
    skills: string[];
    experience?: string;
  }): Promise<{ title: string; description: string; keywords: string[] }> {
    const { name, targetRole, skills, experience = '' } = params;

    const prompt = `You are an SEO expert specializing in portfolio optimization.

Generate SEO metadata for a portfolio website:
- Name: ${name}
- Target Role: ${targetRole}
- Skills: ${skills.join(', ')}
${experience ? `- Experience: ${experience}` : ''}

Generate:
1. SEO Title (60 characters max, include name and role)
2. Meta Description (155 characters max, compelling and keyword-rich)
3. Keywords (array of 8-12 relevant keywords)

Return ONLY valid JSON:
{
  "title": "...",
  "description": "...",
  "keywords": ["...", "..."]
}`;

    const response = await this.safeFetch([{ role: 'user', content: prompt }], {
      temperature: 0.5,
      maxTokens: 300,
    });

    const content = response.choices[0].message.content.trim();
    return this.parseAndValidateJSON(content);
  }

  async generateProjectBullets(params: {
    title: string;
    description: string;
    techStack?: string[];
  }): Promise<string[]> {
    const { title, description, techStack = [] } = params;

    const prompt = `You are an expert at writing compelling project descriptions.

Project: ${title}
Description: ${description}
${techStack.length > 0 ? `Tech Stack: ${techStack.join(', ')}` : ''}

Generate exactly 3 bullet points that:
1. Start with strong action verbs
2. Highlight technical achievements
3. Include specific technologies and metrics
4. Each bullet is 15-20 words maximum
5. Focus on impact and results

Return ONLY a JSON array: ["bullet1", "bullet2", "bullet3"]`;

    const response = await this.safeFetch([{ role: 'user', content: prompt }], {
      temperature: 0.7,
      maxTokens: 300,
    });

    const content = response.choices[0].message.content.trim();
    return this.parseAndValidateJSON(content);
  }

  async generateSkillCategories(params: {
    resumeText: string;
    targetRole: string;
  }): Promise<Array<{ category: string; skills: string[] }>> {
    const { resumeText, targetRole } = params;

    const prompt = `You are an expert at organizing skills into relevant categories.

Resume Context:
${resumeText.substring(0, 2000)}

Target Role: ${targetRole}

Generate 6-8 skill categories with 5-8 skills each. Categories should be relevant to the role.

Common categories: Programming Languages, Frameworks, Databases, Cloud/DevOps, Tools, Soft Skills

Return ONLY valid JSON:
[
  {"category": "Category Name", "skills": ["skill1", "skill2", "..."]},
  {"category": "...", "skills": ["...", "..."]}
]`;

    const response = await this.safeFetch([{ role: 'user', content: prompt }], {
      temperature: 0.6,
      maxTokens: 800,
    });

    const content = response.choices[0].message.content.trim();
    return this.parseAndValidateJSON(content);
  }

  private getSystemPromptForUserType(userType: 'fresher' | 'student' | 'experienced'): string {
    const basePrompt = `You are an expert portfolio content creator and career coach. Your task is to analyze resume content and generate optimized, compelling portfolio content.`;
    if (userType === 'experienced') {
      return `${basePrompt}
Focus on EXPERIENCED PROFESSIONALS:
1. Emphasize leadership, achievements, and career progression
2. Quantify impact with specific metrics and results
3. Highlight technical expertise and domain knowledge
4. Showcase strategic thinking and problem-solving
5. Include professional summary (not career objective)`;
    }
    if (userType === 'student') {
      return `${basePrompt}
Focus on COLLEGE STUDENTS:
1. Emphasize academic achievements and GPA
2. Highlight internships, projects, and coursework
3. Showcase learning ability and technical skills
4. Include career objective focusing on learning goals
5. Emphasize potential and enthusiasm`;
    }
    return `${basePrompt}
Focus on FRESH GRADUATES:
1. Balance education and practical experience
2. Highlight projects, internships, and certifications
3. Showcase technical skills and tools
4. Include career objective for entry-level roles
5. Emphasize adaptability and eagerness to learn`;
  }

  private getUserPromptForEnrichment(params: {
    resumeText: string;
    userType: string;
    targetRole: string;
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
    githubUrl: string;
  }): string {
    return `Analyze the following resume and generate optimized portfolio content.

Resume Content:
${params.resumeText}

User Details:
- Type: ${params.userType}
- Target Role: ${params.targetRole}
- Name: ${params.name || 'Extract from resume'}
- Email: ${params.email || 'Extract from resume'}
- Phone: ${params.phone || 'Extract from resume'}
- Location: ${params.location || 'Extract from resume'}
- LinkedIn: ${params.linkedinUrl || 'Not provided'}
- GitHub: ${params.githubUrl || 'Not provided'}

Generate a complete portfolio data structure in JSON format:

{
  "profile": {
    "name": "...",
    "email": "...",
    "phone": "...",
    "location": "...",
    "linkedinUrl": "${params.linkedinUrl || ''}",
    "githubUrl": "${params.githubUrl || ''}"
  },
  "about": "Compelling 2-3 paragraph About section (150-250 words)",
  "targetRole": "Specific role title",
  "experience": [
    { "role": "...", "company": "...", "duration": "...", "bullets": ["...", "...", "..."] }
  ],
  "projects": [
    { "title": "...", "description": "Brief description", "techStack": ["...", "..."], "bullets": ["...", "...", "..."], "links": {"github": "...", "demo": "..."} }
  ],
  "education": [
    { "degree": "...", "institution": "...", "year": "...", "gpa": "...", "location": "..." }
  ],
  "skills": [ { "category": "...", "items": ["...", "..."] } ],
  "certifications": [ { "title": "...", "issuer": "...", "date": "..." } ],
  "achievements": ["...", "...", "..."]
}

Critical Requirements:
1. Use ONLY provided LinkedIn and GitHub URLs - do not modify or generate new ones
2. Extract accurate information from resume
3. Write compelling, action-oriented content
4. Use strong verbs and quantify achievements
5. Ensure all content is professional and ATS-friendly
6. Return ONLY valid JSON, no markdown or explanations`;
  }

  private parseAndValidateJSON(content: string): any {
    let cleanedContent = content.trim();
    cleanedContent = cleanedContent.replace(/^[\uFEFF\u200B]+/, ''); // strip BOM/ZW
    const codeFence = cleanedContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeFence?.[1]) cleanedContent = codeFence[1].trim();
    else cleanedContent = cleanedContent.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanedContent);
    } catch (err) {
      console.error('JSON parsing error:', err);
      console.error('Raw response (first 500 chars):', cleanedContent.substring(0, 500));
      throw new Error('Invalid JSON response from AI service. Please try again.');
    }
  }

  isConfigured(): boolean {
    // Secrets live server-side; from the client we always say “configured”
    return true;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(getHealthEndpoint());
      const data = await res.json();
      return data?.agentRouterConfigured === true;
    } catch (e) {
      console.error('Health check failed:', e);
      return false;
    }
  }
}

export const agentRouterService = new AgentRouterService();
