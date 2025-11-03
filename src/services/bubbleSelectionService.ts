import { supabase } from '../lib/supabaseClient';
import {
  BubbleSelectionSession,
  BubbleSelectionQuestion,
  LeaderboardEntry,
  MathematicalExpression,
  DifficultyLevel,
  ScoreCalculation,
  PerformanceMetrics
} from '../types/bubbleSelection';
import { expressionGeneratorService } from './expressionGeneratorService';
import { adaptiveDifficultyService } from './adaptiveDifficultyService';

class BubbleSelectionService {
  async createSession(userId: string): Promise<BubbleSelectionSession> {
    const { data, error } = await supabase
      .from('bubble_selection_sessions')
      .insert({
        user_id: userId,
        difficulty_level: 'adaptive',
        total_questions: 24,
        current_section: 1,
        questions_answered: 0,
        correct_answers: 0,
        start_time: new Date().toISOString(),
        total_time_seconds: 0,
        final_score: 0,
        is_completed: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bubble selection session:', error);
      throw error;
    }

    return data;
  }

  async getSession(sessionId: string): Promise<BubbleSelectionSession | null> {
    const { data, error } = await supabase
      .from('bubble_selection_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching session:', error);
      throw error;
    }

    return data;
  }

  async updateSession(
    sessionId: string,
    updates: Partial<BubbleSelectionSession>
  ): Promise<void> {
    const { error } = await supabase
      .from('bubble_selection_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  async generateQuestion(
    sessionId: string,
    questionNumber: number,
    userId: string
  ): Promise<BubbleSelectionQuestion> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const questions = await this.getSessionQuestions(sessionId);
    const difficultyConfig = adaptiveDifficultyService.getDifficultyForQuestion(
      questionNumber,
      questions
    );

    const expressions = expressionGeneratorService.generateQuestionSet(
      questionNumber,
      difficultyConfig.sectionNumber,
      difficultyConfig.difficultyLevel,
      difficultyConfig.bubbleCount
    );

    const sortedExpressions = [...expressions].sort((a, b) => a.result - b.result);
    const correctSequence = expressions.map(expr =>
      sortedExpressions.findIndex(sorted => sorted.id === expr.id)
    );

    const { data, error } = await supabase
      .from('bubble_selection_questions')
      .insert({
        session_id: sessionId,
        question_number: questionNumber,
        section_number: difficultyConfig.sectionNumber,
        difficulty_level: difficultyConfig.difficultyLevel,
        expressions: expressions,
        correct_sequence: correctSequence,
        user_sequence: [],
        time_limit_seconds: difficultyConfig.timeLimit,
        time_taken_seconds: 0,
        is_correct: false,
        score_earned: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error generating question:', error);
      throw error;
    }

    return data;
  }

  async submitAnswer(
    questionId: string,
    userSequence: number[],
    timeTaken: number
  ): Promise<{ isCorrect: boolean; scoreEarned: number }> {
    const { data: question, error: fetchError } = await supabase
      .from('bubble_selection_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (fetchError || !question) {
      console.error('Error fetching question:', fetchError);
      throw fetchError;
    }

    const isCorrect = JSON.stringify(userSequence) === JSON.stringify(question.correct_sequence);

    const { data: scoreData } = await supabase.rpc('calculate_bubble_score', {
      p_time_taken: timeTaken,
      p_time_limit: question.time_limit_seconds,
      p_is_correct: isCorrect,
      p_difficulty_level: question.difficulty_level
    });

    const scoreEarned = scoreData || 0;

    const { error: updateError } = await supabase
      .from('bubble_selection_questions')
      .update({
        user_sequence: userSequence,
        time_taken_seconds: timeTaken,
        is_correct: isCorrect,
        score_earned: scoreEarned
      })
      .eq('id', questionId);

    if (updateError) {
      console.error('Error updating question:', updateError);
      throw updateError;
    }

    const session = await this.getSession(question.session_id);
    if (session) {
      await this.updateSession(question.session_id, {
        questions_answered: session.questions_answered + 1,
        correct_answers: session.correct_answers + (isCorrect ? 1 : 0),
        final_score: session.final_score + scoreEarned,
        total_time_seconds: session.total_time_seconds + Math.floor(timeTaken),
        current_section: Math.ceil((session.questions_answered + 1) / 2)
      });
    }

    return { isCorrect, scoreEarned };
  }

  async completeSession(sessionId: string, userId: string): Promise<void> {
    await this.updateSession(sessionId, {
      is_completed: true,
      end_time: new Date().toISOString()
    });

    await supabase.rpc('update_bubble_leaderboard', {
      p_user_id: userId,
      p_session_id: sessionId
    });
  }

  async getSessionQuestions(sessionId: string): Promise<BubbleSelectionQuestion[]> {
    const { data, error } = await supabase
      .from('bubble_selection_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number', { ascending: true });

    if (error) {
      console.error('Error fetching session questions:', error);
      throw error;
    }

    return data || [];
  }

  async getLeaderboard(
    period: 'daily' | 'weekly' | 'all_time' = 'all_time',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('bubble_selection_leaderboard')
      .select(`
        *,
        user_profiles!inner(full_name)
      `)
      .eq('period', period)
      .order('best_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }

    return (data || []).map((entry: any, index: number) => ({
      ...entry,
      rank: index + 1,
      user_name: entry.user_profiles?.full_name || 'Anonymous'
    }));
  }

  async getUserLeaderboardEntry(
    userId: string,
    period: 'daily' | 'weekly' | 'all_time' = 'all_time'
  ): Promise<LeaderboardEntry | null> {
    const { data, error } = await supabase
      .from('bubble_selection_leaderboard')
      .select(`
        *,
        user_profiles!inner(full_name)
      `)
      .eq('user_id', userId)
      .eq('period', period)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user leaderboard entry:', error);
      return null;
    }

    if (!data) return null;

    return {
      ...data,
      user_name: data.user_profiles?.full_name || 'Anonymous'
    };
  }

  async getPerformanceMetrics(sessionId: string): Promise<PerformanceMetrics> {
    const session = await this.getSession(sessionId);
    const questions = await this.getSessionQuestions(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    const totalTime = session.total_time_seconds;
    const averageTimePerQuestion = questions.length > 0
      ? totalTime / questions.length
      : 0;

    const accuracy = session.questions_answered > 0
      ? (session.correct_answers / session.questions_answered) * 100
      : 0;

    let currentStreak = 0;
    let bestStreak = 0;

    questions.forEach(q => {
      if (q.is_correct) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    const baseScore = questions.reduce((sum, q) => {
      if (q.is_correct) {
        return sum + 100;
      }
      return sum;
    }, 0);

    const timeBonus = questions.reduce((sum, q) => {
      if (q.is_correct && q.time_taken_seconds < q.time_limit_seconds) {
        return sum + Math.floor((q.time_limit_seconds - q.time_taken_seconds) * 5);
      }
      return sum;
    }, 0);

    const difficultyBonus = questions.reduce((sum, q) => {
      if (q.is_correct) {
        const multiplier = q.difficulty_level === 'hard' ? 2.0 : q.difficulty_level === 'medium' ? 1.5 : 1.0;
        return sum + Math.floor(100 * (multiplier - 1));
      }
      return sum;
    }, 0);

    return {
      totalTime,
      averageTimePerQuestion,
      accuracy,
      correctAnswers: session.correct_answers,
      totalQuestions: session.questions_answered,
      bestStreak,
      scoreBreakdown: {
        totalScore: session.final_score,
        baseScore,
        timeBonus,
        difficultyBonus
      }
    };
  }

  calculateScore(
    timeTaken: number,
    timeLimit: number,
    isCorrect: boolean,
    difficultyLevel: DifficultyLevel
  ): ScoreCalculation {
    const baseScore = 100;
    let timeBonus = 0;
    let difficultyMultiplier = 1.0;

    if (isCorrect) {
      if (timeTaken <= 3) {
        timeBonus = 50;
      } else if (timeTaken <= 5) {
        timeBonus = 30;
      } else if (timeTaken <= 7) {
        timeBonus = 15;
      } else if (timeTaken < timeLimit) {
        timeBonus = 5;
      }

      switch (difficultyLevel) {
        case 'easy':
          difficultyMultiplier = 1.0;
          break;
        case 'medium':
          difficultyMultiplier = 1.5;
          break;
        case 'hard':
          difficultyMultiplier = 2.0;
          break;
      }
    }

    const finalScore = isCorrect ? Math.floor((baseScore + timeBonus) * difficultyMultiplier) : 0;
    const accuracy = isCorrect ? 100 : 0;

    return {
      baseScore: isCorrect ? baseScore : 0,
      timeBonus: isCorrect ? timeBonus : 0,
      difficultyMultiplier,
      finalScore,
      accuracy
    };
  }
}

export const bubbleSelectionService = new BubbleSelectionService();
