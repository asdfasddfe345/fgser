import { supabase } from '../lib/supabaseClient';
import { deepseekService } from './deepseekService';

export interface SmartInterviewConfig {
  sessionType: 'general' | 'company-based';
  interviewCategory: string;
  companyName?: string;
  targetRole?: string;
  domain?: string;
  durationMinutes: number;
}

export interface SmartQuestion {
  id: string;
  question_type: 'introduction' | 'behavioral' | 'technical' | 'coding';
  question_text: string;
  category: string;
  difficulty: string;
  company_name?: string;
  role?: string;
  domain?: string;
  requires_coding: boolean;
  programming_languages?: string[];
  default_language?: string;
  test_case_template?: any;
  expected_complexity?: any;
  code_hints?: string[];
  expected_answer_points?: string[];
  sample_good_answer?: string;
  tags?: string[];
}

export interface SmartSession {
  id: string;
  user_id: string;
  session_type: string;
  interview_category: string;
  company_name?: string;
  target_role?: string;
  domain?: string;
  duration_minutes: number;
  actual_duration_seconds?: number;
  total_questions: number;
  questions_answered: number;
  questions_skipped: number;
  overall_score?: number;
  status: string;
  started_at: string;
  completed_at?: string;
  tab_switches_count: number;
  fullscreen_exits_count: number;
  total_violation_time: number;
  violations_log: any[];
  security_score?: number;
}

export interface SmartResponse {
  id: string;
  session_id: string;
  question_id: string;
  question_order: number;
  answer_type: 'text' | 'code' | 'voice';
  text_answer?: string;
  code_answer?: string;
  programming_language?: string;
  audio_transcript?: string;
  ai_feedback?: any;
  individual_score?: number;
  strengths?: string[];
  improvements?: string[];
  response_duration_seconds?: number;
  auto_submitted: boolean;
  silence_duration: number;
  was_skipped: boolean;
}

