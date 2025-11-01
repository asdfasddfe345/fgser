import { geminiService } from './geminiServiceWrapper';
import { supabase } from '../lib/supabaseClient';
import { ParsedResume, ParsedProject } from './resumeParsingAdvancedService';

export interface GeneratedQuestion {
  questionNumber: number;
  questionType: 'project_specific' | 'coding' | 'technical' | 'behavioral';
  questionText: string;
  relatedProject?: string;
  relatedSkills: string[];
  difficultyLevel: 'easy' | 'medium' | 'hard';
  expectedDurationMinutes: number;
  requiresCoding: boolean;
  programmingLanguage?: string;
  context: {
    reasoning?: string;
    expectedTopics?: string[];
    evaluationCriteria?: string[];
  };
}

export interface QuestionGenerationConfig {
  totalQuestions: number;
  focusAreas?: string[];
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
  includeProjectQuestions: boolean;
  includeCodingQuestions: boolean;
  programmingLanguages?: string[];
}

class AdaptiveQuestionService {
  async generateQuestionsFromResume(
    resumeData: ParsedResume,
    config: QuestionGenerationConfig
  ): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];
    const { totalQuestions, includeProjectQuestions, includeCodingQuestions } = config;

    const projectQuestions = Math.floor(totalQuestions * 0.4);
    const codingQuestions = Math.floor(totalQuestions * 0.4);
    const technicalQuestions = totalQuestions - projectQuestions - codingQuestions;

    if (includeProjectQuestions && resumeData.projects.length > 0) {
      const projectQs = await this.generateProjectSpecificQuestions(
        resumeData.projects,
        projectQuestions,
        resumeData.experienceLevel
      );
      questions.push(...projectQs);
    }

    if (includeCodingQuestions) {
      const codingQs = await this.generateCodingQuestions(
        resumeData.skills,
        codingQuestions,
        resumeData.experienceLevel,
        config.programmingLanguages
      );
      questions.push(...codingQs);
    }

    const technicalQs = await this.generateTechnicalQuestions(
      resumeData.skills,
      technicalQuestions,
      resumeData.experienceLevel
    );
    questions.push(...technicalQs);

    return questions.map((q, index) => ({ ...q, questionNumber: index + 1 }));
  }

  private async generateProjectSpecificQuestions(
    projects: ParsedProject[],
    count: number,
    experienceLevel: string
  ): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];
    const selectedProjects = projects.slice(0, Math.min(count, projects.length));

    for (const project of selectedProjects) {
      const prompt = `
You are an expert technical interviewer. Generate a detailed, probing interview question about this project:

Project: ${project.name}
Description: ${project.description}
Technologies: ${project.technologies.join(', ')}
Experience Level: ${experienceLevel}

Generate ONE insightful question that:
1. Tests deep understanding of the technical decisions made
2. Explores challenges faced and solutions implemented
3. Assesses architecture and design choices
4. Is appropriate for a ${experienceLevel} level candidate

Format your response as JSON:
{
  "question": "the interview question",
  "expectedTopics": ["topic1", "topic2", "topic3"],
  "evaluationCriteria": ["criteria1", "criteria2", "criteria3"],
  "difficulty": "easy|medium|hard"
}
`;

      try {
        const response = await geminiService.generateText(prompt);
        const parsed = this.parseJSONResponse(response);

        questions.push({
          questionNumber: 0,
          questionType: 'project_specific',
          questionText: parsed.question,
          relatedProject: project.name,
          relatedSkills: project.technologies,
          difficultyLevel: parsed.difficulty || 'medium',
          expectedDurationMinutes: 15,
          requiresCoding: false,
          context: {
            expectedTopics: parsed.expectedTopics || [],
            evaluationCriteria: parsed.evaluationCriteria || []
          }
        });
      } catch (error) {
        console.error('Error generating project question:', error);
        questions.push(this.createFallbackProjectQuestion(project, experienceLevel));
      }
    }

    return questions;
  }

  private async generateCodingQuestions(
    skills: string[],
    count: number,
    experienceLevel: string,
    preferredLanguages?: string[]
  ): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];
    const languages = preferredLanguages || this.detectProgrammingLanguages(skills);

    const difficultyMap = {
      junior: ['easy', 'easy', 'medium'],
      mid: ['easy', 'medium', 'medium'],
      senior: ['medium', 'medium', 'hard'],
      lead: ['medium', 'hard', 'hard'],
      unknown: ['easy', 'medium', 'hard']
    };

    const difficulties = difficultyMap[experienceLevel as keyof typeof difficultyMap] || difficultyMap.unknown;

    for (let i = 0; i < count; i++) {
      const language = languages[i % languages.length] || 'Python';
      const difficulty = difficulties[i % difficulties.length];

      const prompt = `
You are an expert technical interviewer. Generate a coding problem for a ${experienceLevel} level candidate.

Requirements:
- Difficulty: ${difficulty}
- Programming Language: ${language}
- Related Skills: ${skills.join(', ')}
- Should test problem-solving, algorithm design, and clean code practices
- Should be solvable in 15-20 minutes

Generate ONE coding question that includes:
1. Clear problem statement
2. Input/output examples
3. Constraints
4. Two test cases with expected outputs

Format your response as JSON:
{
  "question": "the coding problem statement",
  "approach": "suggested approach to solve",
  "testCases": [
    {"input": "test input 1", "expectedOutput": "expected output 1"},
    {"input": "test input 2", "expectedOutput": "expected output 2"}
  ],
  "evaluationCriteria": ["criteria1", "criteria2", "criteria3"],
  "difficulty": "${difficulty}"
}
`;

      try {
        const response = await geminiService.generateText(prompt);
        const parsed = this.parseJSONResponse(response);

        questions.push({
          questionNumber: 0,
          questionType: 'coding',
          questionText: parsed.question,
          relatedSkills: [language, ...skills.slice(0, 3)],
          difficultyLevel: difficulty as any,
          expectedDurationMinutes: 20,
          requiresCoding: true,
          programmingLanguage: language,
          context: {
            expectedTopics: [parsed.approach],
            evaluationCriteria: parsed.evaluationCriteria || [],
            testCases: parsed.testCases || []
          }
        });
      } catch (error) {
        console.error('Error generating coding question:', error);
        questions.push(this.createFallbackCodingQuestion(language, difficulty as any));
      }
    }

    return questions;
  }

  private async generateTechnicalQuestions(
    skills: string[],
    count: number,
    experienceLevel: string
  ): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];

    for (let i = 0; i < count; i++) {
      const relevantSkills = skills.slice(i * 2, (i * 2) + 3);

      const prompt = `
You are an expert technical interviewer. Generate a technical question for a ${experienceLevel} level candidate.

Skills to test: ${relevantSkills.join(', ')}
Experience Level: ${experienceLevel}

Generate ONE in-depth technical question that:
1. Tests conceptual understanding
2. Explores practical application
3. Assesses architectural knowledge
4. Is appropriate for ${experienceLevel} level

Format your response as JSON:
{
  "question": "the technical question",
  "expectedTopics": ["topic1", "topic2", "topic3"],
  "evaluationCriteria": ["criteria1", "criteria2", "criteria3"],
  "difficulty": "easy|medium|hard"
}
`;

      try {
        const response = await geminiService.generateText(prompt);
        const parsed = this.parseJSONResponse(response);

        questions.push({
          questionNumber: 0,
          questionType: 'technical',
          questionText: parsed.question,
          relatedSkills: relevantSkills,
          difficultyLevel: parsed.difficulty || 'medium',
          expectedDurationMinutes: 15,
          requiresCoding: false,
          context: {
            expectedTopics: parsed.expectedTopics || [],
            evaluationCriteria: parsed.evaluationCriteria || []
          }
        });
      } catch (error) {
        console.error('Error generating technical question:', error);
        questions.push(this.createFallbackTechnicalQuestion(relevantSkills, experienceLevel));
      }
    }

    return questions;
  }

  async generateFollowUpQuestion(
    originalQuestion: string,
    userResponse: string,
    responseAnalysis: any
  ): Promise<string> {
    const prompt = `
You are an expert interviewer conducting a follow-up question.

Original Question: ${originalQuestion}
Candidate's Response: ${userResponse}
Analysis: ${JSON.stringify(responseAnalysis)}

Based on the candidate's response, generate ONE insightful follow-up question that:
1. Probes deeper into areas they mentioned
2. Tests understanding of concepts they used
3. Explores edge cases or alternative approaches
4. Clarifies vague or incomplete parts of their answer

Return ONLY the follow-up question text, no additional formatting.
`;

    try {
      const followUp = await geminiService.generateText(prompt);
      return followUp.trim();
    } catch (error) {
      console.error('Error generating follow-up:', error);
      return "Can you elaborate more on the approach you mentioned?";
    }
  }

  async saveQuestionsToSession(sessionId: string, questions: GeneratedQuestion[]) {
    const questionsToInsert = questions.map(q => ({
      session_id: sessionId,
      question_number: q.questionNumber,
      question_type: q.questionType,
      question_text: q.questionText,
      related_project: q.relatedProject,
      related_skills: q.relatedSkills,
      difficulty_level: q.difficultyLevel,
      expected_duration_minutes: q.expectedDurationMinutes,
      requires_coding: q.requiresCoding,
      programming_language: q.programmingLanguage,
      context: q.context
    }));

    const { data, error } = await supabase
      .from('interview_questions_dynamic')
      .insert(questionsToInsert)
      .select();

    if (error) throw error;
    return data;
  }

  async getSessionQuestions(sessionId: string) {
    const { data, error } = await supabase
      .from('interview_questions_dynamic')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number');

    if (error) throw error;
    return data || [];
  }

  private detectProgrammingLanguages(skills: string[]): string[] {
    const languageMap: { [key: string]: string } = {
      'javascript': 'JavaScript',
      'typescript': 'JavaScript',
      'python': 'Python',
      'java': 'Java',
      'c++': 'C++',
      'c#': 'C#',
      'go': 'Go',
      'rust': 'Rust',
      'php': 'PHP',
      'ruby': 'Ruby',
      'swift': 'Swift',
      'kotlin': 'Kotlin'
    };

    const detectedLanguages = new Set<string>();

    skills.forEach(skill => {
      const normalized = skill.toLowerCase();
      if (languageMap[normalized]) {
        detectedLanguages.add(languageMap[normalized]);
      }
    });

    return Array.from(detectedLanguages).slice(0, 3) || ['Python', 'JavaScript'];
  }

  private parseJSONResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch {
      return { question: response };
    }
  }

  private createFallbackProjectQuestion(project: ParsedProject, experienceLevel: string): GeneratedQuestion {
    return {
      questionNumber: 0,
      questionType: 'project_specific',
      questionText: `Can you walk me through the architecture and technical decisions you made in your ${project.name} project? What challenges did you face and how did you overcome them?`,
      relatedProject: project.name,
      relatedSkills: project.technologies,
      difficultyLevel: 'medium',
      expectedDurationMinutes: 15,
      requiresCoding: false,
      context: {
        expectedTopics: ['architecture', 'technical decisions', 'problem solving'],
        evaluationCriteria: ['clarity', 'technical depth', 'problem-solving approach']
      }
    };
  }

  private createFallbackCodingQuestion(language: string, difficulty: 'easy' | 'medium' | 'hard'): GeneratedQuestion {
    const problems = {
      easy: 'Write a function to check if a given string is a palindrome. Ignore spaces and case sensitivity.',
      medium: 'Implement a function to find the first non-repeating character in a string. Return its index or -1 if not found.',
      hard: 'Design and implement a LRU (Least Recently Used) cache with get and put operations in O(1) time complexity.'
    };

    return {
      questionNumber: 0,
      questionType: 'coding',
      questionText: problems[difficulty],
      relatedSkills: [language, 'algorithms', 'data structures'],
      difficultyLevel: difficulty,
      expectedDurationMinutes: 20,
      requiresCoding: true,
      programmingLanguage: language,
      context: {
        expectedTopics: ['string manipulation', 'algorithms'],
        evaluationCriteria: ['correctness', 'efficiency', 'code quality'],
        testCases: [
          { input: '"racecar"', expectedOutput: 'true' },
          { input: '"hello"', expectedOutput: 'false' }
        ]
      }
    };
  }

  private createFallbackTechnicalQuestion(skills: string[], experienceLevel: string): GeneratedQuestion {
    const skill = skills[0] || 'software development';
    return {
      questionNumber: 0,
      questionType: 'technical',
      questionText: `Explain the key concepts and best practices you follow when working with ${skill}. How do you ensure code quality and maintainability?`,
      relatedSkills: skills,
      difficultyLevel: 'medium',
      expectedDurationMinutes: 15,
      requiresCoding: false,
      context: {
        expectedTopics: ['best practices', 'code quality', 'architecture'],
        evaluationCriteria: ['depth of knowledge', 'practical experience', 'communication']
      }
    };
  }
}

export const adaptiveQuestionService = new AdaptiveQuestionService();
