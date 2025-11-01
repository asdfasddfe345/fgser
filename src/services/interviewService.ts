import { supabase } from '../lib/supabaseClient';
import { hybridQuestionService } from './hybridQuestionService';
import {
  InterviewQuestion,
  MockInterviewSession,
  InterviewResponse,
  InterviewConfig,
  QuestionCategory,
  InterviewSessionWithQuestions,
  AIFeedback
} from '../types/interview';
import { UserResume } from '../types/resumeInterview';

export class InterviewService {
  async getQuestionsByCategory(
    category: QuestionCategory,
    limit: number = 10,
    companyName?: string
  ): Promise<InterviewQuestion[]> {
    let query = supabase
      .from('interview_questions')
      .select('*')
      .eq('is_active', true)
      .eq('category', category);

    if (companyName) {
      query = query.or(`interview_type.eq.general,and(interview_type.eq.company-specific,company_name.eq.${companyName})`);
    } else {
      query = query.eq('interview_type', 'general');
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching interview questions:', error);
      throw new Error(`Failed to fetch interview questions: ${error.message}`);
    }

    return data || [];
  }

  async getMixedQuestions(
    categories: QuestionCategory[],
    limit: number = 10,
    companyName?: string,
    resume?: UserResume,
    config?: InterviewConfig
  ): Promise<InterviewQuestion[]> {
    if (resume && config) {
      return await hybridQuestionService.selectQuestionsForInterview(config, resume, limit);
    }

    const questionsPerCategory = Math.ceil(limit / categories.length);
    const allQuestions: InterviewQuestion[] = [];

    for (const category of categories) {
      const questions = await this.getQuestionsByCategory(category, questionsPerCategory, companyName);
      allQuestions.push(...questions);
    }

    return allQuestions.slice(0, limit);
  }

  async createSession(config: InterviewConfig, userId: string, resume?: UserResume): Promise<MockInterviewSession> {
    const sessionData = {
      user_id: userId,
      session_type: config.sessionType,
      interview_category: config.interviewCategory,
      company_name: config.companyName,
      target_role: config.targetRole,
      domain: config.domain,
      duration_minutes: config.durationMinutes,
      status: 'in_progress' as const,
      started_at: new Date().toISOString(),
      resume_id: resume?.id,
      question_generation_mode: resume ? 'hybrid' : 'database_only',
      database_questions_count: 0,
      ai_generated_questions_count: 0
    };

    const { data, error } = await supabase
      .from('mock_interview_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) {
      console.error('Error creating interview session:', error);
      throw new Error(`Failed to create interview session: ${error.message}`);
    }

    return data;
  }

  async getSession(sessionId: string): Promise<MockInterviewSession | null> {
    const { data, error } = await supabase
      .from('mock_interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching interview session:', error);
      throw new Error(`Failed to fetch interview session: ${error.message}`);
    }

