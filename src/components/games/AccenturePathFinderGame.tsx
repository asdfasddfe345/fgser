import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCw, Repeat, CheckCircle, XCircle, Clock, Target, Trophy, Zap } from 'lucide-react';
import { GameLevel } from '../../types/gaming';
import { GridConfig, GridTile, GameState, TileRotation } from '../../types/pathfinder';
import { pathFinderService } from '../../services/pathFinderService';
import { ArrowTile } from './ArrowTile';
import { useAuth } from '../../contexts/AuthContext';

interface AccenturePathFinderGameProps {
  level: GameLevel;
  onGameComplete: (score: number, time: number, moves: number, xpEarned: number) => void;
  onGameExit: () => void;
  isPracticeMode?: boolean;
}

export const AccenturePathFinderGame: React.FC<AccenturePathFinderGameProps> = ({
  level,
  onGameComplete,
  onGameExit,
  isPracticeMode = false
}) => {
  const { user } = useAuth();
  const [gridConfig, setGridConfig] = useState<GridConfig | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle',
    selectedTile: null,
    timeRemaining: 240,
    totalMoves: 0,
    rotationCount: 0,
    flipCount: 0,
    currentScore: 0,
    isPathValid: false
  });
  const [sessionId, setSessionId] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [level]);

  const initializeGame = () => {
    const newGrid = pathFinderService.generateGrid(level.grid_size, level.level_number);
    setGridConfig(newGrid);
    setGameState({
      status: 'ready',
      selectedTile: null,
      timeRemaining: 240,
      totalMoves: 0,
      rotationCount: 0,
      flipCount: 0,
      currentScore: 0,
      isPathValid: false
    });
  };

  const startGame = async () => {
    if (!gridConfig || !user) return;

    try {
      const session = await pathFinderService.createSession(user.id, level.id, gridConfig, isPracticeMode);
      setSessionId(session.id);
      setGameState(prev => ({ ...prev, status: 'playing' }));

      if (!isPracticeMode) {
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
      }
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
    if (!isPracticeMode) {
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
    }
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

  const handleTileSelect = (row: number, col: number) => {
    if (gameState.status !== 'playing' || !gridConfig) return;

    const tile = gridConfig.tiles[row][col];
    if (tile.isStart || tile.isEnd) return;

    setGameState(prev => ({
      ...prev,
      selectedTile: { row, col }
    }));

    const updatedGrid = { ...gridConfig };
    updatedGrid.tiles = updatedGrid.tiles.map((r, rIdx) =>
      r.map((t, cIdx) => ({
        ...t,
        isSelected: rIdx === row && cIdx === col
      }))
    );
    setGridConfig(updatedGrid);
  };

  const handleRotate = async () => {
    if (!gameState.selectedTile || !gridConfig || gameState.status !== 'playing') return;

    const { row, col } = gameState.selectedTile;
    const tile = gridConfig.tiles[row][col];
    const previousRotation = tile.rotation;
    const rotatedTile = pathFinderService.rotateTile(tile);

    const updatedGrid = { ...gridConfig };
    updatedGrid.tiles[row][col] = rotatedTile;
    setGridConfig(updatedGrid);

    const newMoveCount = gameState.totalMoves + 1;
    const newRotationCount = gameState.rotationCount + 1;

    setGameState(prev => ({
      ...prev,
      totalMoves: newMoveCount,
      rotationCount: newRotationCount
    }));

    if (sessionId && user) {
      try {
        await pathFinderService.recordMove(
          sessionId,
          newMoveCount,
          { row, col },
          'rotate',
          previousRotation,
          rotatedTile.rotation
        );
      } catch (error) {
        console.error('Error recording move:', error);
      }
    }

    checkPath(updatedGrid);
  };

  const handleFlip = async () => {
    if (!gameState.selectedTile || !gridConfig || gameState.status !== 'playing') return;

    const { row, col } = gameState.selectedTile;
    const tile = gridConfig.tiles[row][col];
    const previousRotation = tile.rotation;
    const flippedTile = pathFinderService.flipTile(tile);

    const updatedGrid = { ...gridConfig };
    updatedGrid.tiles[row][col] = flippedTile;
    setGridConfig(updatedGrid);

    const newMoveCount = gameState.totalMoves + 1;
    const newFlipCount = gameState.flipCount + 1;

    setGameState(prev => ({
      ...prev,
      totalMoves: newMoveCount,
      flipCount: newFlipCount
    }));

    if (sessionId && user) {
      try {
        await pathFinderService.recordMove(
          sessionId,
          newMoveCount,
          { row, col },
          'flip',
          previousRotation,
          flippedTile.rotation
        );
      } catch (error) {
        console.error('Error recording move:', error);
      }
    }

    checkPath(updatedGrid);
  };

  const checkPath = (grid: GridConfig) => {
    const validation = pathFinderService.validatePath(grid);

    const updatedGrid = { ...grid };
    updatedGrid.tiles = updatedGrid.tiles.map(row =>
      row.map(tile => ({
        ...tile,
        isInPath: validation.pathTiles.some(p => p.row === tile.row && p.col === tile.col)
      }))
    );
    setGridConfig(updatedGrid);

    if (validation.isValid) {
      completeGame();
    }

    setGameState(prev => ({
      ...prev,
      isPathValid: validation.isValid
    }));
  };

  const completeGame = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!gridConfig || !user) return;

    const completionTime = 240 - gameState.timeRemaining;
    const scoreCalc = pathFinderService.calculateScore(
      completionTime,
      240,
      gameState.totalMoves,
      gridConfig.optimalMoves
    );

    setGameState(prev => ({
      ...prev,
      status: 'completed',
      currentScore: scoreCalc.finalScore
    }));

    if (!isPracticeMode && sessionId) {
      try {
        await pathFinderService.completeSession(
          sessionId,
          scoreCalc.finalScore,
          gameState.totalMoves,
          gameState.rotationCount,
          gameState.flipCount,
          gameState.timeRemaining
        );

        await pathFinderService.updateLeaderboard(
          user.id,
          level.id,
          completionTime,
          gameState.totalMoves,
          scoreCalc.finalScore
        );

        const xpEarned = await pathFinderService.awardXP(
          user.id,
          sessionId,
          scoreCalc.finalScore,
          false
        );

        onGameComplete(scoreCalc.finalScore, completionTime, gameState.totalMoves, xpEarned);
      } catch (error) {
        console.error('Error completing game:', error);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gridConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-cyan-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-200">Generating puzzle...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-cyan-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-['Orbitron']">
              Accenture Path Finder
            </h1>
            <p className="text-gray-300 mt-1">Level {level.level_number} - {level.grid_size}x{level.grid_size} Grid</p>
            {isPracticeMode && <p className="text-yellow-300 text-sm">Practice Mode - Unlimited Time</p>}
          </div>
          <button
            onClick={onGameExit}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Exit Game
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {!isPracticeMode && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30 shadow-lg">
              <div className="flex items-center space-x-3">
                <Clock className="w-6 h-6 text-cyan-400" />
                <div>
                  <p className="text-sm text-gray-400">Time Remaining</p>
                  <p className={`text-2xl font-bold ${gameState.timeRemaining < 30 ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(gameState.timeRemaining)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30 shadow-lg">
            <div className="flex items-center space-x-3">
              <Target className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Total Moves</p>
                <p className="text-2xl font-bold text-white">
                  {gameState.totalMoves} / {gridConfig.optimalMoves}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30 shadow-lg">
            <div className="flex items-center space-x-3">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Target Score</p>
                <p className="text-2xl font-bold text-white">{level.target_score}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30 shadow-lg">
            <div className="flex items-center space-x-3">
              <Zap className="w-6 h-6 text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Actions</p>
                <p className="text-2xl font-bold text-white">
                  R:{gameState.rotationCount} F:{gameState.flipCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-cyan-500/30 shadow-2xl mb-6">
          <div className="flex items-center justify-center mb-4 space-x-4 flex-wrap gap-2">
            {gameState.status === 'ready' && (
              <button
                onClick={startGame}
                className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all shadow-neon-cyan"
              >
                <Play className="w-5 h-5" />
                <span>Start Game</span>
              </button>
            )}
            {gameState.status === 'playing' && (
              <>
                <button
                  onClick={pauseGame}
                  className="flex items-center space-x-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-all"
                >
                  <Pause className="w-5 h-5" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleRotate}
                  disabled={!gameState.selectedTile}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon-blue"
                >
                  <RotateCw className="w-5 h-5" />
                  <span>Rotate</span>
                </button>
                <button
                  onClick={handleFlip}
                  disabled={!gameState.selectedTile}
                  className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon-purple"
                >
                  <Repeat className="w-5 h-5" />
                  <span>Flip</span>
                </button>
              </>
            )}
            {gameState.status === 'paused' && (
              <button
                onClick={resumeGame}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
              >
                <Play className="w-5 h-5" />
                <span>Resume</span>
              </button>
            )}
            <button
              onClick={resetGame}
              className="flex items-center space-x-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all"
            >
              <RotateCw className="w-5 h-5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex justify-center">
            <div
              className="inline-grid gap-2 p-4 bg-gray-900/50 rounded-lg backdrop-blur-sm"
              style={{
                gridTemplateColumns: `repeat(${level.grid_size}, minmax(0, 1fr))`,
                maxWidth: '600px',
                width: '100%'
              }}
            >
              {gridConfig.tiles.map((row, rowIdx) =>
                row.map((tile, colIdx) => (
                  <ArrowTile
                    key={`${rowIdx}-${colIdx}`}
                    tile={tile}
                    onSelect={() => handleTileSelect(rowIdx, colIdx)}
                    isDisabled={gameState.status !== 'playing'}
                  />
                ))
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-300 text-sm">
              {gameState.selectedTile
                ? `Selected: Row ${gameState.selectedTile.row + 1}, Col ${gameState.selectedTile.col + 1}`
                : 'Select a tile to rotate or flip'}
            </p>
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
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full text-center border-2 border-cyan-500 shadow-neon-cyan">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                >
                  <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4" />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">Level Complete!</h2>
                <p className="text-gray-300 mb-6">
                  Well Done! Path Complete in {gameState.totalMoves} moves!
                </p>
                <div className="space-y-2 mb-6">
                  <p className="text-lg text-gray-300">
                    <span className="text-cyan-400">Score: </span>
                    <span className="font-bold text-white">{gameState.currentScore}</span>
                  </p>
                  {!isPracticeMode && (
                    <p className="text-lg text-gray-300">
                      <span className="text-cyan-400">Time: </span>
                      <span className="font-bold text-white">{formatTime(240 - gameState.timeRemaining)}</span>
                    </p>
                  )}
                  <p className="text-lg text-gray-300">
                    <span className="text-cyan-400">Moves: </span>
                    <span className="font-bold text-white">{gameState.totalMoves}</span>
                  </p>
                </div>
                <button
                  onClick={onGameExit}
                  className="w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-all shadow-neon-cyan"
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
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full text-center border-2 border-red-500">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-2">Time's Up!</h2>
                <p className="text-gray-300 mb-6">
                  You ran out of time. Try again to improve your speed!
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={resetGame}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onGameExit}
                    className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-all"
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