class SmartInterviewService {
  async createSession(
    config: SmartInterviewConfig,
    userId: string
  ): Promise<SmartSession> {
    const { data, error } = await supabase
      .from('smart_interview_sessions')
      .insert({
        user_id: userId,
        session_type: config.sessionType,
        interview_category: config.interviewCategory,
        company_name: config.companyName,
        target_role: config.targetRole,
        domain: config.domain,
        duration_minutes: config.durationMinutes,
        status: 'in_progress',
        total_questions: 0,
        questions_answered: 0,
        questions_skipped: 0,
        tab_switches_count: 0,
        fullscreen_exits_count: 0,
        total_violation_time: 0,
        violations_log: []
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating smart interview session:', error);
      throw new Error('Failed to create interview session');
    }

    return data;
  }

  async selectQuestions(
    config: SmartInterviewConfig,
    count: number = 10
  ): Promise<SmartQuestion[]> {
    let query = supabase
      .from('smart_interview_questions')
      .select('*')
      .eq('is_active', true);

    if (config.companyName) {
      query = query.eq('company_name', config.companyName);
    }

    if (config.targetRole) {
      query = query.eq('role', config.targetRole);
    }

    if (config.domain) {
      query = query.eq('domain', config.domain);
    }

    const { data, error } = await query.limit(count);

    if (error) {
      console.error('Error fetching questions:', error);
      throw new Error('Failed to fetch questions');
    }

    if (!data || data.length === 0) {
      return this.generateDefaultQuestions(config, count);
    }

    return this.shuffleAndMixQuestions(data, count);
  }

  private async generateDefaultQuestions(
    config: SmartInterviewConfig,
    count: number
  ): Promise<SmartQuestion[]> {
    const defaultQuestions: SmartQuestion[] = [
      {
        id: 'default-1',
        question_type: 'introduction',
        question_text: `Please introduce yourself. Tell me about your background, current role, and what you're looking for in your next opportunity.`,
        category: 'Behavioral',
        difficulty: 'Easy',
        requires_coding: false,
        expected_answer_points: [
          'Professional background',
          'Current role and responsibilities',
          'Career goals',
          'Relevant skills'
        ]
      },
      {
        id: 'default-2',
        question_type: 'behavioral',
        question_text: 'Tell me about a challenging project you worked on. What was your role, what obstacles did you face, and how did you overcome them?',
        category: 'Behavioral',
        difficulty: 'Medium',
        requires_coding: false,
        expected_answer_points: [
          'Project context',
          'Specific challenges',
          'Your actions',
          'Results achieved'
        ]
      },
      {
        id: 'default-3',
        question_type: 'technical',
        question_text: 'Explain the difference between REST and GraphQL APIs. When would you choose one over the other?',
        category: 'Technical',
        difficulty: 'Medium',
        requires_coding: false,
        expected_answer_points: [
          'REST characteristics',
          'GraphQL characteristics',
          'Use cases for each',
          'Trade-offs'
        ]
      },
      {
        id: 'default-4',
        question_type: 'coding',
        question_text: 'Write a function to check if a given string is a palindrome. The function should ignore spaces and be case-insensitive.',
        category: 'Coding',
        difficulty: 'Easy',
        requires_coding: true,
        default_language: 'Python',
        programming_languages: ['Python', 'JavaScript', 'Java', 'C++'],
        test_case_template: {
          cases: [
            { input: '"racecar"', expectedOutput: 'true' },
            { input: '"A man a plan a canal Panama"', expectedOutput: 'true' },
            { input: '"hello"', expectedOutput: 'false' }
          ]
        },
        expected_complexity: {
          time: 'O(n)',
          space: 'O(1)'
        }
      },
      {
        id: 'default-5',
        question_type: 'coding',
        question_text: 'Implement a function to reverse a linked list. Return the head of the reversed list.',
        category: 'Coding',
        difficulty: 'Medium',
        requires_coding: true,
        default_language: 'Python',
        programming_languages: ['Python', 'JavaScript', 'Java', 'C++'],
        test_case_template: {
          cases: [
            { input: '[1, 2, 3, 4, 5]', expectedOutput: '[5, 4, 3, 2, 1]' },
            { input: '[1, 2]', expectedOutput: '[2, 1]' },
            { input: '[1]', expectedOutput: '[1]' }
          ]
        },
        expected_complexity: {
          time: 'O(n)',
          space: 'O(1)'
        }
      }
    ];

    return defaultQuestions.slice(0, Math.min(count, defaultQuestions.length));
  }

  private shuffleAndMixQuestions(questions: SmartQuestion[], count: number): SmartQuestion[] {
    const introduction = questions.filter(q => q.question_type === 'introduction');
    const behavioral = questions.filter(q => q.question_type === 'behavioral');
    const technical = questions.filter(q => q.question_type === 'technical');
    const coding = questions.filter(q => q.question_type === 'coding');

    const mixed: SmartQuestion[] = [];

    if (introduction.length > 0) mixed.push(introduction[0]);

    const remaining = count - mixed.length;
    const behavioralCount = Math.floor(remaining * 0.3);
    const technicalCount = Math.floor(remaining * 0.3);
    const codingCount = remaining - behavioralCount - technicalCount;

    mixed.push(...this.shuffle(behavioral).slice(0, behavioralCount));
    mixed.push(...this.shuffle(technical).slice(0, technicalCount));
    mixed.push(...this.shuffle(coding).slice(0, codingCount));

    return mixed;
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async saveResponse(
    sessionId: string,
    questionId: string,
    questionOrder: number,
    answerData: {
      answerType: 'text' | 'code' | 'voice';
      textAnswer?: string;
      codeAnswer?: string;
      programmingLanguage?: string;
      audioTranscript?: string;
      aiFeedback?: any;
      individualScore?: number;
      strengths?: string[];
      improvements?: string[];
      responseDuration?: number;
      autoSubmitted?: boolean;
      silenceDuration?: number;
      wasSkipped?: boolean;
    }
  ): Promise<SmartResponse> {
    const { data, error } = await supabase
      .from('smart_interview_responses')
      .insert({
        session_id: sessionId,
        question_id: questionId,
        question_order: questionOrder,
        answer_type: answerData.answerType,
        text_answer: answerData.textAnswer,
        code_answer: answerData.codeAnswer,
        programming_language: answerData.programmingLanguage,
        audio_transcript: answerData.audioTranscript,
        ai_feedback: answerData.aiFeedback,
        individual_score: answerData.individualScore,
        strengths: answerData.strengths,
        improvements: answerData.improvements,
        response_duration_seconds: answerData.responseDuration,
        auto_submitted: answerData.autoSubmitted || false,
        silence_duration: answerData.silenceDuration || 0,
        was_skipped: answerData.wasSkipped || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving response:', error);
      throw new Error('Failed to save response');
    }

    return data;
  }

  async evaluateTextAnswer(
    questionText: string,
    answer: string,
    expectedPoints: string[]
  ): Promise<{ score: number; feedback: any; strengths: string[]; improvements: string[] }> {
    try {
      const prompt = `You are an expert interview evaluator. Evaluate this interview answer.

Question: ${questionText}

Expected Answer Points:
${expectedPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Candidate's Answer: ${answer}

Provide a JSON response with:
{
  "score": <number 0-100>,
  "strengths": [<array of what was done well>],
  "improvements": [<array of areas to improve>],
  "feedback": "<detailed feedback paragraph>"
}`;

      const evaluation = await deepseekService.generateText(prompt, { maxTokens: 500 });
      const parsed = JSON.parse(evaluation);

      return {
        score: parsed.score,
        feedback: parsed,
        strengths: parsed.strengths || [],
        improvements: parsed.improvements || []
      };
    } catch (error) {
      console.error('Error evaluating answer:', error);
      return {
        score: 50,
        feedback: { feedback: 'Unable to evaluate answer automatically.' },
        strengths: [],
        improvements: []
      };
    }
  }

  async updateSessionProgress(
    sessionId: string,
    questionsAnswered: number,
    questionsSkipped: number
  ): Promise<void> {
    const { error } = await supabase
      .from('smart_interview_sessions')
      .update({
        questions_answered: questionsAnswered,
        questions_skipped: questionsSkipped
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session progress:', error);
    }
  }

  async completeSession(
    sessionId: string,
    actualDuration: number,
    securityMetrics: {
      tabSwitchCount: number;
      fullScreenExits: number;
      totalViolationTime: number;
      violationsLog: any[];
    }
  ): Promise<void> {
    const overallScore = await this.calculateOverallScore(sessionId);
    const securityScore = this.calculateSecurityScore(securityMetrics);

    const { error } = await supabase
      .from('smart_interview_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        actual_duration_seconds: actualDuration,
        overall_score: overallScore,
        security_score: securityScore,
        tab_switches_count: securityMetrics.tabSwitchCount,
        fullscreen_exits_count: securityMetrics.fullScreenExits,
        total_violation_time: securityMetrics.totalViolationTime,
        violations_log: securityMetrics.violationsLog
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error completing session:', error);
    }
  }

  private async calculateOverallScore(sessionId: string): Promise<number> {
    const { data, error } = await supabase
      .from('smart_interview_responses')
      .select('individual_score')
      .eq('session_id', sessionId)
      .not('was_skipped', 'eq', true);

    if (error || !data || data.length === 0) {
      return 0;
    }

    const total = data.reduce((sum, r) => sum + (r.individual_score || 0), 0);
    return Math.round(total / data.length);
  }

  private calculateSecurityScore(metrics: {
    tabSwitchCount: number;
    fullScreenExits: number;
    totalViolationTime: number;
  }): number {
    let score = 100;

    score -= metrics.tabSwitchCount * 5;
    score -= metrics.fullScreenExits * 10;
    score -= Math.floor(metrics.totalViolationTime / 10) * 2;

    return Math.max(0, Math.min(100, score));
  }

  async getSession(sessionId: string): Promise<SmartSession | null> {
    const { data, error } = await supabase
      .from('smart_interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }

    return data;
  }

  async getSessionResponses(sessionId: string): Promise<SmartResponse[]> {
    const { data, error } = await supabase
      .from('smart_interview_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true });

    if (error) {
      console.error('Error fetching responses:', error);
      return [];
    }

    return data || [];
  }
}

export const smartInterviewService = new SmartInterviewService();