    return data;
  }

  async getSessionWithDetails(sessionId: string): Promise<InterviewSessionWithQuestions | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const { data: responses, error: responsesError } = await supabase
      .from('interview_responses')
      .select(`
        *,
        question:interview_questions(*)
      `)
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true });

    if (responsesError) {
      console.error('Error fetching interview responses:', responsesError);
      throw new Error(`Failed to fetch interview responses: ${responsesError.message}`);
    }

    const questions = responses?.map((r: any) => r.question).filter(Boolean) || [];
    const responsesData = responses?.map((r: any) => {
      const { question, ...responseData } = r;
      return responseData;
    }) || [];

    return {
      ...session,
      questions,
      responses: responsesData
    };
  }

  async getUserSessions(userId: string, limit: number = 20): Promise<MockInterviewSession[]> {
    const { data, error } = await supabase
      .from('mock_interview_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user sessions:', error);
      throw new Error(`Failed to fetch user sessions: ${error.message}`);
    }

    return data || [];
  }

  async saveResponse(
    sessionId: string,
    questionId: string,
    questionOrder: number,
    responseData: {
      userAnswerText?: string;
      audioUrl?: string;
      videoUrl?: string;
      audioTranscript?: string;
      aiFeedback?: AIFeedback;
      individualScore?: number;
      toneRating?: string;
      confidenceRating?: number;
      responseDuration?: number;
      resumeRelevanceScore?: number;
      validatesResumeClaim?: boolean;
      resumeSkillValidated?: string;
      credibilityScore?: number;
    }
  ): Promise<InterviewResponse> {
    const dataToInsert = {
      session_id: sessionId,
      question_id: questionId,
      question_order: questionOrder,
      user_answer_text: responseData.userAnswerText,
      audio_url: responseData.audioUrl,
      video_url: responseData.videoUrl,
      audio_transcript: responseData.audioTranscript,
      ai_feedback_json: responseData.aiFeedback,
      individual_score: responseData.individualScore,
      tone_rating: responseData.toneRating,
      confidence_rating: responseData.confidenceRating,
      response_duration_seconds: responseData.responseDuration,
      resume_relevance_score: responseData.resumeRelevanceScore,
      validates_resume_claim: responseData.validatesResumeClaim,
      resume_skill_validated: responseData.resumeSkillValidated,
      credibility_score: responseData.credibilityScore
    };

    const { data, error } = await supabase
      .from('interview_responses')
      .upsert(dataToInsert, {
        onConflict: 'session_id,question_order'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving interview response:', error);
      throw new Error(`Failed to save interview response: ${error.message}`);
    }

    return data;
  }

  async updateSessionStatus(
    sessionId: string,
    status: 'in_progress' | 'completed' | 'abandoned' | 'paused',
    overallScore?: number,
    actualDuration?: number
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (overallScore !== undefined) {
      updateData.overall_score = overallScore;
    }

    if (actualDuration !== undefined) {
      updateData.actual_duration_seconds = actualDuration;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('mock_interview_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session status:', error);
      throw new Error(`Failed to update session status: ${error.message}`);
    }
  }

  async uploadRecording(
    userId: string,
    sessionId: string,
    questionOrder: number,
    file: Blob,
    type: 'audio' | 'video'
  ): Promise<string> {
    const fileExtension = type === 'audio' ? 'webm' : 'mp4';
    const filePath = `${userId}/${sessionId}/q${questionOrder}_${type}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from('interview-recordings')
      .upload(filePath, file, {
        contentType: type === 'audio' ? 'audio/webm' : 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading recording:', uploadError);
      throw new Error(`Failed to upload recording: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('interview-recordings')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async getSessionResponses(sessionId: string): Promise<InterviewResponse[]> {
    const { data, error } = await supabase
      .from('interview_responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true });

    if (error) {
      console.error('Error fetching session responses:', error);
      throw new Error(`Failed to fetch session responses: ${error.message}`);
    }

    return data || [];
  }

  async calculateOverallScore(sessionId: string): Promise<number> {
    const responses = await this.getSessionResponses(sessionId);

    if (responses.length === 0) return 0;

    const totalScore = responses.reduce((sum, response) => {
      return sum + (response.individual_score || 0);
    }, 0);

    return Math.round((totalScore / responses.length) * 10);
  }

  async updateSessionWithSecurity(
    sessionId: string,
    status: 'in_progress' | 'completed' | 'abandoned' | 'paused',
    overallScore: number,
    actualDuration: number,
    securityData: {
      tabSwitchCount: number;
      fullScreenExits: number;
      totalViolationTime: number;
      violationsLog: Array<{
        type: string;
        timestamp: number;
        duration: number;
      }>;
    }
  ): Promise<void> {
    const securityScore = this.calculateSecurityScore(
      securityData.tabSwitchCount,
      securityData.fullScreenExits,
      securityData.totalViolationTime
    );

    const updateData: any = {
      status,
      overall_score: overallScore,
      actual_duration_seconds: actualDuration,
      tab_switches_count: securityData.tabSwitchCount,
      fullscreen_exits_count: securityData.fullScreenExits,
      total_violation_time: securityData.totalViolationTime,
      violations_log: securityData.violationsLog,
      security_score: securityScore,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('mock_interview_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session with security data:', error);
      throw new Error(`Failed to update session with security data: ${error.message}`);
    }
  }

  private calculateSecurityScore(
    tabSwitches: number,
    fullScreenExits: number,
    violationTime: number
  ): number {
    let score = 100;

    score -= tabSwitches * 5;
    score -= fullScreenExits * 10;
    score -= Math.floor(violationTime / 10) * 2;

    return Math.max(0, Math.min(100, score));
  }
}

export const interviewService = new InterviewService();
