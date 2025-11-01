import { supabase } from '../lib/supabaseClient';

export interface InterviewSessionState {
  sessionId: string;
  userId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  timeRemaining: number;
  currentTranscript: string;
  textAnswer: string;
  codeAnswer: string;
  selectedLanguage: string;
  questionsAnswered: number;
  questionsSkipped: number;
  lastSaved: string;
  interviewType: 'realistic' | 'smart' | 'adaptive';
}

const SESSION_STORAGE_KEY = 'interview_session_state';
const AUTO_SAVE_INTERVAL = 30000;

class InterviewSessionPersistenceService {
  private autoSaveTimer: NodeJS.Timeout | null = null;

  async saveSessionState(state: InterviewSessionState): Promise<void> {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        ...state,
        lastSaved: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('interview_session_backups')
        .upsert({
          session_id: state.sessionId,
          user_id: state.userId,
          current_question_index: state.currentQuestionIndex,
          total_questions: state.totalQuestions,
          time_remaining: state.timeRemaining,
          current_transcript: state.currentTranscript,
          text_answer: state.textAnswer,
          code_answer: state.codeAnswer,
          selected_language: state.selectedLanguage,
          questions_answered: state.questionsAnswered,
          questions_skipped: state.questionsSkipped,
          interview_type: state.interviewType,
          last_saved: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id'
        });

      if (error) {
        console.error('Error saving session to database:', error);
      }
    } catch (error) {
      console.error('Error saving session state:', error);
    }
  }

  async loadSessionState(sessionId: string): Promise<InterviewSessionState | null> {
    try {
      const localState = localStorage.getItem(SESSION_STORAGE_KEY);

      if (localState) {
        const parsedState = JSON.parse(localState) as InterviewSessionState;
        if (parsedState.sessionId === sessionId) {
          return parsedState;
        }
      }

      const { data, error } = await supabase
        .from('interview_session_backups')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        sessionId: data.session_id,
        userId: data.user_id,
        currentQuestionIndex: data.current_question_index,
        totalQuestions: data.total_questions,
        timeRemaining: data.time_remaining,
        currentTranscript: data.current_transcript || '',
        textAnswer: data.text_answer || '',
        codeAnswer: data.code_answer || '',
        selectedLanguage: data.selected_language || 'Python',
        questionsAnswered: data.questions_answered || 0,
        questionsSkipped: data.questions_skipped || 0,
        lastSaved: data.last_saved,
        interviewType: data.interview_type
      };
    } catch (error) {
      console.error('Error loading session state:', error);
      return null;
    }
  }

  async clearSessionState(sessionId: string): Promise<void> {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);

      await supabase
        .from('interview_session_backups')
        .delete()
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error clearing session state:', error);
    }
  }

  startAutoSave(getState: () => InterviewSessionState): void {
    this.stopAutoSave();

    this.autoSaveTimer = setInterval(() => {
      const state = getState();
      this.saveSessionState(state);
    }, AUTO_SAVE_INTERVAL);
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  async checkForRecoverableSession(
    userId: string,
    interviewType: 'realistic' | 'smart' | 'adaptive'
  ): Promise<InterviewSessionState | null> {
    try {
      const { data, error } = await supabase
        .from('interview_session_backups')
        .select('*')
        .eq('user_id', userId)
        .eq('interview_type', interviewType)
        .order('last_saved', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      const lastSaved = new Date(data.last_saved);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        await this.clearSessionState(data.session_id);
        return null;
      }

      return {
        sessionId: data.session_id,
        userId: data.user_id,
        currentQuestionIndex: data.current_question_index,
        totalQuestions: data.total_questions,
        timeRemaining: data.time_remaining,
        currentTranscript: data.current_transcript || '',
        textAnswer: data.text_answer || '',
        codeAnswer: data.code_answer || '',
        selectedLanguage: data.selected_language || 'Python',
        questionsAnswered: data.questions_answered || 0,
        questionsSkipped: data.questions_skipped || 0,
        lastSaved: data.last_saved,
        interviewType: data.interview_type
      };
    } catch (error) {
      console.error('Error checking for recoverable session:', error);
      return null;
    }
  }
}

export const interviewSessionPersistence = new InterviewSessionPersistenceService();
