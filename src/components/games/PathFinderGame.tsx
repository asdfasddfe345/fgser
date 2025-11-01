import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Trophy, Clock, Target, Zap, CheckCircle, XCircle } from 'lucide-react';
import { GameLevel, GamingCompany, Position, CellType, GameState, GridData } from '../../types/gaming';
import { gamingService } from '../../services/gamingService';

interface PathFinderGameProps {
  level: GameLevel;
  company: GamingCompany;
  userId: string;
  onGameComplete: (score: number, time: number, pathLength: number) => void;
  onGameExit: () => void;
}

export const PathFinderGame: React.FC<PathFinderGameProps> = ({
  level,
  company,
  userId,
  onGameComplete,
  onGameExit
}) => {
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    currentPath: [],
    timeRemaining: level.time_limit_seconds,
    score: 0,
    isPathValid: false
  });
  const [displayGrid, setDisplayGrid] = useState<CellType[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [level]);

  const initializeGame = async () => {
    const newGridData = gamingService.generateGrid(level.grid_size, level.obstacle_density);
    setGridData(newGridData);

    const initialDisplay: CellType[][] = newGridData.grid.map((row, rowIdx) =>
      row.map((cell, colIdx) => {
        if (rowIdx === newGridData.start.row && colIdx === newGridData.start.col) return 'start';
        if (rowIdx === newGridData.end.row && colIdx === newGridData.end.col) return 'end';
        return cell as CellType;
      })
    );
    setDisplayGrid(initialDisplay);

    setGameState({
      status: 'ready',
      currentPath: [],
      timeRemaining: level.time_limit_seconds,
      score: 0,
      isPathValid: false
    });
  };

  const startGame = async () => {
    if (!gridData) return;

    try {
      const session = await gamingService.createGameSession(userId, level.id, gridData);
      setSessionId(session.session_token);

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

  const pauseGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setGameState(prev => ({ ...prev, status: 'paused' }));
  };

  const resumeGame = () => {
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
  };

  const handleGameTimeout = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    initializeGame();
  };

  const isCellAdjacent = (pos1: Position, pos2: Position): boolean => {
    const rowDiff = Math.abs(pos1.row - pos2.row);
    const colDiff = Math.abs(pos1.col - pos2.col);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  };

  const handleCellInteraction = useCallback((row: number, col: number) => {
    if (gameState.status !== 'playing' || !gridData) return;

    const cell = displayGrid[row][col];
    if (cell === 'obstacle') return;

    const newPath = [...gameState.currentPath];
    const lastPos = newPath.length > 0 ? newPath[newPath.length - 1] : gridData.start;

    if (!isCellAdjacent(lastPos, { row, col })) return;

    if (newPath.some(pos => pos.row === row && pos.col === col)) {
      const index = newPath.findIndex(pos => pos.row === row && pos.col === col);
      newPath.splice(index);
    } else {
      newPath.push({ row, col });
    }

    const newDisplay = [...displayGrid];
    displayGrid.forEach((r, rIdx) => {
      r.forEach((c, cIdx) => {
        if (c === 'path' || c === 'current') {
          if (rIdx === gridData.start.row && cIdx === gridData.start.col) {
            newDisplay[rIdx][cIdx] = 'start';
          } else if (rIdx === gridData.end.row && cIdx === gridData.end.col) {
            newDisplay[rIdx][cIdx] = 'end';
          } else {
            newDisplay[rIdx][cIdx] = gridData.grid[rIdx][cIdx] as CellType;
          }
        }
      });
    });

    newPath.forEach(pos => {
      if (newDisplay[pos.row][pos.col] !== 'start' && newDisplay[pos.row][pos.col] !== 'end') {
        newDisplay[pos.row][pos.col] = 'path';
      }
    });

    if (newPath.length > 0) {
      const last = newPath[newPath.length - 1];
      if (newDisplay[last.row][last.col] !== 'start' && newDisplay[last.row][last.col] !== 'end') {
        newDisplay[last.row][last.col] = 'current';
      }
    }

    setDisplayGrid(newDisplay);

    const isComplete = newPath.length > 0 &&
      newPath[newPath.length - 1].row === gridData.end.row &&
      newPath[newPath.length - 1].col === gridData.end.col;

    setGameState(prev => ({
      ...prev,
      currentPath: newPath,
      isPathValid: isComplete
    }));

    if (isComplete) {
      completeGame(newPath);
    }
  }, [gameState.status, gameState.currentPath, gridData, displayGrid]);

  const completeGame = async (path: Position[]) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!gridData) return;

    const completionTime = level.time_limit_seconds - gameState.timeRemaining;
    const pathLength = path.length + 1;

    setGameState(prev => ({ ...prev, status: 'completed' }));

    try {
      await gamingService.submitScore(
        userId,
        company.id,
        level.id,
        sessionId,
        completionTime,
        pathLength,
        gridData.optimalPathLength
      );

      onGameComplete(gameState.score, completionTime, pathLength);
    } catch (error) {
      console.error('Error submitting score:', error);
    }
  };

  const handleMouseDown = (row: number, col: number) => {
    setIsDrawing(true);
    handleCellInteraction(row, col);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isDrawing) {
      handleCellInteraction(row, col);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDrawing(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const getCellColor = (cell: CellType): string => {
    switch (cell) {
      case 'start':
        return 'bg-green-500 border-green-600';
      case 'end':
        return 'bg-red-500 border-red-600';
      case 'obstacle':
        return 'bg-gray-800 border-gray-900';
      case 'path':
        return `bg-blue-400 border-blue-500`;
      case 'current':
        return `bg-yellow-400 border-yellow-500 animate-pulse`;
      default:
        return 'bg-white border-gray-300 hover:bg-gray-100';
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gridData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Generating game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{company.name} Path Finder</h1>
            <p className="text-gray-600 dark:text-gray-400">Level {level.level_number} - {level.grid_size}x{level.grid_size} Grid</p>
          </div>
          <button
            onClick={onGameExit}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-dark-200 dark:hover:bg-dark-300 rounded-lg transition-colors"
          >
            Exit Game
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-dark-100 rounded-xl p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <Clock className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Time Remaining</p>
                <p className={`text-2xl font-bold ${gameState.timeRemaining < 30 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                  {formatTime(gameState.timeRemaining)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <Target className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Path Length</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {gameState.currentPath.length + 1} / {gridData.optimalPathLength}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-xl p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <Trophy className="w-6 h-6 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Target Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{level.target_score}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-100 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-center mb-4 space-x-4">
            {gameState.status === 'ready' && (
              <button
                onClick={startGame}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                <Play className="w-5 h-5" />
                <span>Start Game</span>
              </button>
            )}
            {gameState.status === 'playing' && (
              <button
                onClick={pauseGame}
                className="flex items-center space-x-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors"
              >
                <Pause className="w-5 h-5" />
                <span>Pause</span>
              </button>
            )}
            {gameState.status === 'paused' && (
              <button
                onClick={resumeGame}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                <Play className="w-5 h-5" />
                <span>Resume</span>
              </button>
            )}
            <button
              onClick={resetGame}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex justify-center">
            <div
              className="inline-grid gap-1 p-4 bg-gray-50 dark:bg-dark-200 rounded-lg"
              style={{
                gridTemplateColumns: `repeat(${level.grid_size}, minmax(0, 1fr))`,
                maxWidth: '600px',
                width: '100%'
              }}
            >
              {displayGrid.map((row, rowIdx) =>
                row.map((cell, colIdx) => (
                  <motion.div
                    key={`${rowIdx}-${colIdx}`}
                    className={`aspect-square border-2 rounded-lg cursor-pointer transition-all ${getCellColor(cell)}`}
                    onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                    onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                    whileHover={{ scale: cell !== 'obstacle' ? 1.1 : 1 }}
                    whileTap={{ scale: cell !== 'obstacle' ? 0.95 : 1 }}
                  />
                ))
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-500 border-2 border-green-600 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Start</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-red-500 border-2 border-red-600 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">End</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-800 border-2 border-gray-900 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Obstacle</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-400 border-2 border-blue-500 rounded"></div>
              <span className="text-gray-700 dark:text-gray-300">Path</span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {gameState.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white dark:bg-dark-100 rounded-2xl p-8 max-w-md w-full text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Level Complete!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Congratulations! You've successfully completed this level.
                </p>
                <div className="space-y-2 mb-6">
                  <p className="text-lg">
                    <span className="text-gray-600 dark:text-gray-400">Time: </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {formatTime(level.time_limit_seconds - gameState.timeRemaining)}
                    </span>
                  </p>
                  <p className="text-lg">
                    <span className="text-gray-600 dark:text-gray-400">Path Length: </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {gameState.currentPath.length + 1}
                    </span>
                  </p>
                </div>
                <button
                  onClick={onGameExit}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          )}

          {gameState.status === 'failed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white dark:bg-dark-100 rounded-2xl p-8 max-w-md w-full text-center">
                <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Time's Up!</h2>
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
