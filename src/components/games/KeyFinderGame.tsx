import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Brain, Key, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Clock, Target, AlertCircle, CheckCircle } from 'lucide-react';
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
  const timeLimitMap = { easy: 360, medium: 300, hard: 240 }; // seconds

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
  const [message, setMessage] = useState('');
  const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set());

  // Initialize game
  useEffect(() => {
    initializeGame();
  }, [difficulty]);

  // Timer
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          setMessage('Time\'s up! Game Over.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameOver]);

  const initializeGame = () => {
    const newWalls: Position[] = [];
    const obstacleCount = Math.floor(gridSize * gridSize * 0.15);

    // Generate random walls
    for (let i = 0; i < obstacleCount; i++) {
      const wall = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
      if (wall.x !== 0 || wall.y !== 0) {
        newWalls.push(wall);
      }
    }

    // Generate key and exit positions
    const newKeyPos = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };

    const newExitPos = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize),
    };

    setWalls(newWalls);
    setKeyPos(newKeyPos);
    setExitPos(newExitPos);
    setPlayerPos({ x: 0, y: 0 });
    setHasKey(false);
    setMoves(0);
    setTimeRemaining(timeLimit);
    setGameStarted(true);
    setGameOver(false);
    setMessage('');
    setVisitedCells(new Set(['0,0']));
  };

  const isWall = (pos: Position): boolean => {
    return walls.some((wall) => wall.x === pos.x && wall.y === pos.y);
  };

  const handleMove = useCallback(
    (dx: number, dy: number) => {
      if (gameOver || !gameStarted) return;

      const newPos = {
        x: playerPos.x + dx,
        y: playerPos.y + dy,
      };

      // Check boundaries
      if (newPos.x < 0 || newPos.x >= gridSize || newPos.y < 0 || newPos.y >= gridSize) {
        setMessage('Hit the boundary! Can\'t move there.');
        return;
      }

      // Check walls - restart from beginning if hit
      if (isWall(newPos)) {
        setMessage('Hit a wall! Restarting from beginning...');
        setPlayerPos({ x: 0, y: 0 });
        setMoves((prev) => prev + 1);
        setVisitedCells(new Set(['0,0']));
        return;
      }

      // Valid move
      setPlayerPos(newPos);
      setMoves((prev) => prev + 1);
      setVisitedCells((prev) => new Set([...prev, `${newPos.x},${newPos.y}`]));
      setMessage('');

      // Check if player collected the key
      if (!hasKey && newPos.x === keyPos.x && newPos.y === keyPos.y) {
        setHasKey(true);
        setMessage('Key collected! Now find the exit!');
      }

      // Check if player reached the exit with the key
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
    setMessage('Congratulations! You completed the maze!');

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
    }, 2000);
  };

  const calculateScore = (time: number, moves: number): number => {
    const baseScore = 1000;
    const timePenalty = time * 2;
    const movePenalty = moves * 5;
    return Math.max(0, baseScore - timePenalty - movePenalty);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleMove(0, -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleMove(0, 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleMove(-1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleMove(1, 0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleMove]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cellSize = 40;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Game Header */}
        <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <Brain className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Key Finder - {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {hasKey ? 'Find the exit!' : 'Find the key first!'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-purple-600" />
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {moves} moves
                </span>
              </div>
              <button
                onClick={onGameExit}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Exit Game
              </button>
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 p-3 rounded-lg flex items-center space-x-2 ${
                message.includes('Congratulations') || message.includes('Key collected')
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              }`}
            >
              {message.includes('Congratulations') || message.includes('Key collected') ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{message}</span>
            </motion.div>
          )}
        </div>

        {/* Game Grid */}
        <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8">
          <div
            className="relative mx-auto bg-gray-100 dark:bg-dark-200 border-4 border-gray-300 dark:border-dark-300 rounded-lg overflow-hidden"
            style={{
              width: gridSize * cellSize,
              height: gridSize * cellSize,
            }}
          >
            {/* Grid cells */}
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
              const x = idx % gridSize;
              const y = Math.floor(idx / gridSize);
              const isVisited = visitedCells.has(`${x},${y}`);
              const isPlayer = playerPos.x === x && playerPos.y === y;
              const isKeyCell = keyPos.x === x && keyPos.y === y && !hasKey;
              const isExitCell = exitPos.x === x && exitPos.y === y && hasKey;

              return (
                <div
                  key={idx}
                  className={`absolute border border-gray-300 dark:border-dark-300 transition-colors ${
                    isVisited ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                  style={{
                    left: x * cellSize,
                    top: y * cellSize,
                    width: cellSize,
                    height: cellSize,
                  }}
                >
                  {isPlayer && (
                    <div className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {isKeyCell && (
                    <div className="w-full h-full bg-yellow-500 rounded flex items-center justify-center">
                      <Key className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {isExitCell && (
                    <div className="w-full h-full bg-green-500 rounded flex items-center justify-center text-white font-bold text-xl">
                      EXIT
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Use arrow keys to navigate
            </p>
            <div className="flex justify-center items-center space-x-2">
              <ArrowUp className="w-6 h-6 text-gray-400" />
              <ArrowDown className="w-6 h-6 text-gray-400" />
              <ArrowLeft className="w-6 h-6 text-gray-400" />
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
