const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: DeepSeekMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class DeepSeekService {
  private apiKey: string;

  constructor() {
    if (!DEEPSEEK_API_KEY) {
      console.warn('DeepSeek API key not configured. AI features will be disabled.');
      this.apiKey = '';
    } else {
      this.apiKey = DEEPSEEK_API_KEY;
    }
  }

  private async callDeepSeek(messages: DeepSeekMessage[], temperature = 0.7, maxTokens = 2000): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key is not configured. Please add VITE_DEEPSEEK_API_KEY to your environment variables.');
    }

    try {
      const requestBody: DeepSeekRequest = {
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API error:', errorText);
        throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
      }

      const data: DeepSeekResponse = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from DeepSeek API');
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error calling DeepSeek API:', error);
      throw error;
    }
  }

  async polishJobDescription(params: {
    companyName: string;
    roleTitle: string;
    domain: string;
    description: string;
    qualification?: string;
    experienceRequired?: string;
  }): Promise<string> {
    const { companyName, roleTitle, domain, description, qualification, experienceRequired } = params;

    const systemPrompt = `You are an expert HR content writer specializing in creating compelling job descriptions. Your task is to polish and enhance job descriptions to make them more attractive to candidates while maintaining accuracy and professionalism.`;

    const userPrompt = `Please polish and enhance the following job description. Make it more engaging, clear, and professional. Keep the core information accurate but improve the language, structure, and appeal.

Company: ${companyName}
Role: ${roleTitle}
Domain: ${domain}
Experience Required: ${experienceRequired || 'Not specified'}
Qualification: ${qualification || 'Not specified'}

Current Description:
${description}

Please provide an improved version that:
1. Has a compelling opening paragraph about the role
2. Clearly outlines key responsibilities
3. Lists required qualifications and skills
4. Highlights what makes this opportunity attractive
5. Uses professional yet approachable language
6. Is well-structured and easy to read

Improved Description:`;

    try {
      const polishedDescription = await this.callDeepSeek([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 0.7, 1500);

      return polishedDescription;
    } catch (error) {
      console.error('Error polishing job description:', error);
      throw new Error('Failed to polish job description. Please try again later.');
    }
  }

  async generateCompanyDescription(params: {
    companyName: string;
    roleTitle: string;
    domain: string;
    jobDescription?: string;
    qualification?: string;
    experienceRequired?: string;
  }): Promise<string> {
    const { companyName, roleTitle, domain, jobDescription, qualification, experienceRequired } = params;

    const systemPrompt = `You are an expert at creating compelling company descriptions that help candidates understand what a company does and why they should apply.`;

    const userPrompt = `Create a brief, engaging company description (2-3 paragraphs, around 150-200 words) for:

Company Name: ${companyName}
They are hiring for: ${roleTitle} (${domain})
Experience Level: ${experienceRequired || 'Not specified'}
Required Qualification: ${qualification || 'Not specified'}
${jobDescription ? `\nJob Context:\n${jobDescription.substring(0, 500)}` : ''}

Create a description that:
1. Explains what the company likely does based on the role and domain
2. Highlights why it's an exciting place to work
3. Mentions the kind of impact the candidate can make
4. Uses professional but friendly language
5. Is generic enough to fit most companies but specific to the role

Company Description:`;

    try {
      const companyDescription = await this.callDeepSeek([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 0.8, 500);

      return companyDescription;
    } catch (error) {
      console.error('Error generating company description:', error);
      return `${companyName} is a dynamic organization seeking talented professionals to join their team. This ${roleTitle} position offers an excellent opportunity to work with cutting-edge technologies and contribute to impactful projects. The ideal candidate will bring their expertise in ${domain} to help drive innovation and success.`;
    }
  }

  async extractKeywords(jobDescription: string, roleTitle: string): Promise<string[]> {
    const systemPrompt = `You are an expert at analyzing job descriptions and extracting key technical skills, tools, and keywords that should be highlighted in a resume for ATS optimization.`;

    const userPrompt = `Extract the most important keywords, skills, and technologies from this job description for the role of ${roleTitle}. Focus on technical skills, tools, frameworks, methodologies, and domain-specific terms that would be important for ATS (Applicant Tracking Systems).

Job Description:
${jobDescription.substring(0, 2000)}

Provide a comma-separated list of 15-25 most important keywords:`;

    try {
      const keywordsText = await this.callDeepSeek([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 0.5, 300);

      const keywords = keywordsText
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0 && k.length < 50);

      return keywords.slice(0, 25);
    } catch (error) {
      console.error('Error extracting keywords:', error);
      return [];
    }
  }

  async generateInterviewTips(params: {
    roleTitle: string;
    domain: string;
    companyName: string;
    testTypes?: string[];
  }): Promise<string> {
    const { roleTitle, domain, companyName, testTypes = [] } = params;

    const systemPrompt = `You are a career coach helping candidates prepare for job interviews.`;

    const testInfo = testTypes.length > 0 ? `The interview process includes: ${testTypes.join(', ')}.` : '';

    const userPrompt = `Provide 5-7 brief, actionable interview preparation tips for someone applying for:

Role: ${roleTitle}
Domain: ${domain}
Company: ${companyName}
${testInfo}

Focus on:
1. What to prepare technically
2. How to showcase relevant experience
3. Common interview topics for this domain
4. What the company might be looking for
5. How to stand out as a candidate

Keep tips concise (1-2 sentences each) and practical.

Interview Tips:`;

    try {
      const tips = await this.callDeepSeek([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 0.7, 700);

      return tips;
    } catch (error) {
      console.error('Error generating interview tips:', error);
      return `Prepare thoroughly for your ${roleTitle} interview by reviewing core ${domain} concepts, practicing common technical questions, and being ready to discuss your relevant projects and experience. Research ${companyName} and prepare thoughtful questions about the role and team.`;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const deepseekService = new DeepSeekService();
