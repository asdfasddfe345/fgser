import { supabase } from '../lib/supabaseClient';
import { geminiService } from './geminiServiceWrapper';
import { adaptiveQuestionService } from './adaptiveQuestionService';

export interface ResponseAnalysis {
  clarity: number;
  technicalDepth: number;
  completeness: number;
  accuracy: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  needsFollowUp: boolean;
  followUpReason?: string;
}

export interface InterviewSessionData {
  id: string;
  userId: string;
  resumeId?: string;
  interviewType: 'resume_based' | 'standard' | 'hybrid';
  configuration: any;
  currentQuestionIndex: number;
  totalQuestions: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused';
  startedAt?: string;
  completedAt?: string;
  overallScore?: number;
}

class AdaptiveInterviewSessionService {
  async createSession(
    userId: string,
    resumeId: string | null,
    config: {
      totalQuestions: number;
      interviewType: 'resume_based' | 'standard' | 'hybrid';
      includeProjectQuestions?: boolean;
      includeCodingQuestions?: boolean;
      programmingLanguages?: string[];
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from('adaptive_interview_sessions')
      .insert({
        user_id: userId,
        resume_id: resumeId,
        interview_type: config.interviewType,
        configuration: config,
        total_questions: config.totalQuestions,
        status: 'not_started'
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  async startSession(sessionId: string) {
    const { data, error } = await supabase
      .from('adaptive_interview_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSession(sessionId: string): Promise<InterviewSessionData | null> {
    const { data, error } = await supabase
      .from('adaptive_interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }

    return data;
  }

  async updateSessionProgress(sessionId: string, questionIndex: number) {
    const { data, error } = await supabase
      .from('adaptive_interview_sessions')
      .update({
        current_question_index: questionIndex,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async completeSession(sessionId: string, overallScore: number) {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const startedAt = new Date(session.startedAt || Date.now());
    const completedAt = new Date();
    const durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);

    const { data, error } = await supabase
      .from('adaptive_interview_sessions')
      .update({
        status: 'completed',
        completed_at: completedAt.toISOString(),
        total_duration_seconds: durationSeconds,
        overall_score: overallScore
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async analyzeResponse(
    questionText: string,
    responseText: string,
    questionType: string,
    relatedSkills: string[]
  ): Promise<ResponseAnalysis> {
    const prompt = `
You are an expert technical interviewer evaluating a candidate's response.

Question Type: ${questionType}
Question: ${questionText}
Related Skills: ${relatedSkills.join(', ')}
Candidate's Response: ${responseText}

Analyze the response on these dimensions (rate 0-100):
1. Clarity - How clearly did they communicate?
2. Technical Depth - How deep was their technical understanding?
3. Completeness - Did they cover all aspects of the question?
4. Accuracy - Were their statements technically correct?

Also determine:
- Key strengths in the response
- Areas for improvement
- Whether a follow-up question is needed to probe deeper
- Specific suggestions for improvement

Format your response as JSON:
{
  "clarity": 0-100,
  "technicalDepth": 0-100,
  "completeness": 0-100,
  "accuracy": 0-100,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "needsFollowUp": true/false,
  "followUpReason": "reason if needs follow-up"
}
`;

    try {
      const response = await geminiService.generateText(prompt);
      const parsed = this.parseJSONResponse(response);

      const overallScore = (
        (parsed.clarity || 50) +
        (parsed.technicalDepth || 50) +
        (parsed.completeness || 50) +
        (parsed.accuracy || 50)
      ) / 4;

      return {
        clarity: parsed.clarity || 50,
        technicalDepth: parsed.technicalDepth || 50,
        completeness: parsed.completeness || 50,
        accuracy: parsed.accuracy || 50,
        overallScore: Math.round(overallScore),
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        suggestions: parsed.suggestions || [],
        needsFollowUp: parsed.needsFollowUp || false,
        followUpReason: parsed.followUpReason
      };
    } catch (error) {
      console.error('Error analyzing response:', error);
      return this.createDefaultAnalysis();
    }
  }

  async saveResponse(
    sessionId: string,
    questionId: string,
    responseData: {
      responseType: 'verbal' | 'code' | 'mixed';
      verbalResponse?: string;
      codeResponse?: string;
      programmingLanguage?: string;
      timeSpentSeconds: number;
    }
  ) {
    const { data, error } = await supabase
      .from('interview_responses_detailed')
      .insert({
        session_id: sessionId,
        question_id: questionId,
        response_type: responseData.responseType,
        verbal_response: responseData.verbalResponse,
        code_response: responseData.codeResponse,
        programming_language: responseData.programmingLanguage,
        time_spent_seconds: responseData.timeSpentSeconds,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateResponseWithAnalysis(
    responseId: string,
    analysis: ResponseAnalysis,
    codeQualityAnalysis?: any
  ) {
    const aiAnalysis = {
      ...analysis,
      codeQuality: codeQualityAnalysis
    };

    const { data, error } = await supabase
      .from('interview_responses_detailed')
      .update({
        ai_analysis: aiAnalysis,
        score: analysis.overallScore,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        follow_up_generated: analysis.needsFollowUp
      })
      .eq('id', responseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async generateAndSaveFollowUp(
    sessionId: string,
    questionId: string,
    responseId: string,
    originalQuestion: string,
    userResponse: string,
    analysis: ResponseAnalysis
  ) {
    if (!analysis.needsFollowUp) return null;

    const followUpText = await adaptiveQuestionService.generateFollowUpQuestion(
      originalQuestion,
      userResponse,
      analysis
    );

    const { data: responses } = await supabase
      .from('follow_up_questions')
      .select('depth_level')
      .eq('session_id', sessionId)
      .eq('parent_question_id', questionId);

    const maxDepth = responses?.length ? Math.max(...responses.map(r => r.depth_level)) : 0;

    const { data, error } = await supabase
      .from('follow_up_questions')
      .insert({
        session_id: sessionId,
        parent_question_id: questionId,
        parent_response_id: responseId,
        follow_up_text: followUpText,
        reason_for_followup: analysis.followUpReason || 'Probing deeper understanding',
        depth_level: maxDepth + 1,
        asked_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async saveFollowUpResponse(followUpId: string, response: string) {
    const { data, error } = await supabase
      .from('follow_up_questions')
      .update({ response })
      .eq('id', followUpId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSessionResponses(sessionId: string) {
    const { data, error } = await supabase
      .from('interview_responses_detailed')
      .select(`
        *,
        interview_questions_dynamic (
          question_text,
          question_type,
          related_project,
          difficulty_level
        )
      `)
      .eq('session_id', sessionId)
      .order('submitted_at');

    if (error) throw error;
    return data || [];
  }

  async getFollowUpQuestions(sessionId: string) {
    const { data, error } = await supabase
      .from('follow_up_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('asked_at');

    if (error) throw error;
    return data || [];
  }

  async getUserSessions(userId: string) {
    const { data, error } = await supabase
      .from('adaptive_interview_sessions')
      .select(`
        *,
        interview_resumes (
          original_filename,
          experience_level
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private parseJSONResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch {
      return {};
    }
  }

  private createDefaultAnalysis(): ResponseAnalysis {
    return {
      clarity: 50,
      technicalDepth: 50,
      completeness: 50,
      accuracy: 50,
      overallScore: 50,
      strengths: ['Attempted to answer the question'],
      weaknesses: ['Could provide more technical depth'],
      suggestions: ['Elaborate on technical concepts', 'Provide specific examples'],
      needsFollowUp: false
    };
  }
}

export const adaptiveInterviewSessionService = new AdaptiveInterviewSessionService();
