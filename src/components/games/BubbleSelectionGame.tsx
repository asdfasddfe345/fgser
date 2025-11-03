import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Target, TrendingUp, AlertCircle, Award, CheckCircle, XCircle } from 'lucide-react';
import { bubbleSelectionService } from '../../services/bubbleSelectionService';
import { adaptiveDifficultyService } from '../../services/adaptiveDifficultyService';
import {
  GameState,
  QuestionData,
  BubbleData,
  MathematicalExpression,
  BubbleSelectionSession,
  BubbleSelectionQuestion
} from '../../types/bubbleSelection';

interface BubbleSelectionGameProps {
  userId: string;
  onGameComplete: (sessionId: string) => void;
  onGameExit: () => void;
}

export const BubbleSelectionGame: React.FC<BubbleSelectionGameProps> = ({
  userId,
  onGameComplete,
  onGameExit
}) => {
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    currentQuestion: null,
    questionNumber: 0,
    sectionNumber: 1,
    totalQuestions: 24,
    score: 0,
    correctAnswers: 0,
    streak: 0,
    timeRemaining: 14,
    selectedBubbles: [],
    isValidating: false
  });

  const [session, setSession] = useState<BubbleSelectionSession | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ show: boolean; isCorrect: boolean; message: string }>({
    show: false,
    isCorrect: false,
    message: ''
  });
  const [showInstructions, setShowInstructions] = useState(true);
  
  // Use ref to track timer and prevent multiple timers
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Timer effect with proper cleanup
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Start new timer only if playing and time remaining
    if (gameState.status === 'playing' && gameState.timeRemaining > 0 && !gameState.isValidating) {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (prev.isValidating || prev.status !== 'playing') {
            return prev;
          }
          
          if (prev.timeRemaining <= 1) {
            // Timer expired
            if (!isProcessingRef.current) {
              isProcessingRef.current = true;
              handleTimeout();
            }
            return { ...prev, timeRemaining: 0, status: 'paused' };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState.status, gameState.questionNumber, gameState.isValidating]);

  const startGame = async () => {
    try {
      const newSession = await bubbleSelectionService.createSession(userId);
      setSession(newSession);
      setShowInstructions(false);
      await loadNextQuestion(newSession.id, 1);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const loadNextQuestion = async (sessionId: string, questionNumber: number) => {
    try {
      // Clear existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Reset processing flag
      isProcessingRef.current = false;

      // Clear feedback
      setFeedback({ show: false, isCorrect: false, message: '' });

      const questionData = await bubbleSelectionService.generateQuestion(
        sessionId,
        questionNumber,
        userId
      );

      setCurrentQuestionId(questionData.id);
      setQuestionStartTime(Date.now());

      const bubbles: BubbleData[] = questionData.expressions.map((expr, index) => ({
        id: expr.id,
        expression: expr,
        index,
        isSelected: false,
        selectionOrder: undefined
      }));

      const question: QuestionData = {
        questionNumber: questionData.question_number,
        sectionNumber: questionData.section_number,
        difficultyLevel: questionData.difficulty_level,
        bubbles,
        correctSequence: questionData.correct_sequence,
        timeLimit: questionData.time_limit_seconds,
        timeTaken: 0,
        userSequence: [],
        isCorrect: false,
        scoreEarned: 0
      };

      // Reset state completely for new question
      setGameState(prev => ({
        ...prev,
        status: 'playing',
        currentQuestion: question,
        questionNumber,
        sectionNumber: questionData.section_number,
        timeRemaining: questionData.time_limit_seconds,
        selectedBubbles: [],
        isValidating: false
      }));
    } catch (error) {
      console.error('Error loading question:', error);
    }
  };

  const handleBubbleClick = useCallback((bubbleIndex: number) => {
    setGameState(prev => {
      // Prevent clicks during validation or if not playing
      if (prev.status !== 'playing' || prev.isValidating) return prev;

      // Prevent selecting already selected bubble
      const alreadySelected = prev.selectedBubbles.includes(bubbleIndex);
      if (alreadySelected) return prev;

      const newSelectedBubbles = [...prev.selectedBubbles, bubbleIndex];

      const updatedQuestion = prev.currentQuestion
        ? {
            ...prev.currentQuestion,
            bubbles: prev.currentQuestion.bubbles.map(b =>
              b.index === bubbleIndex
                ? { ...b, isSelected: true, selectionOrder: newSelectedBubbles.length }
                : b
            )
          }
        : null;

      const newState = {
        ...prev,
        selectedBubbles: newSelectedBubbles,
        currentQuestion: updatedQuestion
      };

      // Check if all bubbles are selected
      if (updatedQuestion && newSelectedBubbles.length === updatedQuestion.bubbles.length) {
        // Trigger validation
        setTimeout(() => validateAnswer(newSelectedBubbles), 100);
      }

      return newState;
    });
  }, []);

  const validateAnswer = async (userSequence: number[]) => {
    if (!currentQuestionId || !session || isProcessingRef.current) return;
    
    isProcessingRef.current = true;

    setGameState(prev => ({ 
      ...prev, 
      isValidating: true,
      status: 'paused'
    }));

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const timeTaken = (Date.now() - questionStartTime) / 1000;

    try {
      const currentQuestion = gameState.currentQuestion;
      if (!currentQuestion) return;

      const { isCorrect, scoreEarned } = await bubbleSelectionService.submitAnswer(
        currentQuestionId,
        userSequence,
        timeTaken
      );

      const sortedExpressions = [...currentQuestion.bubbles]
        .sort((a, b) => a.expression.result - b.expression.result);

      setGameState(prev => ({
        ...prev,
        score: prev.score + scoreEarned,
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
        streak: isCorrect ? prev.streak + 1 : 0
      }));

      setFeedback({
        show: true,
        isCorrect,
        message: isCorrect
          ? `Correct! +${scoreEarned} points`
          : `Incorrect! The correct order was: ${sortedExpressions.map(b => b.expression.result).join(' < ')}`
      });

      setTimeout(() => {
        setFeedback({ show: false, isCorrect: false, message: '' });
        proceedToNextQuestion();
      }, 2000);
    } catch (error) {
      console.error('Error validating answer:', error);
      setGameState(prev => ({ ...prev, isValidating: false, status: 'playing' }));
      isProcessingRef.current = false;
    }
  };

  const handleTimeout = async () => {
    if (!currentQuestionId || isProcessingRef.current) return;

    isProcessingRef.current = true;

    setGameState(prev => ({ 
      ...prev, 
      isValidating: true,
      status: 'paused'
    }));

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await bubbleSelectionService.submitAnswer(
        currentQuestionId,
        gameState.selectedBubbles,
        gameState.currentQuestion?.timeLimit || 14
      );

      setFeedback({
        show: true,
        isCorrect: false,
        message: 'Time\'s up!'
      });

      setTimeout(() => {
        setFeedback({ show: false, isCorrect: false, message: '' });
        proceedToNextQuestion();
      }, 1500);
    } catch (error) {
      console.error('Error handling timeout:', error);
      isProcessingRef.current = false;
    }
  };

  const proceedToNextQuestion = () => {
    if (!session) return;

    const nextQuestionNumber = gameState.questionNumber + 1;

    if (nextQuestionNumber > gameState.totalQuestions) {
      completeGame();
    } else {
      // Small delay before loading next question
      setTimeout(() => {
        loadNextQuestion(session.id, nextQuestionNumber);
      }, 300);
    }
  };

  const completeGame = async () => {
    if (!session) return;

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await bubbleSelectionService.completeSession(session.id, userId);
      setGameState(prev => ({ ...prev, status: 'completed' }));
      onGameComplete(session.id);
    } catch (error) {
      console.error('Error completing game:', error);
    }
  };

  const getTimerColor = () => {
    if (gameState.timeRemaining <= 3) return 'text-red-600';
    if (gameState.timeRemaining <= 5) return 'text-orange-500';
    return 'text-blue-600';
  };

  const getDifficultyBadgeColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'hard': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (showInstructions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-dark-50 dark:via-dark-100 dark:to-dark-200 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-white dark:bg-dark-100 rounded-3xl shadow-2xl p-8 border-2 border-blue-200 dark:border-blue-800"
        >
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Bubble Selection Game
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Test Your Mental Math Speed
            </p>
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-blue-600" />
                How to Play
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>You'll see 3-5 mathematical expressions in bubbles</li>
                <li>Calculate each expression mentally</li>
                <li>Click the bubbles in order from LOWEST to HIGHEST value</li>
                <li>Complete each question within 14 seconds</li>
                <li>Answer 24 questions across 14 progressive sections</li>
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Questions 1-8</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Simple integer arithmetic</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Questions 9-16</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Mixed operations with decimals</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Questions 17-24</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Complex decimal calculations</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Adaptive</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Difficulty adjusts to your performance</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={startGame}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
            >
              Start Game
            </button>
            <button
              onClick={onGameExit}
              className="px-6 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Exit
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-dark-50 dark:via-dark-100 dark:to-dark-200 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-dark-100 rounded-3xl shadow-2xl p-6 md:p-8 border-2 border-blue-200 dark:border-blue-800">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Question</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {gameState.questionNumber} / {gameState.totalQuestions}
                  </span>
                </div>
                {gameState.currentQuestion && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyBadgeColor(gameState.currentQuestion.difficultyLevel)}`}>
                    {gameState.currentQuestion.difficultyLevel.toUpperCase()}
                  </span>
                )}
              </div>

              <div className={`flex items-center space-x-2 text-2xl font-bold ${getTimerColor()}`}>
                <Clock className="w-6 h-6" />
                <span>{gameState.timeRemaining}s</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(gameState.questionNumber / gameState.totalQuestions) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-1">
                <Award className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Score</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{gameState.score}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Correct</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{gameState.correctAnswers}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Streak</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{gameState.streak}</p>
            </div>
          </div>

          <div className="mb-6 text-center">
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select the bubbles in order from the <span className="text-blue-600 font-bold">LOWEST</span> to the <span className="text-purple-600 font-bold">HIGHEST</span> value
            </p>
          </div>

          {gameState.currentQuestion && (
            <div className="flex flex-wrap items-center justify-center gap-6 min-h-[300px]">
              <AnimatePresence mode="wait">
                {gameState.currentQuestion.bubbles.map((bubble, index) => (
                  <motion.button
                    key={`${gameState.questionNumber}-${bubble.id}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: bubble.isSelected ? 1 : 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleBubbleClick(bubble.index)}
                    disabled={bubble.isSelected || gameState.isValidating}
                    className={`relative w-32 h-32 rounded-full flex items-center justify-center text-2xl font-bold transition-all shadow-lg ${
                      bubble.isSelected
                        ? 'bg-gradient-to-br from-blue-400 to-purple-500 text-white cursor-not-allowed'
                        : 'bg-gradient-to-br from-white to-blue-50 dark:from-dark-200 dark:to-dark-300 text-gray-900 dark:text-gray-100 hover:shadow-xl cursor-pointer border-2 border-blue-200 dark:border-blue-700'
                    }`}
                  >
                    <span>{bubble.expression.expression}</span>
                    {bubble.isSelected && bubble.selectionOrder && (
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-bold text-gray-900">
                        {bubble.selectionOrder}
                      </div>
                    )}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}

          <AnimatePresence>
            {feedback.show && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`mt-6 p-4 rounded-xl ${
                  feedback.isCorrect
                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                    : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {feedback.isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                  <p className={`text-lg font-semibold ${feedback.isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {feedback.message}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default BubbleSelectionGame;
