import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Key, Clock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { keyFinderService } from '../../services/keyFinderService';

interface KeyFinderGameProps {
  difficulty: 'easy' | 'medium' | 'hard';
  userId: string;
  onGameComplete: (score: number, time: number, moves: number) => void;
  onGameExit: () => void;
}

interface Position {
  x: number;
  y: number;
}

export const KeyFinderGame: React.FC<KeyFinderGameProps> = ({
  difficulty,
  userId,
  onGameComplete,
  onGameExit,
}) => {
  const gridSizeMap = { easy: 6, medium: 8, hard: 10 };
  const timeLimitMap = { easy: 360, medium: 300, hard: 240 };

  const gridSize = gridSizeMap[difficulty];
  const timeLimit = timeLimitMap[difficulty];

  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
  const [keyPos, setKeyPos] = useState<Position>({ x: 0, y: 0 });
  const [exitPos, setExitPos] = useState<Position>({ x: 0, y: 0 });
  const [walls, setWalls] = useState<Position[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [moves, setMoves] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerTrail, setPlayerTrail] = useState<Set<string>>(new Set());

  useEffect(() => {
    initializeGame();
  }, [difficulty]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          handleGameTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameOver]);

  const initializeGame = () => {
    const newWalls: Position[] = [];
    const obstacleCount = Math.floor(gridSize * gridSize * 0.25);

    for (let i = 0; i < obstacleCount; i++) {
      const wall = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
      if (!(wall.x === 0 && wall.y === 0)) {
        newWalls.push(wall);
      }
    }

    let newKeyPos: Position;
    do {
      newKeyPos = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
    } while (
      (newKeyPos.x === 0 && newKeyPos.y === 0) ||
      newWalls.some(w => w.x === newKeyPos.x && w.y === newKeyPos.y)
    );

    let newExitPos: Position;
    do {
      newExitPos = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
    } while (
      (newExitPos.x === 0 && newExitPos.y === 0) ||
      (newExitPos.x === newKeyPos.x && newExitPos.y === newKeyPos.y) ||
      newWalls.some(w => w.x === newExitPos.x && w.y === newExitPos.y)
    );

    setWalls(newWalls);
    setKeyPos(newKeyPos);
    setExitPos(newExitPos);
    setPlayerPos({ x: 0, y: 0 });
    setHasKey(false);
    setMoves(0);
    setTimeRemaining(timeLimit);
    setGameStarted(true);
    setGameOver(false);
    setPlayerTrail(new Set(['0,0']));
  };

  const isWall = (pos: Position): boolean => {
    return walls.some((wall) => wall.x === pos.x && wall.y === pos.y);
  };

  const canMove = (dx: number, dy: number): boolean => {
    const newPos = {
      x: playerPos.x + dx,
      y: playerPos.y + dy,
    };

    if (newPos.x < 0 || newPos.x >= gridSize || newPos.y < 0 || newPos.y >= gridSize) {
      return false;
    }

    return true;
  };

  const handleMove = useCallback(
    (dx: number, dy: number) => {
      if (gameOver || !gameStarted) return;

      const newPos = {
        x: playerPos.x + dx,
        y: playerPos.y + dy,
      };

      if (newPos.x < 0 || newPos.x >= gridSize || newPos.y < 0 || newPos.y >= gridSize) {
        return;
      }

      if (isWall(newPos)) {
        setPlayerPos({ x: 0, y: 0 });
        setMoves((prev) => prev + 1);
        setPlayerTrail(new Set(['0,0']));
        return;
      }

      setPlayerPos(newPos);
      setMoves((prev) => prev + 1);
      setPlayerTrail((prev) => new Set([...prev, `${newPos.x},${newPos.y}`]));

      if (!hasKey && newPos.x === keyPos.x && newPos.y === keyPos.y) {
        setHasKey(true);
      }

      if (hasKey && newPos.x === exitPos.x && newPos.y === exitPos.y) {
        handleGameComplete();
      }
    },
    [playerPos, hasKey, gameOver, gameStarted, walls, keyPos, exitPos, gridSize]
  );

  const handleGameComplete = async () => {
    setGameOver(true);
    const timeTaken = timeLimit - timeRemaining;
    const score = calculateScore(timeTaken, moves);

    try {
      await keyFinderService.saveGameResult({
        user_id: userId,
        difficulty,
        score,
        time_taken: timeTaken,
        moves_count: moves,
        completed: true,
      });
    } catch (error) {
      console.error('Error saving game result:', error);
    }

    setTimeout(() => {
      onGameComplete(score, timeTaken, moves);
    }, 1500);
  };

  const handleGameTimeout = async () => {
    try {
      await keyFinderService.saveGameResult({
        user_id: userId,
        difficulty,
        score: 0,
        time_taken: timeLimit,
        moves_count: moves,
        completed: false,
      });
    } catch (error) {
      console.error('Error saving timeout result:', error);
    }

    setTimeout(() => {
      onGameExit();
    }, 2000);
  };

  const calculateScore = (time: number, moves: number): number => {
    const baseScore = 1000;
    const timePenalty = time * 2;
    const movePenalty = moves * 5;
    return Math.max(0, baseScore - timePenalty - movePenalty);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cellSize = 70;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 py-8 px-4 flex items-center justify-center">
      <div className="max-w-5xl mx-auto">
        <div className="bg-slate-800 rounded-3xl shadow-2xl p-8 border-4 border-slate-700">
          {/* Game Grid */}
          <div className="relative mx-auto" style={{ width: 'fit-content' }}>
            <div
              className="relative bg-slate-700 rounded-xl overflow-visible p-1"
              style={{
                width: gridSize * cellSize,
                height: gridSize * cellSize,
              }}
            >
              {/* Grid cells */}
              {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                const x = idx % gridSize;
                const y = Math.floor(idx / gridSize);
                
                const isPlayerCell = playerPos.x === x && playerPos.y === y;
                const isInTrail = playerTrail.has(`${x},${y}`);
                const isKeyCell = keyPos.x === x && keyPos.y === y && !hasKey;
                const isExitCell = exitPos.x === x && exitPos.y === y;
                const isWallCell = isWall({ x, y });

                return (
                  <div
                    key={idx}
                    className={`absolute border-2 transition-all duration-200 ${
                      isInTrail 
                        ? 'bg-slate-600 border-slate-500' 
                        : 'bg-slate-400 border-slate-300'
                    }`}
                    style={{
                      left: x * cellSize,
                      top: y * cellSize,
                      width: cellSize,
                      height: cellSize,
                    }}
                  >
                    {/* Invisible walls - shown as black */}
                    {isWallCell && !isPlayerCell && (
                      <div className="w-full h-full bg-black opacity-0"></div>
                    )}

                    {/* Player */}
                    {isPlayerCell && (
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="w-full h-full flex items-center justify-center relative z-20"
                      >
                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-slate-700">
                          <User className="w-9 h-9 text-slate-800" strokeWidth={2.5} />
                        </div>
                      </motion.div>
                    )}

                    {/* Key */}
                    {isKeyCell && !isPlayerCell && (
                      <div className="w-full h-full flex items-center justify-center">
                        <Key className="w-10 h-10 text-slate-900" fill="currentColor" strokeWidth={0} />
                      </div>
                    )}

                    {/* Exit Door */}
                    {isExitCell && !isPlayerCell && (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <div className="w-full h-full border-4 border-slate-900 bg-white rounded-lg flex items-center justify-center relative">
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900 rounded-full"></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Arrow overlays on adjacent cells */}
{canMove(0, -1) && (
  <button
    onClick={() => handleMove(0, -1)}
    disabled={gameOver}
    className="absolute flex items-center justify-center bg-white/40 hover:bg-white/60 transition-all disabled:opacity-0 disabled:pointer-events-none z-30 border-2 border-slate-400"
    style={{
      left: playerPos.x * cellSize,
      top: (playerPos.y - 1) * cellSize,
      width: cellSize,
      height: cellSize,
    }}
  >
    <ChevronUp className="w-10 h-10 text-slate-900" strokeWidth={3} />
  </button>
)}

{canMove(0, 1) && (
  <button
    onClick={() => handleMove(0, 1)}
    disabled={gameOver}
    className="absolute flex items-center justify-center bg-white/40 hover:bg-white/60 transition-all disabled:opacity-0 disabled:pointer-events-none z-30 border-2 border-slate-400"
    style={{
      left: playerPos.x * cellSize,
      top: (playerPos.y + 1) * cellSize,
      width: cellSize,
      height: cellSize,
    }}
  >
    <ChevronDown className="w-10 h-10 text-slate-900" strokeWidth={3} />
  </button>
)}

{canMove(-1, 0) && (
  <button
    onClick={() => handleMove(-1, 0)}
    disabled={gameOver}
    className="absolute flex items-center justify-center bg-white/40 hover:bg-white/60 transition-all disabled:opacity-0 disabled:pointer-events-none z-30 border-2 border-slate-400"
    style={{
      left: (playerPos.x - 1) * cellSize,
      top: playerPos.y * cellSize,
      width: cellSize,
      height: cellSize,
    }}
  >
    <ChevronLeft className="w-10 h-10 text-slate-900" strokeWidth={3} />
  </button>
)}

{canMove(1, 0) && (
  <button
    onClick={() => handleMove(1, 0)}
    disabled={gameOver}
    className="absolute flex items-center justify-center bg-white/40 hover:bg-white/60 transition-all disabled:opacity-0 disabled:pointer-events-none z-30 border-2 border-slate-400"
    style={{
      left: (playerPos.x + 1) * cellSize,
      top: playerPos.y * cellSize,
      width: cellSize,
      height: cellSize,
    }}
  >
    <ChevronRight className="w-10 h-10 text-slate-900" strokeWidth={3} />
  </button>
)}

          </div>

          {/* Timer and Instructions */}
          <div className="mt-12 text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="bg-slate-700 rounded-full px-6 py-3 flex items-center space-x-3 border-2 border-slate-600 shadow-lg">
                <Clock className="w-6 h-6 text-slate-200" />
                <span className="text-2xl font-bold text-white">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            <p className="text-slate-200 text-xl font-medium mb-6">
              Collect <span className="text-yellow-400 font-bold">1 KEY</span> then get to the{' '}
              <span className="text-green-400 font-bold">DOOR</span>
            </p>

            <button
              onClick={onGameExit}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg"
            >
              Exit Game
            </button>
          </div>

          {/* Game Over Overlay */}
          <AnimatePresence>
            {gameOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-slate-800 rounded-2xl p-8 max-w-md text-center border-4 border-slate-600"
                >
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {timeRemaining === 0 ? "Time's Up!" : 'Congratulations!'}
                  </h2>
                  <p className="text-slate-300 text-lg">
                    {timeRemaining === 0
                      ? 'You ran out of time. Try again!'
                      : 'You found the exit!'}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
