import { AIFeedback } from '../types/interview';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

if (!OPENROUTER_API_KEY) {
  console.warn('OpenRouter API key is not configured. Interview feedback will not be available.');
}

export class InterviewFeedbackService {
  private async callOpenRouter(prompt: string, maxRetries = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://primoboost.ai',
            'X-Title': 'PrimoBoost AI - Mock Interview'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: [{ role: 'user', content: prompt }]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('No content returned from OpenRouter API');
        }

        return content;
      } catch (error) {
        lastError = error as Error;
        console.error(`OpenRouter API attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError || new Error('Failed to get response from OpenRouter API');
  }

  async analyzeTechnicalAnswer(
    question: string,
    userAnswer: string,
    difficulty: string = 'Medium'
  ): Promise<AIFeedback> {
    const prompt = `You are an expert technical interviewer conducting a mock interview evaluation. Analyze the candidate's answer and provide structured feedback in JSON format.

QUESTION (${difficulty} difficulty):
${question}

CANDIDATE'S ANSWER:
${userAnswer}

Provide your evaluation as a JSON object with the following structure:
{
  "score": <number from 0-10>,
  "missed_points": [<array of key concepts or details the candidate missed>],
  "suggestions": [<array of specific actionable suggestions to improve the answer>],
  "tone_confidence_rating": "<one of: Confident, Somewhat Confident, Nervous, Very Nervous, Professional>",
  "strengths": [<array of things the candidate did well>],
  "improvement_areas": [<array of areas needing improvement>]
}

SCORING CRITERIA:
- 9-10: Excellent answer with deep understanding, clear explanation, and relevant examples
- 7-8: Good answer covering main concepts with minor gaps
- 5-6: Satisfactory answer with significant gaps or unclear explanations
- 3-4: Poor answer missing key concepts or containing inaccuracies
- 0-2: Very poor answer showing fundamental misunderstanding

Be constructive, specific, and encouraging in your feedback. Focus on both what was done well and what could be improved.`;

    try {
      const response = await this.callOpenRouter(prompt);
      const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const feedback: AIFeedback = JSON.parse(cleanedResponse);

      if (typeof feedback.score !== 'number' || feedback.score < 0 || feedback.score > 10) {
        feedback.score = 5;
      }

      return feedback;
    } catch (error) {
      console.error('Error parsing AI feedback:', error);
      return this.getFallbackFeedback();
    }
  }

  async analyzeHRAnswer(
    question: string,
    userAnswer: string
  ): Promise<AIFeedback> {
    const prompt = `You are an experienced HR interviewer conducting a mock interview evaluation. Analyze the candidate's answer and provide structured feedback in JSON format.

QUESTION:
${question}

CANDIDATE'S ANSWER:
${userAnswer}

Provide your evaluation as a JSON object with the following structure:
{
  "score": <number from 0-10>,
  "missed_points": [<array of important points or examples the candidate should have mentioned>],
  "suggestions": [<array of specific suggestions to improve communication, structure, or content>],
  "tone_confidence_rating": "<one of: Confident and Professional, Confident, Somewhat Confident, Nervous, Very Nervous>",
  "strengths": [<array of positive aspects like clarity, examples, enthusiasm, structure>],
  "improvement_areas": [<array of areas like body language cues detected in text, answer structure, depth, relevance>]
}

SCORING CRITERIA:
- 9-10: Outstanding answer with clear structure, relevant examples, and strong communication
- 7-8: Good answer with solid examples and good communication
- 5-6: Adequate answer but lacking depth, structure, or specific examples
- 3-4: Weak answer with vague responses or poor structure
- 0-2: Very poor answer that doesn't address the question

Evaluate based on:
- Relevance and directness of the answer
- Use of specific examples and achievements
- Structure and clarity of communication
- Professionalism and enthusiasm
- Self-awareness and honesty

Be encouraging and provide actionable feedback.`;

    try {
      const response = await this.callOpenRouter(prompt);
      const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const feedback: AIFeedback = JSON.parse(cleanedResponse);

      if (typeof feedback.score !== 'number' || feedback.score < 0 || feedback.score > 10) {
        feedback.score = 5;
      }

      return feedback;
    } catch (error) {
      console.error('Error parsing AI feedback:', error);
      return this.getFallbackFeedback();
    }
  }

  async analyzeBehavioralAnswer(
    question: string,
    userAnswer: string
  ): Promise<AIFeedback> {
    const prompt = `You are a behavioral interview expert conducting a mock interview evaluation using the STAR method (Situation, Task, Action, Result). Analyze the candidate's answer and provide structured feedback in JSON format.

QUESTION:
${question}

CANDIDATE'S ANSWER:
${userAnswer}

Provide your evaluation as a JSON object with the following structure:
{
  "score": <number from 0-10>,
  "missed_points": [<array of STAR components missing or underdeveloped>],
  "suggestions": [<array of specific suggestions to improve the STAR structure and impact>],
  "tone_confidence_rating": "<one of: Confident and Articulate, Confident, Somewhat Confident, Nervous, Very Nervous>",
  "strengths": [<array of well-presented STAR elements or compelling story aspects>],
  "improvement_areas": [<array of areas to strengthen the narrative, add metrics, or clarify impact>]
}

SCORING CRITERIA (STAR Method):
- 9-10: Complete STAR with clear situation, specific actions, and measurable results
- 7-8: Good STAR coverage with most elements well-explained
- 5-6: Partial STAR with missing elements or vague descriptions
- 3-4: Incomplete STAR or overly generic response
- 0-2: No clear STAR structure or irrelevant answer

Evaluate specifically for:
- Situation: Was context clearly established?
- Task: Was their responsibility/challenge defined?
- Action: Were specific actions taken described?
- Result: Were outcomes and impact quantified?

Provide feedback that helps them tell more compelling stories.`;

    try {
      const response = await this.callOpenRouter(prompt);
      const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const feedback: AIFeedback = JSON.parse(cleanedResponse);

      if (typeof feedback.score !== 'number' || feedback.score < 0 || feedback.score > 10) {
        feedback.score = 5;
      }

      return feedback;
    } catch (error) {
      console.error('Error parsing AI feedback:', error);
      return this.getFallbackFeedback();
    }
  }

  async analyzeAnswer(
    question: string,
    userAnswer: string,
    category: 'Technical' | 'HR' | 'Behavioral' | 'Coding' | 'Projects' | 'Aptitude',
    difficulty: string = 'Medium'
  ): Promise<AIFeedback> {
    if (!userAnswer || userAnswer.trim().length < 10) {
      return {
        score: 0,
        missed_points: ['No substantial answer provided'],
        suggestions: ['Please provide a more detailed response to the question'],
        tone_confidence_rating: 'Unable to assess',
        strengths: [],
        improvement_areas: ['Provide more detailed responses']
      };
    }

    switch (category) {
      case 'Technical':
      case 'Coding':
      case 'Projects':
        return this.analyzeTechnicalAnswer(question, userAnswer, difficulty);
      case 'Behavioral':
        return this.analyzeBehavioralAnswer(question, userAnswer);
      case 'HR':
      case 'Aptitude':
      default:
        return this.analyzeHRAnswer(question, userAnswer);
    }
  }

  private getFallbackFeedback(): AIFeedback {
    return {
      score: 5,
      missed_points: ['Unable to analyze answer due to technical issues'],
      suggestions: ['Please try again or review your answer for completeness'],
      tone_confidence_rating: 'Unable to assess',
      strengths: ['Answer provided'],
      improvement_areas: ['Technical issue prevented detailed analysis']
    };
  }

  async generateOverallSummary(
    responses: Array<{
      question: string;
      answer: string;
      feedback: AIFeedback;
      score: number;
    }>
  ): Promise<{
    overallStrengths: string[];
    overallImprovements: string[];
    keyTakeaways: string[];
  }> {
    const allStrengths = responses.flatMap(r => r.feedback.strengths || []);
    const allImprovements = responses.flatMap(r => r.feedback.improvement_areas || []);

    const strengthCounts = new Map<string, number>();
    const improvementCounts = new Map<string, number>();

    allStrengths.forEach(s => {
      const normalized = s.toLowerCase();
      strengthCounts.set(normalized, (strengthCounts.get(normalized) || 0) + 1);
    });

    allImprovements.forEach(i => {
      const normalized = i.toLowerCase();
      improvementCounts.set(normalized, (improvementCounts.get(normalized) || 0) + 1);
    });

    const topStrengths = Array.from(strengthCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([strength]) => strength);

    const topImprovements = Array.from(improvementCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([improvement]) => improvement);

    const averageScore = responses.reduce((sum, r) => sum + r.score, 0) / responses.length;

    const keyTakeaways: string[] = [];
    if (averageScore >= 7) {
      keyTakeaways.push('Strong overall performance showing good preparation');
    } else if (averageScore >= 5) {
      keyTakeaways.push('Solid foundation with room for improvement');
    } else {
      keyTakeaways.push('Focus on fundamentals and practice more to build confidence');
    }

    if (topStrengths.length > 0) {
      keyTakeaways.push(`Keep leveraging your strength in ${topStrengths[0]}`);
    }

    if (topImprovements.length > 0) {
      keyTakeaways.push(`Priority improvement area: ${topImprovements[0]}`);
    }

    return {
      overallStrengths: topStrengths,
      overallImprovements: topImprovements,
      keyTakeaways
    };
  }
}

export const interviewFeedbackService = new InterviewFeedbackService();
