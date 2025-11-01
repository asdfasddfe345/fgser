import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Key, DoorOpen, User, Clock, Trophy, RotateCcw, X } from 'lucide-react';
import {
  MazeGrid,
  Position,
  Direction,
  KeyFinderGameState
} from '../../types/keyFinder';
import { keyFinderService } from '../../services/keyFinderService';

interface KeyFinderGameProps {
  difficulty: 'easy' | 'medium' | 'hard';
  userId: string;
  onGameComplete: (score: number, time: number, moves: number) => void;
  onGameExit: () => void;
}

export const KeyFinderGame: React.FC<KeyFinderGameProps> = ({
  difficulty,
  userId,
  onGameComplete,
  onGameExit
}) => {
  const [maze, setMaze] = useState<MazeGrid | null>(null);
  const [gameState, setGameState] = useState<KeyFinderGameState>({
    status: 'instructions',
    phase: 'finding_key',
    playerPosition: { row: 0, col: 0 },
    hasKey: false,
    timeRemaining: 300,
    totalMoves: 0,
    restartCount: 0,
    visitedCells: new Set<string>(),
    lastCollisionDirection: null
  });
  const [sessionId, setSessionId] = useState<string>('');
  const [instructionPage, setInstructionPage] = useState(0);
  const [showCollisionFeedback, setShowCollisionFeedback] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const collisionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const instructions = [
    {
      title: "Navigate the Hidden Maze",
      text: "In this exercise, you must move between boxes in a grid that contains a maze of invisible walls. You can navigate up, down, left or right, but NOT diagonally. You cannot move across one box at a time."
    },
    {
      title: "Memory Challenge",
      text: "Each time you hit a wall, you will be returned back to the beginning of the maze and must start over. The walls do not move, but you must remember where they are."
    },
    {
      title: "Complete the Objective",
      text: "Your goal is to collect the key and reach the door in the least number of attempts."
    }
  ];

  useEffect(() => {
    initializeGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (collisionTimeoutRef.current) clearTimeout(collisionTimeoutRef.current);
    };
  }, [difficulty]);

  useEffect(() => {
    if (gameState.status === 'playing') {
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [gameState.status, gameState.playerPosition, gameState.hasKey, maze]);

  const initializeGame = async () => {
    const newMaze = keyFinderService.generateMaze(difficulty);
    setMaze(newMaze);

    const config = keyFinderService.getDifficultyConfig(difficulty);

    setGameState({
      status: 'instructions',
      phase: 'finding_key',
      playerPosition: newMaze.startPosition,
      hasKey: false,
      timeRemaining: config.timeLimitSeconds,
      totalMoves: 0,
      restartCount: 0,
      visitedCells: new Set([`${newMaze.startPosition.row},${newMaze.startPosition.col}`]),
      lastCollisionDirection: null
    });
  };

  const startGame = async () => {
    if (!maze) return;

    try {
      const session = await keyFinderService.createSession(userId, difficulty, maze);
      setSessionId(session.id);

      setGameState(prev => ({ ...prev, status: 'playing' }));

      timerRef.current = setInterval(() => {
        setGameState(prev => {
          const newTime = prev.timeRemaining - 1;
          if (newTime <= 0) {
            handleGameTimeout();
            return { ...prev, timeRemaining: 0, status: 'failed' };
          }
          return { ...prev, timeRemaining: newTime };
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  const handleGameTimeout = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.status !== 'playing' || !maze) return;

    let direction: Direction | null = null;

    switch (event.key) {
      case 'ArrowUp':
        direction = 'up';
        break;
      case 'ArrowDown':
        direction = 'down';
        break;
      case 'ArrowLeft':
        direction = 'left';
        break;
      case 'ArrowRight':
        direction = 'right';
        break;
      default:
        return;
    }

    event.preventDefault();
    handleMove(direction);
  }, [gameState.status, gameState.playerPosition, gameState.hasKey, maze]);

  const handleMove = async (direction: Direction) => {
    if (!maze) return;

    const moveResult = keyFinderService.canMove(gameState.playerPosition, direction, maze);

    if (moveResult.hitWall) {
      handleCollision(direction);
      return;
    }

    if (moveResult.newPosition) {
      const newPos = moveResult.newPosition;
      const newMoves = gameState.totalMoves + 1;
      const cellKey = `${newPos.row},${newPos.col}`;
      const newVisited = new Set(gameState.visitedCells);
      newVisited.add(cellKey);

      await keyFinderService.recordMove(
        sessionId,
        newMoves,
        gameState.playerPosition,
        newPos,
        direction,
        false,
        false
      );

      const reachedKey = !gameState.hasKey &&
        newPos.row === maze.keyPosition.row &&
        newPos.col === maze.keyPosition.col;

      const reachedExit = gameState.hasKey &&
        newPos.row === maze.exitPosition.row &&
        newPos.col === maze.exitPosition.col;

      if (reachedKey) {
        setGameState(prev => ({
          ...prev,
          playerPosition: newPos,
          hasKey: true,
          phase: 'finding_exit',
          totalMoves: newMoves,
          visitedCells: newVisited
        }));
      } else if (reachedExit) {
        completeGame(newMoves);
      } else {
        setGameState(prev => ({
          ...prev,
          playerPosition: newPos,
          totalMoves: newMoves,
          visitedCells: newVisited
        }));
      }
    }
  };

  const handleCollision = async (direction: Direction) => {
    if (!maze) return;

    setShowCollisionFeedback(true);
    setGameState(prev => ({ ...prev, lastCollisionDirection: direction }));

    if (collisionTimeoutRef.current) {
      clearTimeout(collisionTimeoutRef.current);
    }

    collisionTimeoutRef.current = setTimeout(() => {
      setShowCollisionFeedback(false);
      setGameState(prev => ({ ...prev, lastCollisionDirection: null }));
    }, 500);

    const newRestartCount = gameState.restartCount + 1;
    const newMoves = gameState.totalMoves + 1;

    await keyFinderService.recordMove(
      sessionId,
      newMoves,
      gameState.playerPosition,
      gameState.playerPosition,
      direction,
      true,
      true
    );

    setGameState(prev => ({
      ...prev,
      playerPosition: maze.startPosition,
      hasKey: false,
      phase: 'finding_key',
      totalMoves: newMoves,
      restartCount: newRestartCount,
      visitedCells: new Set([`${maze.startPosition.row},${maze.startPosition.col}`])
    }));
  };

  const completeGame = async (finalMoves: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!maze) return;

    const config = keyFinderService.getDifficultyConfig(difficulty);
    const completionTime = config.timeLimitSeconds - gameState.timeRemaining;

    const scoreResult = keyFinderService.calculateScore(
      completionTime,
      config.timeLimitSeconds,
      finalMoves,
      maze.optimalPathLength,
      gameState.restartCount
    );

    setGameState(prev => ({ ...prev, status: 'completed' }));

    try {
      await keyFinderService.completeSession(
        sessionId,
        scoreResult.finalScore,
        finalMoves,
        gameState.restartCount,
        gameState.restartCount,
        gameState.timeRemaining
      );

      await keyFinderService.updateLeaderboard(
        userId,
        difficulty,
        completionTime,
        finalMoves,
        scoreResult.finalScore,
        gameState.restartCount
      );

      onGameComplete(scoreResult.finalScore, completionTime, finalMoves);
    } catch (error) {
      console.error('Error completing game:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    initializeGame();
  };

  const renderGrid = () => {
    if (!maze) return null;

    const playerRow = gameState.playerPosition.row;
    const playerCol = gameState.playerPosition.col;

    const visibleSize = 3;
    const offset = Math.floor(visibleSize / 2);

    const cells = [];
    for (let i = 0; i < visibleSize; i++) {
      for (let j = 0; j < visibleSize; j++) {
        const actualRow = playerRow - offset + i;
        const actualCol = playerCol - offset + j;
        const isPlayerCell = i === offset && j === offset;
        const isWithinBounds = actualRow >= 0 && actualRow < maze.gridSize &&
          actualCol >= 0 && actualCol < maze.gridSize;

        const cellKey = `${actualRow},${actualCol}`;
        const isVisited = gameState.visitedCells.has(cellKey);

        const isKeyHere = !gameState.hasKey &&
          actualRow === maze.keyPosition.row &&
          actualCol === maze.keyPosition.col;

        const isExitHere = actualRow === maze.exitPosition.row &&
          actualCol === maze.exitPosition.col;

        cells.push(
          <div
            key={`${i}-${j}`}
            className={`
              relative aspect-square border-2 rounded-lg transition-all duration-200
              ${isPlayerCell
                ? 'bg-gray-700 border-gray-600'
                : isVisited && isWithinBounds
                  ? 'bg-gray-600 border-gray-500'
                  : 'bg-gray-300 border-gray-400'
              }
            `}
          >
            {isPlayerCell && (
              <div className="absolute inset-0 flex items-center justify-center">
                <User className="w-12 h-12 text-gray-200" />
                {gameState.hasKey && (
                  <Key className="w-6 h-6 text-yellow-400 absolute top-1 right-1" />
                )}
              </div>
            )}

            {isKeyHere && !gameState.hasKey && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Key className="w-10 h-10 text-yellow-400" />
              </div>
            )}

            {isExitHere && (
              <div className="absolute inset-0 flex items-center justify-center">
                <DoorOpen className="w-10 h-10 text-gray-800" />
              </div>
            )}

            {isPlayerCell && !isKeyHere && !isExitHere && (
              <>
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-500 opacity-30"></div>
                </div>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-500 opacity-30"></div>
                </div>
                <div className="absolute -left-2 top-1/2 transform -translate-y-1/2">
                  <div className="w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-gray-500 opacity-30"></div>
                </div>
                <div className="absolute -right-2 top-1/2 transform -translate-y-1/2">
                  <div className="w-0 h-0 border-t-8 border-b-8 border-l-8 border-transparent border-l-gray-500 opacity-30"></div>
                </div>
              </>
            )}

            {showCollisionFeedback && isPlayerCell && gameState.lastCollisionDirection && (
              <div className={`
                absolute bg-red-500 transition-opacity duration-300
                ${gameState.lastCollisionDirection === 'up' ? 'top-0 left-0 right-0 h-1' : ''}
                ${gameState.lastCollisionDirection === 'down' ? 'bottom-0 left-0 right-0 h-1' : ''}
                ${gameState.lastCollisionDirection === 'left' ? 'left-0 top-0 bottom-0 w-1' : ''}
                ${gameState.lastCollisionDirection === 'right' ? 'right-0 top-0 bottom-0 w-1' : ''}
              `} />
            )}
          </div>
        );
      }
    }

    return cells;
  };

  if (!maze) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-dark-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Generating maze...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-50 p-4 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Accenture Key Finder
            </h1>
            <p className="text-gray-600 dark:text-gray-400 capitalize">
              {difficulty} Mode
            </p>
          </div>
          <button
            onClick={onGameExit}
            className="p-2 hover:bg-gray-200 dark:hover:bg-dark-200 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-dark-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Time</span>
                </div>
                <p className={`text-xl font-bold ${
                  gameState.timeRemaining < 30 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {formatTime(gameState.timeRemaining)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-dark-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <Trophy className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Moves</span>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {gameState.totalMoves}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-dark-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <RotateCcw className="w-4 h-4 text-orange-600" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Restarts</span>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {gameState.restartCount}
                </p>
              </div>
            </div>

            <div className="relative">
              <div
                className="grid gap-2 mx-auto mb-6"
                style={{
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  maxWidth: '400px'
                }}
              >
                {renderGrid()}
              </div>

              <div className="text-center mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {gameState.phase === 'finding_key' ? (
                    <>Collect <Key className="inline w-4 h-4 text-yellow-500 mx-1" /> 1 KEY</>
                  ) : (
                    <>Get to the <DoorOpen className="inline w-4 h-4 text-gray-700 mx-1" /> DOOR</>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Use arrow keys to navigate
                </p>
              </div>

              {gameState.status === 'instructions' && (
                <div className="bg-white/95 dark:bg-dark-100/95 rounded-lg p-6 border-2 border-gray-200 dark:border-dark-200">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
                    {instructions[instructionPage].title}
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
                    {instructions[instructionPage].text}
                  </p>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setInstructionPage(Math.max(0, instructionPage - 1))}
                      disabled={instructionPage === 0}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>

                    <div className="flex space-x-2">
                      {instructions.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2 w-2 rounded-full transition-colors ${
                            idx === instructionPage
                              ? 'bg-blue-600'
                              : 'bg-gray-300 dark:bg-dark-300'
                          }`}
                        />
                      ))}
                    </div>

                    {instructionPage < instructions.length - 1 ? (
                      <button
                        onClick={() => setInstructionPage(instructionPage + 1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </button>
                    ) : (
                      <button
                        onClick={startGame}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        Start Game
                      </button>
                    )}
                  </div>
                </div>
              )}

              {gameState.status === 'ready' && (
                <div className="text-center">
                  <button
                    onClick={startGame}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Start Game
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {gameState.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                className="bg-white dark:bg-dark-100 rounded-2xl p-8 max-w-md w-full text-center"
              >
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Maze Complete!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You found the key and reached the exit!
                </p>
                <div className="space-y-2 mb-6 text-left bg-gray-50 dark:bg-dark-200 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Moves:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {gameState.totalMoves}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Restarts:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {gameState.restartCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Time:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {formatTime(
                        keyFinderService.getDifficultyConfig(difficulty).timeLimitSeconds -
                        gameState.timeRemaining
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={resetGame}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={onGameExit}
                    className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Exit
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState.status === 'failed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                className="bg-white dark:bg-dark-100 rounded-2xl p-8 max-w-md w-full text-center"
              >
                <Clock className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Time's Up!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You ran out of time. Try again to improve your speed!
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={resetGame}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onGameExit}
                    className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Exit
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
