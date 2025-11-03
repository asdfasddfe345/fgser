import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCw, Repeat, CheckCircle, XCircle, Clock, Target, Trophy, Zap } from 'lucide-react';
import { pathFinderService } from '../../services/pathFinderService';
import { ArrowTile } from './ArrowTile';
import type { GameState, GridConfig, GameLevel } from '../../types/pathfinder';
// If you don't use Auth, replace with a dummy { user: { id: 'local' } } object.
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  level: GameLevel;
  onGameComplete: (score: number, time: number, moves: number, xpEarned: number) => void;
  onGameExit: () => void;
  isPracticeMode?: boolean;
}

export const AccenturePathFinderGame: React.FC<Props> = ({ level, onGameComplete, onGameExit, isPracticeMode = false }) => {
  const { user } = useAuth?.() ?? { user: { id: 'local' } as any };
  const [gridConfig, setGridConfig] = useState<GridConfig | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    status: 'idle', selectedTile: null, timeRemaining: 240,
    totalMoves: 0, rotationCount: 0, flipCount: 0, currentScore: 0, isPathValid: false
  });
  const [sessionId, setSessionId] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeGame();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [level]);

  const initializeGame = () => {
    const newGrid = pathFinderService.generateGrid(level.grid_size, level.level_number);
    setGridConfig(newGrid);
    setGameState({ status: 'ready', selectedTile: null, timeRemaining: 240, totalMoves: 0, rotationCount: 0, flipCount: 0, currentScore: 0, isPathValid: false });
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setGameState(prev => {
        const t = prev.timeRemaining - 1;
        if (t <= 0) { handleGameTimeout(); return { ...prev, timeRemaining: 0, status: 'failed' }; }
        return { ...prev, timeRemaining: t };
      });
    }, 1000);
  };

  const startGame = async () => {
    if (!gridConfig || !user) return;
    try {
      const session = await pathFinderService.createSession(user.id, level.id, gridConfig, isPracticeMode);
      setSessionId(session.id);
      setGameState(p => ({ ...p, status: 'playing' }));
      if (!isPracticeMode) startTimer();
    } catch (e) { console.error('Error starting game:', e); }
  };

  const pauseGame = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; setGameState(p => ({ ...p, status: 'paused' })); };
  const resumeGame = () => { setGameState(p => ({ ...p, status: 'playing' })); if (!isPracticeMode) startTimer(); };
  const handleGameTimeout = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };

  const resetGame = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; initializeGame(); };

  const handleTileSelect = (row: number, col: number) => {
    if (gameState.status !== 'playing' || !gridConfig) return;
    const tile = gridConfig.tiles[row][col]; if (tile.isStart || tile.isEnd) return;
    setGameState(prev => ({ ...prev, selectedTile: { row, col } }));
    const updated = { ...gridConfig };
    updated.tiles = updated.tiles.map((r, ri) => r.map((t, ci) => ({ ...t, isSelected: ri === row && ci === col })));
    setGridConfig(updated);
  };

  const handleRotate = async () => {
    if (!gameState.selectedTile || !gridConfig || gameState.status !== 'playing') return;
    const { row, col } = gameState.selectedTile;
    const tile = gridConfig.tiles[row][col];
    const prevRot = tile.rotation;
    const rotated = pathFinderService.rotateTile(tile);

    const updated = { ...gridConfig }; updated.tiles[row][col] = rotated; setGridConfig(updated);
    const newMoves = gameState.totalMoves + 1, newRotCount = gameState.rotationCount + 1;
    setGameState(p => ({ ...p, totalMoves: newMoves, rotationCount: newRotCount }));

    try { if (sessionId && user) await pathFinderService.recordMove(sessionId, newMoves, { row, col }, 'rotate', prevRot, rotated.rotation); } catch {}
    checkPath(updated);
  };

  const handleFlip = async () => {
    if (!gameState.selectedTile || !gridConfig || gameState.status !== 'playing') return;
    const { row, col } = gameState.selectedTile;
    const tile = gridConfig.tiles[row][col];
    const prevRot = tile.rotation;
    const flipped = pathFinderService.flipTile(tile);

    const updated = { ...gridConfig }; updated.tiles[row][col] = flipped; setGridConfig(updated);
    const newMoves = gameState.totalMoves + 1, newFlip = gameState.flipCount + 1;
    setGameState(p => ({ ...p, totalMoves: newMoves, flipCount: newFlip }));

    try { if (sessionId && user) await pathFinderService.recordMove(sessionId, newMoves, { row, col }, 'flip', prevRot, flipped.rotation); } catch {}
    checkPath(updated);
  };

  const checkPath = (grid: GridConfig) => {
    const val = pathFinderService.validatePath(grid);
    const updated = { ...grid };
    updated.tiles = updated.tiles.map(row => row.map(t => ({ ...t, isInPath: val.pathTiles.some(p => p.row === t.row && p.col === t.col) })));
    setGridConfig(updated);
    if (val.isValid) completeGame();
    setGameState(p => ({ ...p, isPathValid: val.isValid }));
  };

  const completeGame = async () => {
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
    if (!gridConfig || !user) return;
    const completionTime = 240 - gameState.timeRemaining;
    const score = pathFinderService.calculateScore(completionTime, 240, gameState.totalMoves, gridConfig.optimalMoves);
    setGameState(p => ({ ...p, status: 'completed', currentScore: score.finalScore }));

    try {
      if (!isPracticeMode && sessionId) {
        await pathFinderService.completeSession(sessionId, score.finalScore, gameState.totalMoves, gameState.rotationCount, gameState.flipCount, gameState.timeRemaining);
        await pathFinderService.updateLeaderboard(user.id, level.id, completionTime, gameState.totalMoves, score.finalScore);
        const xp = await pathFinderService.awardXP(user.id, sessionId, score.finalScore, false);
        onGameComplete(score.finalScore, completionTime, gameState.totalMoves, xp);
      }
    } catch (e) { console.error('completeGame error:', e); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameState.status !== 'playing' || !gridConfig) return;
      const cur = gameState.selectedTile ?? gridConfig.startPosition;
      const clamp = (v: number) => Math.max(0, Math.min(v, gridConfig.gridSize - 1));
      let { row, col } = cur;
      if (e.key === 'ArrowUp') row = clamp(row - 1);
      if (e.key === 'ArrowDown') row = clamp(row + 1);
      if (e.key === 'ArrowLeft') col = clamp(col - 1);
      if (e.key === 'ArrowRight') col = clamp(col + 1);
      if (row !== cur.row || col !== cur.col) handleTileSelect(row, col);
      if (e.key.toLowerCase() === 'r') handleRotate();
      if (e.key.toLowerCase() === 'f') handleFlip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState.status, gameState.selectedTile, gridConfig]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!gridConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-cyan-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4" />
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
            <h1 className="text-3xl md:text-4xl font-bold text-white font-['Orbitron']">Accenture Path Finder</h1>
            <p className="text-gray-300 mt-1">Level {level.level_number} - {level.grid_size}x{level.grid_size} Grid</p>
            {isPracticeMode && <p className="text-yellow-300 text-sm">Practice Mode - Unlimited Time</p>}
          </div>
          <button onClick={onGameExit} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">Exit Game</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {!isPracticeMode && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30 shadow-lg">
              <div className="flex items-center space-x-3">
                <Clock className="w-6 h-6 text-cyan-400" />
                <div>
                  <p className="text-sm text-gray-400">Time Remaining</p>
                  <p className={`text-2xl font-bold ${gameState.timeRemaining < 30 ? 'text-red-400' : 'text-white'}`}>{formatTime(gameState.timeRemaining)}</p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30 shadow-lg">
            <div className="flex items-center space-x-3">
              <Target className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Total Moves</p>
                <p className="text-2xl font-bold text-white">{gameState.totalMoves} / {gridConfig.optimalMoves}</p>
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
                <p className="text-2xl font-bold text-white">R:{gameState.rotationCount} F:{gameState.flipCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-cyan-500/30 shadow-2xl mb-6">
          <div className="flex items-center justify-center mb-4 space-x-4 flex-wrap gap-2">
            {gameState.status === 'ready' && (
              <button onClick={startGame} className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all">
                <Play className="w-5 h-5" /><span>Start Game</span>
              </button>
            )}
            {gameState.status === 'playing' && (
              <>
                <button onClick={pauseGame} className="flex items-center space-x-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-all">
                  <Pause className="w-5 h-5" /><span>Pause</span>
                </button>
                <button onClick={handleRotate} disabled={!gameState.selectedTile} className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <RotateCw className="w-5 h-5" /><span>Rotate</span>
                </button>
                <button onClick={handleFlip} disabled={!gameState.selectedTile} className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Repeat className="w-5 h-5" /><span>Flip</span>
                </button>
              </>
            )}
            {gameState.status === 'paused' && (
              <button onClick={resumeGame} className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all">
                <Play className="w-5 h-5" /><span>Resume</span>
              </button>
            )}
            <button onClick={resetGame} className="flex items-center space-x-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all">
              <RotateCw className="w-5 h-5" /><span>Reset</span>
            </button>
          </div>

          <div className="flex justify-center">
            <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 shadow-lg">
              <div className="inline-grid gap-2" style={{ gridTemplateColumns: `repeat(${level.grid_size}, 72px)` }}>
                {gridConfig.tiles.map((row, r) =>
                  row.map((tile, c) => (
                    <ArrowTile key={`${r}-${c}`} tile={tile} onSelect={() => handleTileSelect(r, c)} isDisabled={gameState.status !== 'playing'} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-300 text-sm">
              {gameState.selectedTile ? `Selected: Row ${gameState.selectedTile.row + 1}, Col ${gameState.selectedTile.col + 1}` : 'Select a tile to rotate or flip'}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {gameState.status === 'completed' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full text-center border-2 border-cyan-500">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
                  <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4" />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">Level Complete!</h2>
                <p className="text-gray-300 mb-6">Well Done! Path Complete in {gameState.totalMoves} moves!</p>
                <div className="space-y-2 mb-6">
                  <p className="text-lg text-gray-300"><span className="text-cyan-400">Score: </span><span className="font-bold text-white">{gameState.currentScore}</span></p>
                  {!isPracticeMode && (
                    <p className="text-lg text-gray-300"><span className="text-cyan-400">Time: </span><span className="font-bold text-white">{formatTime(240 - gameState.timeRemaining)}</span></p>
                  )}
                  <p className="text-lg text-gray-300"><span className="text-cyan-400">Moves: </span><span className="font-bold text-white">{gameState.totalMoves}</span></p>
                </div>
                <button onClick={onGameExit} className="w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-all">Continue</button>
              </div>
            </motion.div>
          )}

          {gameState.status === 'failed' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full text-center border-2 border-red-500">
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-2">Time's Up!</h2>
                <p className="text-gray-300 mb-6">You ran out of time. Try again to improve your speed!</p>
                <div className="flex space-x-4">
                  <button onClick={resetGame} className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all">Try Again</button>
                  <button onClick={onGameExit} className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-all">Exit</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
