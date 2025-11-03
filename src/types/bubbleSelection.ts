export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type OperationType = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';
export type GameStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'completed' | 'failed';

export interface MathematicalExpression {
  id: string;
  expression: string;
  result: number;
  operationType: OperationType;
  hasDecimals: boolean;
  complexityScore: number;
}

export interface BubbleData {
  id: string;
  expression: MathematicalExpression;
  index: number;
  isSelected: boolean;
  selectionOrder?: number;
  isCorrect?: boolean;
}

export interface QuestionData {
  questionNumber: number;
  sectionNumber: number;
  difficultyLevel: DifficultyLevel;
  bubbles: BubbleData[];
  correctSequence: number[];
  timeLimit: number;
  timeTaken: number;
  userSequence: number[];
  isCorrect: boolean;
  scoreEarned: number;
}

export interface BubbleSelectionSession {
  id: string;
  user_id: string;
  session_token: string;
  difficulty_level: string;
  total_questions: number;
  current_section: number;
  questions_answered: number;
  correct_answers: number;
  start_time: string;
  end_time?: string;
  total_time_seconds: number;
  final_score: number;
  is_completed: boolean;
  created_at: string;
}

export interface BubbleSelectionQuestion {
  id: string;
  session_id: string;
  question_number: number;
  section_number: number;
  difficulty_level: DifficultyLevel;
  expressions: MathematicalExpression[];
  correct_sequence: number[];
  user_sequence: number[];
  time_limit_seconds: number;
  time_taken_seconds: number;
  is_correct: boolean;
  score_earned: number;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  best_score: number;
  best_time_seconds: number;
  best_accuracy_percentage: number;
  total_games_played: number;
  total_questions_answered: number;
  total_correct_answers: number;
  average_score: number;
  highest_streak: number;
  period: 'daily' | 'weekly' | 'all_time';
  rank: number;
  updated_at: string;
  created_at: string;
  user_name?: string;
}

export interface GameState {
  status: GameStatus;
  currentQuestion: QuestionData | null;
  questionNumber: number;
  sectionNumber: number;
  totalQuestions: number;
  score: number;
  correctAnswers: number;
  streak: number;
  timeRemaining: number;
  selectedBubbles: number[];
  isValidating: boolean;
}

export interface ScoreCalculation {
  baseScore: number;
  timeBonus: number;
  difficultyMultiplier: number;
  finalScore: number;
  accuracy: number;
}

export interface PerformanceMetrics {
  totalTime: number;
  averageTimePerQuestion: number;
  accuracy: number;
  correctAnswers: number;
  totalQuestions: number;
  bestStreak: number;
  scoreBreakdown: {
    totalScore: number;
    baseScore: number;
    timeBonus: number;
    difficultyBonus: number;
  };
}

export interface AdaptiveDifficultyConfig {
  sectionNumber: number;
  questionNumber: number;
  difficultyLevel: DifficultyLevel;
  bubbleCount: number;
  timeLimit: number;
  allowDecimals: boolean;
  operationTypes: OperationType[];
  valueRange: {
    min: number;
    max: number;
  };
}
