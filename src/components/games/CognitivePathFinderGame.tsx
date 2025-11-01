import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Trophy, Clock, Key, DoorClosed, User, AlertCircle, CheckCircle2, XCircle, Award, Zap } from 'lucide-react';

type CellType = 'empty' | 'wall' | 'player' | 'key' | 'door';
type Difficulty = 'easy' | 'medium' | 'hard';
type GameStatus = 'idle' | 'ready' | 'playing' | 'paused' | 'won' | 'failed';

interface Position {
  row: number;
  col: number;
}

interface GameState {
  status: GameStatus;
  playerPos: Position;
  keyPos: Position;
  doorPos: Position;
  walls: Position[];
  hasKey: boolean;
  timeRemaining: number;
  moveCount: number;
  restartCount: number;
  visitedCells: Set<string>;
  revealedWalls: Set<string>;
}

interface LeaderboardEntry {
  difficulty: Difficulty;
  time: number;
  moves: number;
  date: string;
}

interface CognitivePathFinderGameProps {
  onExit: () => void;
}

export const CognitivePathFinderGame: React.FC<CognitivePathFinderGameProps> = ({ onExit }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gridSize, setGridSize] = useState(5);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    loadLeaderboard();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const size = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
    setGridSize(size);
  }, [difficulty]);

  const loadLeaderboard = () => {
    const saved = localStorage.getItem('cognitive_pathfinder_leaderboard');
    if (saved) {
      setLeaderboard(JSON.parse(saved));
    }
  };

  const saveToLeaderboard = (time: number, moves: number) => {
    const entry: LeaderboardEntry = {
      difficulty,
      time,
      moves,
      date: new Date().toISOString()
    };
    const updated = [...leaderboard, entry]
      .sort((a, b) => a.time - b.time)
      .slice(0, 10);
    setLeaderboard(updated);
    localStorage.setItem('cognitive_pathfinder_leaderboard', JSON.stringify(updated));
  };

  const playSound = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  };

  const generateValidGrid = (size: number): Omit<GameState, 'status' | 'timeRemaining' | 'moveCount' | 'restartCount' | 'visitedCells' | 'revealedWalls'> => {
    const center = Math.floor(size / 2);
    const playerPos: Position = { row: center, col: center };

    const wallDensity = difficulty === 'easy' ? 0.15 : difficulty === 'medium' ? 0.20 : 0.25;
    const totalCells = size * size;
    const maxWalls = Math.floor(totalCells * wallDensity);

    const walls: Position[] = [];
    const occupied = new Set<string>();
    occupied.add(`${playerPos.row},${playerPos.col}`);

    const getRandomPos = (): Position => ({
      row: Math.floor(Math.random() * size),
      col: Math.floor(Math.random() * size)
    });

    const isValidPos = (pos: Position): boolean => {
      const key = `${pos.row},${pos.col}`;
      return !occupied.has(key) &&
             pos.row >= 0 && pos.row < size &&
             pos.col >= 0 && pos.col < size;
    };

    const hasPath = (from: Position, to: Position, wallSet: Set<string>): boolean => {
      const visited = new Set<string>();
      const queue: Position[] = [from];
      visited.add(`${from.row},${from.col}`);

      while (queue.length > 0) {
        const current = queue.shift()!;

        if (current.row === to.row && current.col === to.col) {
          return true;
        }

        const neighbors = [
          { row: current.row - 1, col: current.col },
          { row: current.row + 1, col: current.col },
          { row: current.row, col: current.col - 1 },
          { row: current.row, col: current.col + 1 }
        ];

        for (const neighbor of neighbors) {
          const key = `${neighbor.row},${neighbor.col}`;
          if (
            neighbor.row >= 0 && neighbor.row < size &&
            neighbor.col >= 0 && neighbor.col < size &&
            !visited.has(key) &&
            !wallSet.has(key)
          ) {
            visited.add(key);
            queue.push(neighbor);
          }
        }
      }
      return false;
    };

    for (let i = 0; i < maxWalls * 10 && walls.length < maxWalls; i++) {
      const wallPos = getRandomPos();
      const wallKey = `${wallPos.row},${wallPos.col}`;

      if (isValidPos(wallPos)) {
        const testWallSet = new Set([...walls.map(w => `${w.row},${w.col}`), wallKey]);

        const tempKeyPos = getRandomPos();
        if (isValidPos(tempKeyPos) && hasPath(playerPos, tempKeyPos, testWallSet)) {
          walls.push(wallPos);
          occupied.add(wallKey);
        }
      }
    }

    let keyPos: Position;
    let doorPos: Position;
    let attempts = 0;

    do {
      keyPos = getRandomPos();
      doorPos = getRandomPos();
      attempts++;
    } while (
      attempts < 100 &&
      (!isValidPos(keyPos) || !isValidPos(doorPos) ||
       (keyPos.row === doorPos.row && keyPos.col === doorPos.col) ||
       !hasPath(playerPos, keyPos, new Set(walls.map(w => `${w.row},${w.col}`))) ||
       !hasPath(keyPos, doorPos, new Set(walls.map(w => `${w.row},${w.col}`))))
    );

    return {
      playerPos,
      keyPos,
      doorPos,
      walls,
      hasKey: false
    };
  };

  const initializeGame = () => {
    const gridData = generateValidGrid(gridSize);
    const visitedCells = new Set<string>();
    visitedCells.add(`${gridData.playerPos.row},${gridData.playerPos.col}`);

    setGameState({
      ...gridData,
      status: 'ready',
      timeRemaining: 300,
      moveCount: 0,
      restartCount: 0,
      visitedCells,
      revealedWalls: new Set()
    });
  };

  const startGame = () => {
    if (!gameState) return;

    setGameState(prev => prev ? { ...prev, status: 'playing' } : null);
    playSound(440, 0.1);

    timerRef.current = setInterval(() => {
      setGameState(prev => {
        if (!prev) return null;
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          playSound(200, 0.5, 'sawtooth');
          return { ...prev, timeRemaining: 0, status: 'failed' };
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);
  };

  const pauseGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setGameState(prev => prev ? { ...prev, status: 'paused' } : null);
  };

  const resumeGame = () => {
    startGame();
  };

  const resetToStart = () => {
    if (!gameState) return;

    const center = Math.floor(gridSize / 2);
    const visitedCells = new Set<string>();
    visitedCells.add(`${center},${center}`);

    setGameState(prev => prev ? {
      ...prev,
      playerPos: { row: center, col: center },
      hasKey: false,
      moveCount: 0,
      restartCount: prev.restartCount + 1,
      visitedCells
    } : null);

    playSound(300, 0.3, 'sawtooth');
  };

  const handleMove = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!gameState || gameState.status !== 'playing') return;

    const { playerPos, walls, keyPos, doorPos, hasKey } = gameState;
    const newPos: Position = { ...playerPos };

    switch (direction) {
      case 'up': newPos.row--; break;
      case 'down': newPos.row++; break;
      case 'left': newPos.col--; break;
      case 'right': newPos.col++; break;
    }

    if (newPos.row < 0 || newPos.row >= gridSize || newPos.col < 0 || newPos.col >= gridSize) {
      playSound(250, 0.1, 'square');
      return;
    }

    const hitWall = walls.some(w => w.row === newPos.row && w.col === newPos.col);

    if (hitWall) {
      const wallKey = `${newPos.row},${newPos.col}`;
      const newRevealedWalls = new Set(gameState.revealedWalls);
      newRevealedWalls.add(wallKey);

      setGameState(prev => prev ? { ...prev, revealedWalls: newRevealedWalls } : null);

      playSound(150, 0.4, 'sawtooth');

      setTimeout(() => {
        resetToStart();
      }, 500);
      return;
    }

    playSound(350, 0.05);

    const newVisitedCells = new Set(gameState.visitedCells);
    newVisitedCells.add(`${newPos.row},${newPos.col}`);

    const collectingKey = !hasKey && newPos.row === keyPos.row && newPos.col === keyPos.col;
    const reachingDoor = hasKey && newPos.row === doorPos.row && newPos.col === doorPos.col;

    if (collectingKey) {
      playSound(600, 0.2);
      playSound(800, 0.2);
    }

    if (reachingDoor) {
      if (timerRef.current) clearInterval(timerRef.current);
      playSound(523, 0.15);
      playSound(659, 0.15);
      playSound(784, 0.3);

      const timeTaken = 300 - gameState.timeRemaining;
      saveToLeaderboard(timeTaken, gameState.moveCount + 1);

      setGameState(prev => prev ? {
        ...prev,
        playerPos: newPos,
        moveCount: prev.moveCount + 1,
        visitedCells: newVisitedCells,
        status: 'won'
      } : null);
      return;
    }

    setGameState(prev => prev ? {
      ...prev,
      playerPos: newPos,
      hasKey: hasKey || collectingKey,
      moveCount: prev.moveCount + 1,
      visitedCells: newVisitedCells
    } : null);
  }, [gameState, gridSize]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameState || gameState.status !== 'playing') return;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          e.preventDefault();
          handleMove('up');
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          handleMove('down');
          break;
        case 'a':
        case 'arrowleft':
          e.preventDefault();
          handleMove('left');
          break;
        case 'd':
        case 'arrowright':
          e.preventDefault();
          handleMove('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleMove, gameState]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const explorationPercentage = gameState
    ? Math.round((gameState.visitedCells.size / (gridSize * gridSize)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold">Cognitive Path Finder</h1>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
          >
            Exit
          </button>
        </div>

        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6"
            >
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                How to Play
              </h2>
              <div className="space-y-2 text-slate-300">
                <p>• Navigate a hidden grid with invisible walls</p>
                <p>• Collect the <Key className="inline w-4 h-4" /> key, then reach the <DoorClosed className="inline w-4 h-4" /> door</p>
                <p>• Use arrow keys or WASD to move</p>
                <p>• Hitting a wall resets you to start - remember safe paths!</p>
                <p>• Complete within 5 minutes to win</p>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                Got It
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              {!gameState ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Difficulty</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={`py-3 px-4 rounded-lg font-medium transition capitalize ${
                            difficulty === d
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          {d}
                          <div className="text-xs mt-1 opacity-75">
                            {d === 'easy' ? '4×4' : d === 'medium' ? '5×5' : '6×6'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={initializeGame}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Start Game
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-slate-700 px-4 py-2 rounded-lg">
                        <Clock className="w-5 h-5" />
                        <span className="font-mono text-xl">{formatTime(gameState.timeRemaining)}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-700 px-4 py-2 rounded-lg">
                        <Zap className="w-5 h-5" />
                        <span>{gameState.moveCount} moves</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {gameState.status === 'playing' && (
                        <button onClick={pauseGame} className="p-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg">
                          <Pause className="w-5 h-5" />
                        </button>
                      )}
                      {gameState.status === 'paused' && (
                        <button onClick={resumeGame} className="p-2 bg-green-600 hover:bg-green-700 rounded-lg">
                          <Play className="w-5 h-5" />
                        </button>
                      )}
                      <button onClick={() => { setGameState(null); if (timerRef.current) clearInterval(timerRef.current); }} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg">
                        <RotateCcw className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Grid Exploration</span>
                      <span className="text-sm font-medium">{explorationPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${explorationPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div
                    className="grid gap-1 mx-auto"
                    style={{
                      gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                      maxWidth: `${gridSize * 80}px`
                    }}
                  >
                    {Array.from({ length: gridSize }).map((_, row) =>
                      Array.from({ length: gridSize }).map((_, col) => {
                        const isPlayer = gameState.playerPos.row === row && gameState.playerPos.col === col;
                        const isKey = !gameState.hasKey && gameState.keyPos.row === row && gameState.keyPos.col === col;
                        const isDoor = gameState.doorPos.row === row && gameState.doorPos.col === col;
                        const isVisited = gameState.visitedCells.has(`${row},${col}`);
                        const isRevealedWall = gameState.revealedWalls.has(`${row},${col}`);

                        return (
                          <motion.div
                            key={`${row}-${col}`}
                            className={`aspect-square rounded-lg flex items-center justify-center text-2xl transition-all ${
                              isPlayer
                                ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                                : isKey
                                ? 'bg-yellow-600'
                                : isDoor
                                ? 'bg-green-600'
                                : isRevealedWall
                                ? 'bg-red-900 border-2 border-red-600'
                                : isVisited
                                ? 'bg-slate-700'
                                : 'bg-slate-800 border border-slate-700'
                            }`}
                            animate={isPlayer ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.3 }}
                          >
                            {isPlayer && <User className="w-6 h-6" />}
                            {isKey && <Key className="w-6 h-6" />}
                            {isDoor && <DoorClosed className="w-6 h-6" />}
                            {isRevealedWall && <XCircle className="w-6 h-6" />}
                          </motion.div>
                        );
                      })
                    )}
                  </div>

                  <div className="text-center text-lg font-medium">
                    {!gameState.hasKey ? (
                      <div className="flex items-center justify-center gap-2 text-yellow-400">
                        <Key className="w-5 h-5" />
                        Collect 1 KEY
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                        Key collected - get to the DOOR
                      </div>
                    )}
                  </div>

                  {gameState.restartCount > 0 && (
                    <div className="text-center text-sm text-slate-400">
                      Restarts: {gameState.restartCount}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Leaderboard
              </h3>
              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-700 p-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-400">#{idx + 1}</span>
                      <div>
                        <div className="font-medium capitalize">{entry.difficulty}</div>
                        <div className="text-xs text-slate-400">{entry.moves} moves</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold">{formatTime(entry.time)}</div>
                    </div>
                  </div>
                ))}
                {leaderboard.length === 0 && (
                  <div className="text-center text-slate-400 py-8">
                    No scores yet. Be the first!
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h3 className="text-lg font-bold mb-3">Controls</h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">↑ W</kbd>
                  <span>Move Up</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">↓ S</kbd>
                  <span>Move Down</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">← A</kbd>
                  <span>Move Left</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">→ D</kbd>
                  <span>Move Right</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {gameState?.status === 'won' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setGameState(null)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-br from-green-900 to-green-800 rounded-2xl p-8 max-w-md w-full border-2 border-green-500"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                  >
                    <Award className="w-20 h-20 mx-auto text-yellow-400" />
                  </motion.div>
                  <h2 className="text-3xl font-bold">Mission Complete!</h2>
                  <div className="space-y-3">
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-slate-300 text-sm">Time</div>
                      <div className="text-2xl font-bold">{formatTime(300 - gameState.timeRemaining)}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-slate-300 text-sm">Moves</div>
                      <div className="text-2xl font-bold">{gameState.moveCount}</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-4">
                      <div className="text-slate-300 text-sm">Restarts</div>
                      <div className="text-2xl font-bold">{gameState.restartCount}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setGameState(null); if (timerRef.current) clearInterval(timerRef.current); }}
                    className="w-full py-3 bg-white text-green-900 font-bold rounded-lg hover:bg-slate-100 transition"
                  >
                    Play Again
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState?.status === 'failed' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setGameState(null)}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-br from-red-900 to-red-800 rounded-2xl p-8 max-w-md w-full border-2 border-red-500"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-center space-y-6">
                  <XCircle className="w-20 h-20 mx-auto text-red-400" />
                  <h2 className="text-3xl font-bold">Time's Up!</h2>
                  <p className="text-slate-300">You ran out of time. Try again with better planning!</p>
                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="text-slate-300 text-sm">Moves Made</div>
                    <div className="text-2xl font-bold">{gameState.moveCount}</div>
                  </div>
                  <button
                    onClick={() => { setGameState(null); if (timerRef.current) clearInterval(timerRef.current); }}
                    className="w-full py-3 bg-white text-red-900 font-bold rounded-lg hover:bg-slate-100 transition"
                  >
                    Try Again
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
