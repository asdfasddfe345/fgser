import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { keyFinderService } from '../../services/keyFinderService';

interface KeyFinderGameProps {
  difficulty: 'easy' | 'medium' | 'hard';
  userId: string;
  onGameComplete: (score: number, time: number, moves: number) => void;
  onGameExit: () => void;
}

type Dir = 'u' | 'd' | 'l' | 'r';
interface Position { x: number; y: number; }

const arrowForDelta = (dx: number, dy: number) => {
  if (dx === 1) return '▶';
  if (dx === -1) return '◀';
  if (dy === 1) return '▼';
  if (dy === -1) return '▲';
  return '';
};

export const KeyFinderGame: React.FC<KeyFinderGameProps> = ({
  difficulty,
  userId,
  onGameComplete,
  onGameExit,
}) => {
  const gridSizeMap = { easy: 6, medium: 8, hard: 10 } as const;
  const timeLimitMap = { easy: 360, medium: 300, hard: 240 } as const;

  const gridSize = gridSizeMap[difficulty];
  const timeLimit = timeLimitMap[difficulty];
  const cell = 70;

  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, y: 0 });
  const [keyPos, setKeyPos] = useState<Position>({ x: 0, y: 0 });
  const [exitPos, setExitPos] = useState<Position>({ x: 0, y: 0 });
  const [walls, setWalls] = useState<Position[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [moves, setMoves] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [trail, setTrail] = useState<Set<string>>(new Set(['0,0']));

  const [flashEdge, setFlashEdge] = useState<null | { x: number; y: number; dir: Dir }>(null);
  const flashTimeout = useRef<number | null>(null);

  useEffect(() => { initializeGame(); }, [difficulty]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const t = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setGameOver(true);
          handleGameTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [gameStarted, gameOver]);

  const initializeGame = () => {
    const newWalls: Position[] = [];
    const obstacleCount = Math.floor(gridSize * gridSize * 0.25);

    for (let i = 0; i < obstacleCount; i++) {
      const wall = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
      if (!(wall.x === 0 && wall.y === 0)) newWalls.push(wall);
    }

    let k: Position;
    do {
      k = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
    } while ((k.x === 0 && k.y === 0) || newWalls.some(w => w.x === k.x && w.y === k.y));

    let e: Position;
    do {
      e = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
    } while (
      (e.x === 0 && e.y === 0) ||
      (e.x === k.x && e.y === k.y) ||
      newWalls.some(w => w.x === e.x && w.y === e.y)
    );

    setWalls(newWalls);
    setKeyPos(k);
    setExitPos(e);
    setPlayerPos({ x: 0, y: 0 });
    setHasKey(false);
    setMoves(0);
    setTimeRemaining(timeLimit);
    setGameStarted(true);
    setGameOver(false);
    setTrail(new Set(['0,0']));
    setFlashEdge(null);
  };

  const isWall = (p: Position) => walls.some(w => w.x === p.x && w.y === p.y);
  const inBounds = (p: Position) => p.x >= 0 && p.x < gridSize && p.y >= 0 && p.y < gridSize;

  const tryMove = useCallback((dx: number, dy: number) => {
    if (gameOver || !gameStarted) return;
    const target = { x: playerPos.x + dx, y: playerPos.y + dy };
    if (!inBounds(target)) return;

    if (isWall(target)) {
      const dir: Dir = dx === 1 ? 'r' : dx === -1 ? 'l' : dy === 1 ? 'd' : 'u';
      setFlashEdge({ x: playerPos.x, y: playerPos.y, dir });
      if (flashTimeout.current) window.clearTimeout(flashTimeout.current);
      flashTimeout.current = window.setTimeout(() => setFlashEdge(null), 220);
      setPlayerPos({ x: 0, y: 0 });
      setMoves(m => m + 1);
      setTrail(new Set(['0,0']));
      return;
    }

    setPlayerPos(target);
    setMoves(m => m + 1);
    setTrail(prev => new Set([...prev, `${target.x},${target.y}`]));

    if (!hasKey && target.x === keyPos.x && target.y === keyPos.y) setHasKey(true);
    if (hasKey && target.x === exitPos.x && target.y === exitPos.y) handleGameComplete();
  }, [playerPos, hasKey, gameOver, gameStarted, walls, keyPos, exitPos]);

  const onCellClick = (x: number, y: number) => {
    const dx = x - playerPos.x;
    const dy = y - playerPos.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return; // only 4-neighbor moves
    tryMove(Math.sign(dx), Math.sign(dy));
  };

  const handleGameComplete = async () => {
    setGameOver(true);
    const timeTaken = timeLimit - timeRemaining;
    const score = Math.max(0, 1000 - timeTaken * 2 - moves * 5);
    try {
      await keyFinderService.saveGameResult({
        user_id: userId,
        difficulty,
        score,
        time_taken: timeTaken,
        moves_count: moves,
        completed: true,
      });
    } catch {}
    setTimeout(() => onGameComplete(score, timeTaken, moves), 1000);
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
    } catch {}
    setTimeout(onGameExit, 800);
  };

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2, '0')}`;
  const isNeighbor = (x: number, y: number) => (Math.abs(x - playerPos.x) + Math.abs(y - playerPos.y)) === 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 py-8 px-4 flex items-center justify-center">
      <div className="max-w-5xl mx-auto">
        <div className="bg-slate-800 rounded-3xl shadow-2xl p-8 border-4 border-slate-700">
          {/* Board */}
          <div
            className="relative mx-auto overflow-hidden rounded-xl"
            style={{ width: gridSize * cell, height: gridSize * cell }}
          >
            <div className="relative bg-slate-700">
              {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                const x = i % gridSize;
                const y = Math.floor(i / gridSize);

                const isPlayer = playerPos.x === x && playerPos.y === y;
                const visited = trail.has(`${x},${y}`);
                const neighbor = isNeighbor(x, y);
                const blocked = isWall({ x, y });
                const showKey = keyPos.x === x && keyPos.y === y && !hasKey;
                const showExit = exitPos.x === x && exitPos.y === y;

                return (
                  <div
                    key={i}
                    onClick={() => onCellClick(x, y)}
                    className={`absolute border transition-all duration-150 select-none
                      ${visited ? 'bg-slate-600 border-slate-500' : 'bg-slate-200 border-slate-300'}
                      ${neighbor ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                      group
                    `}
                    style={{ left: x * cell, top: y * cell, width: cell, height: cell }}
                  >
                    {/* Neighbor diamond + direction arrow */}
                    {neighbor && !isPlayer && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rotate-45 rounded-sm bg-white/30 shadow-sm" />
                        <div className="absolute text-slate-800/80 text-lg font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                          {arrowForDelta(x - playerPos.x, y - playerPos.y)}
                        </div>
                      </div>
                    )}

                    {/* Red edge flash on blocked move */}
                    {flashEdge && isPlayer && (
                      <div className="absolute inset-0">
                        {flashEdge.dir === 'u' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />}
                        {flashEdge.dir === 'd' && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-red-500" />}
                        {flashEdge.dir === 'l' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                        {flashEdge.dir === 'r' && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                      </div>
                    )}

                    {/* Player (emoji avatar) */}
                    {isPlayer && (
                      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                        className="w-full h-full flex items-center justify-center relative z-10">
                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-slate-700">
                          <span className="text-2xl select-none">👤</span>
                        </div>
                      </motion.div>
                    )}

                    {/* 🔑 Key */}
                    {showKey && !isPlayer && (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl select-none">🔑</span>
                      </div>
                    )}

                    {/* 🏠 Door */}
                    {showExit && !isPlayer && (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl select-none">🏠</span>
                      </div>
                    )}

                    {/* walls are invisible */}
                    {blocked && null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* HUD */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="bg-slate-700 rounded-full px-6 py-3 flex items-center space-x-3 border-2 border-slate-600 shadow-lg">
                <Clock className="w-6 h-6 text-slate-200" />
                <span className="text-2xl font-bold text-white">{formatTime(timeRemaining)}</span>
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

          {/* Overlay */}
          <AnimatePresence>
            {gameOver && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="bg-slate-800 rounded-2xl p-8 max-w-md text-center border-4 border-slate-600"
                >
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {timeRemaining === 0 ? "Time's Up!" : 'Congratulations!'}
                  </h2>
                  <p className="text-slate-300 text-lg">
                    {timeRemaining === 0 ? 'You ran out of time. Try again!' : 'You found the exit!'}
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

export default KeyFinderGame;
