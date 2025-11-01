import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Key, Clock, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, DoorOpen } from 'lucide-react';
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
  const gridSizeMap = { easy: 8, medium: 10, hard: 12 };
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
  const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set());
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
    const obstacleCount = Math.floor(gridSize * gridSize * 0.2);

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
    } while (newKeyPos.x === 0 && newKeyPos.y === 0);

    let newExitPos: Position;
    do {
      newExitPos = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
    } while (
      (newExitPos.x === 0 && newExitPos.y === 0) ||
      (newExitPos.x === newKeyPos.x && newExitPos.y === newKeyPos.y)
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
    setVisitedCells(new Set(['0,0']));
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
        setVisitedCells(new Set(['0,0']));
        setPlayerTrail(new Set(['0,0']));
        return;
      }

      setPlayerPos(newPos);
      setMoves((prev) => prev + 1);
      setVisitedCells((prev) => new Set([...prev, `${newPos.x},${newPos.y}`]));
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

  const cellSize = 80;
  const gridCols = 3;
  const gridRows = 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black py-8 px-4 flex items-center justify-center">
      <div className="max-w-4xl mx-auto">
        {/* Game Grid */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border-4 border-gray-700">
          <div
            className="relative mx-auto bg-gray-800 border-4 border-gray-600 rounded-lg overflow-visible"
            style={{
              width: gridCols * cellSize,
              height: gridRows * cellSize,
            }}
          >
            {/* Grid cells - showing only 3x3 visible area around player */}
            {Array.from({ length: gridRows * gridCols }).map((_, idx) => {
              const localX = idx % gridCols;
              const localY = Math.floor(idx / gridCols);
              
              const worldX = playerPos.x + (localX - 1);
              const worldY = playerPos.y + (localY - 1);
              
              const isCurrentCell = localX === 1 && localY === 1;
              const isInTrail = playerTrail.has(`${worldX},${worldY}`);
              const isKeyCell = worldX === keyPos.x && worldY === keyPos.y && !hasKey;
              const isExitCell = worldX === exitPos.x && worldY === exitPos.y;

              return (
                <div
                  key={idx}
                  className={`absolute border border-gray-600 transition-all duration-200 ${
                    isInTrail ? 'bg-gray-700' : 'bg-gray-500'
                  } ${isCurrentCell ? 'bg-gray-700' : ''}`}
                  style={{
                    left: localX * cellSize,
                    top: localY * cellSize,
                    width: cellSize,
                    height: cellSize,
                  }}
                >
                  {/* Player in center */}
                  {isCurrentCell && (
                    <div className="w-full h-full flex items-center justify-center relative z-10">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                        <User className="w-8 h-8 text-gray-800" />
                      </div>
                    </div>
                  )}

                  {/* Key */}
                  {isKeyCell && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-14 h-14 flex items-center justify-center">
                        <Key className="w-10 h-10 text-gray-900" fill="currentColor" />
                      </div>
                    </div>
                  )}

                  {/* Exit Door */}
                  {isExitCell && hasKey && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-14 h-14 border-4 border-gray-900 bg-white rounded-lg flex items-center justify-center">
                        <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Directional Arrow Buttons */}
            {/* Up Arrow */}
            {canMove(0, -1) && (
              <button
                onClick={() => handleMove(0, -1)}
                disabled={gameOver}
                className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-1/2 bg-gray-600/60 hover:bg-gray-500/80 rounded-full p-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-20"
                style={{ top: -20 }}
              >
                <ChevronUp className="w-8 h-8 text-gray-300" strokeWidth={3} />
              </button>
            )}

            {/* Down Arrow */}
            {canMove(0, 1) && (
              <button
                onClick={() => handleMove(0, 1)}
                disabled={gameOver}
                className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 bg-gray-600/60 hover:bg-gray-500/80 rounded-full p-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-20"
                style={{ bottom: -20 }}
              >
                <ChevronDown className="w-8 h-8 text-gray-300" strokeWidth={3} />
              </button>
            )}

            {/* Left Arrow */}
            {canMove(-1, 0) && (
              <button
                onClick={() => handleMove(-1, 0)}
                disabled={gameOver}
                className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 bg-gray-600/60 hover:bg-gray-500/80 rounded-full p-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-20"
                style={{ left: -20 }}
              >
                <ChevronLeft className="w-8 h-8 text-gray-300" strokeWidth={3} />
              </button>
            )}

            {/* Right Arrow */}
            {canMove(1, 0) && (
              <button
                onClick={() => handleMove(1, 0)}
                disabled={gameOver}
                className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-1/2 bg-gray-600/60 hover:bg-gray-500/80 rounded-full p-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed z-20"
                style={{ right: -20 }}
              >
                <ChevronRight className="w-8 h-8 text-gray-300" strokeWidth={3} />
              </button>
            )}
          </div>

          {/* Timer and Instructions */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="bg-gray-700 rounded-full px-4 py-2 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-gray-300" />
                <span className="text-xl font-bold text-white">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            <p className="text-gray-300 text-lg font-medium">
              Collect <span className="text-yellow-400 font-bold">1 KEY</span> then get to the{' '}
              <span className="text-green-400 font-bold">DOOR</span>
            </p>

            <button
              onClick={onGameExit}
              className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
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
                  className="bg-gray-800 rounded-2xl p-8 max-w-md text-center border-4 border-gray-600"
                >
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {timeRemaining === 0 ? "Time's Up!" : 'Game Complete!'}
                  </h2>
                  <p className="text-gray-300 text-lg">
                    {timeRemaining === 0
                      ? 'You ran out of time. Try again!'
                      : 'Congratulations! You found the exit!'}
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
