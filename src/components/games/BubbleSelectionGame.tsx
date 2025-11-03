import React, { useState, useEffect, useRef } from 'react';
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
  
  // Refs to avoid closure issues
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const sessionRef = useRef<BubbleSelectionSession | null>(null);
  const currentQuestionIdRef = useRef<string | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const questionStartTimeRef = useRef<number>(0);

  // Keep refs in sync with state
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    currentQuestionIdRef.current = currentQuestionId;
  }, [currentQuestionId]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    questionStartTimeRef.current = questionStartTime;
  }, [questionStartTime]);

  // Timer effect - FIXED VERSION
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Only start timer if actively playing and not validating
    if (gameState.status === 'playing' && !gameState.isValidating && gameState.timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          // Safety check
          if (prev.isValidating || prev.status !== 'playing') {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return prev;
          }
          
          const newTime = prev.timeRemaining - 1;
          
          // When timer reaches 0, trigger timeout immediately
          if (newTime <= 0) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            // Only process if not already processing
            if (!isProcessingRef.current) {
              isProcessingRef.current = true;
              // Trigger timeout in next tick
              Promise.resolve().then(() => handleTimeout());
            }
            
            return { ...prev, timeRemaining: 0, isValidating: true };
          }
          
          return { ...prev, timeRemaining: newTime };
        });
      }, 1000);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState.status, gameState.isValidating, gameState.questionNumber]);

  // Safety mechanism: Force timeout if timer is stuck at 0
  useEffect(() => {
    if (gameState.timeRemaining === 0 && 
        gameState.status === 'playing' && 
        !gameState.isValidating && 
        !isProcessingRef.current) {
      console.log('Safety timeout trigger activated!');
      isProcessingRef.current = true;
      handleTimeout();
    }
  }, [gameState.timeRemaining, gameState.status, gameState.isValidating]);

  const startGame = async () => {
    try {
      const newSession = await bubbleSelectionService.createSession(userId);
      setSession(newSession);
      sessionRef.current = newSession;
      setShowInstructions(false);
      await loadNextQuestion(newSession.id, 1);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const loadNextQuestion = async (sessionId: string, questionNumber: number) => {
    try {
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Reset processing flag
      isProcessingRef.current = false;
      setFeedback({ show: false, isCorrect: false, message: '' });

      const questionData = await bubbleSelectionService.generateQuestion(
        sessionId,
        questionNumber,
        userId
      );

      setCurrentQuestionId(questionData.id);
      currentQuestionIdRef.current = questionData.id;
      
      const startTime = Date.now();
      setQuestionStartTime(startTime);
      questionStartTimeRef.current = startTime;

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
      isProcessingRef.current = false;
    }
  };

  const handleBubbleClick = (bubbleIndex: number) => {
    if (gameState.status !== 'playing' || gameState.isValidating) return;
    if (gameState.selectedBubbles.includes(bubbleIndex)) return;
    if (gameState.timeRemaining <= 0) return;

    const newSelectedBubbles = [...gameState.selectedBubbles, bubbleIndex];

    setGameState(prev => {
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

      return {
        ...prev,
        selectedBubbles: newSelectedBubbles,
        currentQuestion: updatedQuestion
      };
    });

    // Check if all bubbles selected
    if (gameState.currentQuestion && newSelectedBubbles.length === gameState.currentQuestion.bubbles.length) {
      setTimeout(() => validateAnswer(newSelectedBubbles), 100);
    }
  };

  const validateAnswer = async (userSequence: number[]) => {
    const questionId = currentQuestionIdRef.current;
    const currentSession = sessionRef.current;
    
    if (!questionId || !currentSession || isProcessingRef.current) {
      console.log('Validation blocked:', { questionId, hasSession: !!currentSession, isProcessing: isProcessingRef.current });
      return;
    }
    
    isProcessingRef.current = true;

    setGameState(prev => ({ 
      ...prev, 
      isValidating: true
    }));

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const timeTaken = (Date.now() - questionStartTimeRef.current) / 1000;

    try {
      const { isCorrect, scoreEarned } = await bubbleSelectionService.submitAnswer(
        questionId,
        userSequence,
        timeTaken
      );

      const currentQuestion = gameStateRef.current.currentQuestion;
      if (!currentQuestion) {
        isProcessingRef.current = false;
        return;
      }

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
        isProcessingRef.current = false;
        proceedToNextQuestion();
      }, 2500);
    } catch (error) {
      console.error('Error validating answer:', error);
      setGameState(prev => ({ ...prev, isValidating: false }));
      isProcessingRef.current = false;
    }
  };

  const handleTimeout = async () => {
    console.log('=== TIMEOUT TRIGGERED ===');
    
    const questionId = currentQuestionIdRef.current;
    const currentSession = sessionRef.current;
    const currentGameState = gameStateRef.current;
    
    console.log('Timeout state:', {
      questionId,
      hasSession: !!currentSession,
      isProcessing: isProcessingRef.current,
      timeRemaining: currentGameState.timeRemaining
    });
    
    if (!questionId || !currentSession) {
      console.error('Missing questionId or session!');
      isProcessingRef.current = false;
      return;
    }

    // Force clear the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const timeLimit = currentGameState.currentQuestion?.timeLimit || 14;
      
      console.log('Submitting timeout answer...');
      
      // Submit as incorrect with empty or partial sequence
      await bubbleSelectionService.submitAnswer(
        questionId,
        currentGameState.selectedBubbles,
        timeLimit
      );

      console.log('Timeout answer submitted successfully');

      // Get correct answer to show
      const currentQuestion = currentGameState.currentQuestion;
      let correctAnswerMessage = "Time's up! Question missed.";
      
      if (currentQuestion) {
        const sortedExpressions = [...currentQuestion.bubbles]
          .sort((a, b) => a.expression.result - b.expression.result);
        correctAnswerMessage = `Time's up! Correct order: ${sortedExpressions.map(b => b.expression.result).join(' < ')}`;
      }

      setGameState(prev => ({
        ...prev,
        streak: 0,
        isValidating: true
      }));

      setFeedback({
        show: true,
        isCorrect: false,
        message: correctAnswerMessage
      });

      // Move to next question after showing feedback
      setTimeout(() => {
        console.log('Moving to next question after timeout');
        setFeedback({ show: false, isCorrect: false, message: '' });
        isProcessingRef.current = false;
        proceedToNextQuestion();
      }, 2500);
      
    } catch (error) {
      console.error('Error handling timeout:', error);
      isProcessingRef.current = false;
      setGameState(prev => ({ ...prev, isValidating: false }));
      
      // Force move to next question even on error
      setTimeout(() => {
        console.log('Force moving to next question after error');
        proceedToNextQuestion();
      }, 1000);
    }
  };

  const proceedToNextQuestion = () => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      console.log('No session found in proceedToNextQuestion');
      return;
    }

    const nextQuestionNumber = gameStateRef.current.questionNumber + 1;

    console.log('Proceeding to question:', nextQuestionNumber);

    if (nextQuestionNumber > gameStateRef.current.totalQuestions) {
      completeGame();
    } else {
      setTimeout(() => {
        loadNextQuestion(currentSession.id, nextQuestionNumber);
      }, 300);
    }
  };

  const completeGame = async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await bubbleSelectionService.completeSession(currentSession.id, userId);
      setGameState(prev => ({ ...prev, status: 'completed' }));
      onGameComplete(currentSession.id);
    } catch (error) {
      console.error('Error completing game:', error);
    }
  };

  const getTimerColor = () => {
    if (gameState.timeRemaining <= 3) return 'text-red-600';
    if (gameState.timeRemaining <= 7) return 'text-orange-500';
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
                <li>You'll see 3 mathematical expressions in bubbles</li>
                <li>Calculate each expression mentally</li>
                <li>Click the bubbles in order from LOWEST to HIGHEST value</li>
                <li>Complete each question within 14 seconds</li>
                <li>Answer 24 questions with increasing difficulty</li>
              </ol>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Questions 1-8</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Addition & Subtraction</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Questions 9-16</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Multiplication & Division</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Questions 17-24</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Complex operations & Square roots</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Challenge</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Always 3 bubbles, 14 seconds</p>
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
              {gameState.currentQuestion.bubbles.map((bubble, index) => (
                <motion.button
                  key={`q${gameState.questionNumber}-${bubble.id}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: bubble.isSelected ? 1 : 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleBubbleClick(bubble.index)}
                  disabled={bubble.isSelected || gameState.isValidating || gameState.timeRemaining <= 0}
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
