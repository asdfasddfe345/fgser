import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, HelpCircle } from 'lucide-react';
import { keyFinderService } from '../../services/keyFinderService';

type Difficulty = 'easy' | 'medium' | 'hard';
type Dir = 'u' | 'd' | 'l' | 'r';

interface KeyFinderGameProps {
  difficulty: Difficulty;
  userId: string;
  onGameComplete: (score: number, time: number, moves: number) => void;
  onGameExit: () => void;
  boardPx?: number;
}

interface Pos { x: number; y: number; }

const arrowForDelta = (dx: number, dy: number) => {
  if (dx === 1) return '▶';
  if (dx === -1) return '◀';
  if (dy === 1) return '▼';
  if (dy === -1) return '▲';
  return '';
};

const GRID_MAP = { easy: 4, medium: 5, hard: 6 } as const;
const TIME_MAP = { easy: 300, medium: 300, hard: 300 } as const;
const DENSITY_MAP = { easy: 0.18, medium: 0.22, hard: 0.26 } as const;

export const KeyFinderGame: React.FC<KeyFinderGameProps> = ({
  difficulty,
  userId,
  onGameComplete,
  onGameExit,
  boardPx = 720,
}) => {
  const gridSize = GRID_MAP[difficulty];
  const timeLimit = TIME_MAP[difficulty];

  // 2px smaller cell per your request
  const cell = Math.max(24, Math.floor(boardPx / gridSize) - 2);

  const [player, setPlayer] = useState<Pos>({ x: 0, y: 0 });
  const [keyPos, setKeyPos] = useState<Pos>({ x: 0, y: 0 });
  const [exitPos, setExitPos] = useState<Pos>({ x: 0, y: 0 });
  const [walls, setWalls] = useState<Pos[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [started, setStarted] = useState(false);
  const [over, setOver] = useState(false);
  const [trail, setTrail] = useState<Set<string>>(new Set(['0,0']));
  const [flashEdge, setFlashEdge] = useState<null | { x: number; y: number; dir: Dir }>(null);

  // How-to-play UI
  const [showHelp, setShowHelp] = useState(true);

  const flashTO = useRef<number | null>(null);

  useEffect(() => { init(); }, [difficulty]);

  useEffect(() => {
    if (!started || over) return;
    const t = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setOver(true);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [started, over]);

  // Optional keyboard controls (Arrows / WASD)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || over) return;
      if (['ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); tryMove(0, -1); }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); tryMove(0, 1); }
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); tryMove(-1, 0); }
      else if (['ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); tryMove(1, 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, over, player, hasKey, walls, keyPos, exitPos]); // deps used in tryMove

  const init = () => {
    const obstacles: Pos[] = [];
    const obstacleCount = Math.floor(gridSize * gridSize * DENSITY_MAP[difficulty]);

    while (obstacles.length < obstacleCount) {
      const w = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
      if (!(w.x === 0 && w.y === 0) && !obstacles.some(o => o.x === w.x && o.y === w.y)) {
        obstacles.push(w);
      }
    }

    let k: Pos;
    do { k = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) }; }
    while ((k.x === 0 && k.y === 0) || obstacles.some(o => o.x === k.x && o.y === k.y));

    let e: Pos;
    do { e = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) }; }
    while ((e.x === 0 && e.y === 0) || (e.x === k.x && e.y === k.y) || obstacles.some(o => o.x === e.x && o.y === e.y));

    setWalls(obstacles);
    setKeyPos(k);
    setExitPos(e);
    setPlayer({ x: 0, y: 0 });
    setHasKey(false);
    setMoves(0);
    setTimeLeft(timeLimit);
    setStarted(true);
    setOver(false);
    setTrail(new Set(['0,0']));
    setFlashEdge(null);
  };

  const inBounds = (p: Pos) => p.x >= 0 && p.x < gridSize && p.y >= 0 && p.y < gridSize;
  const isWall = (p: Pos) => walls.some(w => w.x === p.x && w.y === p.y);

  const tryMove = useCallback((dx: number, dy: number) => {
    if (over || !started) return;
    const target = { x: player.x + dx, y: player.y + dy };
    if (!inBounds(target)) return;

    if (isWall(target)) {
      const dir: Dir = dx === 1 ? 'r' : dx === -1 ? 'l' : dy === 1 ? 'd' : 'u';
      setFlashEdge({ x: player.x, y: player.y, dir });
      if (flashTO.current) window.clearTimeout(flashTO.current);
      flashTO.current = window.setTimeout(() => setFlashEdge(null), 220);

      // collision resets to start and drops key (key remains where it originally was)
      setPlayer({ x: 0, y: 0 });
      setHasKey(false);
      setMoves(m => m + 1);
      setTrail(new Set(['0,0']));
      return;
    }

    setPlayer(target);
    setMoves(m => m + 1);
    setTrail(prev => new Set([...prev, `${target.x},${target.y}`]));

    if (!hasKey && target.x === keyPos.x && target.y === keyPos.y) setHasKey(true);
    if (hasKey && target.x === exitPos.x && target.y === exitPos.y) onComplete();
  }, [player, hasKey, over, started, walls, keyPos, exitPos]);

  const onCellClick = (x: number, y: number) => {
    const dx = x - player.x;
    const dy = y - player.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    tryMove(Math.sign(dx), Math.sign(dy));
  };

  const onComplete = async () => {
    setOver(true);
    const timeTaken = timeLimit - timeLeft;
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
    setTimeout(() => onGameComplete(score, timeTaken, moves), 600);
  };

  const onTimeout = async () => {
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
    setTimeout(onGameExit, 500);
  };

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2, '0')}`;
  const isNeighbor = (x: number, y: number) => (Math.abs(x - player.x) + Math.abs(y - player.y)) === 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 py-8 px-4 flex items-center justify-center">
      <div className="max-w-6xl mx-auto">
        <div className="bg-slate-800 rounded-3xl shadow-2xl p-8 border-4 border-slate-700 relative">
          {/* Help button */}
          <button
            onClick={() => setShowHelp(true)}
            className="absolute -top-4 -right-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-full p-3 shadow-xl"
            aria-label="How to play"
            title="How to play"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <div
            className="relative mx-auto overflow-hidden rounded-2xl bg-slate-700"
            style={{ width: gridSize * cell, height: gridSize * cell }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, i) => {
              const x = i % gridSize;
              const y = Math.floor(i / gridSize);

              const isPlayer = player.x === x && player.y === y;
              const visited = trail.has(`${x},${y}`);
              const neighbor = isNeighbor(x, y);
              const blocked = isWall({ x, y });
              const showKey = keyPos.x === x && keyPos.y === y && !hasKey;
              const showExit = exitPos.x === x && exitPos.y === y;

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={() => onCellClick(x, y)}
                  className={`absolute transition-all duration-150 select-none
                    ${visited ? 'bg-slate-600' : 'bg-slate-200/90'}
                    ${neighbor ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                  `}
                  style={{
                    left: x * cell,
                    top: y * cell,
                    width: cell,
                    height: cell,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: 'rgba(100,116,139,0.6)',
                    boxShadow: 'inset 0 0 0 0.5px rgba(15,23,42,0.12)',
                  }}
                  title={neighbor ? 'Click to move' : undefined}
                >
                  {neighbor && !isPlayer && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rotate-45 rounded-sm bg-white/30 shadow-sm" />
                      <div className="absolute text-slate-800/80 text-lg font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        {arrowForDelta(x - player.x, y - player.y)}
                      </div>
                    </div>
                  )}
                  {flashEdge && isPlayer && (
                    <div className="absolute inset-0">
                      {flashEdge.dir === 'u' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />}
                      {flashEdge.dir === 'd' && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-red-500" />}
                      {flashEdge.dir === 'l' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                      {flashEdge.dir === 'r' && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                    </div>
                  )}
                  {isPlayer && (
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                      className="w-full h-full flex items-center justify-center relative z-10">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-slate-700">
                        <span className="text-2xl select-none">👤</span>
                      </div>
                    </motion.div>
                  )}
                  {showKey && !isPlayer && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl select-none" role="img" aria-label="key">🔑</span>
                    </div>
                  )}
                  {showExit && !isPlayer && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl select-none" role="img" aria-label="home">🏠</span>
                    </div>
                  )}
                  {blocked && null}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="bg-slate-700 rounded-full px-6 py-3 flex items-center space-x-3 border-2 border-slate-600 shadow-lg">
                <Clock className="w-6 h-6 text-slate-200" />
                <span className="text-2xl font-bold text-white">{formatTime(timeLeft)}</span>
              </div>
            </div>
            <p className="text-slate-200 text-xl font-medium mb-6">
              Collect <span className="text-yellow-400 font-bold">1 KEY</span> then reach the{' '}
              <span className="text-green-400 font-bold">DOOR</span>. Avoid walls!
            </p>
            <button
              onClick={onGameExit}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg"
            >
              Exit Game
            </button>
          </div>

          {/* RESULT OVERLAY */}
          <AnimatePresence>
            {over && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="bg-slate-800 rounded-2xl p-8 max-w-md text-center border-4 border-slate-600"
                >
                  <h2 className="text-3xl font-bold text-white mb-4">
                    {timeLeft === 0 ? "Time's Up!" : 'Congratulations!'}
                  </h2>
                  <p className="text-slate-300 text-lg">
                    {timeLeft === 0 ? 'You ran out of time. Try again!' : 'You found the door!'}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HOW-TO-PLAY OVERLAY */}
          <AnimatePresence>
            {showHelp && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              >
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="w-full max-w-2xl rounded-2xl border-2 border-cyan-400 bg-slate-900 text-slate-100 p-6 shadow-2xl"
                >
                  <h3 className="text-2xl font-bold mb-2">How to play</h3>
                  <p className="text-slate-300 mb-4">
                    This is an Accenture-style <span className="font-semibold">Key Finder</span> memory maze.
                    The grid is {gridSize}×{gridSize} ({difficulty}).
                  </p>

                  <ul className="space-y-2 text-slate-200 list-disc pl-5">
                    <li><span className="font-semibold">Goal:</span> Pick up the 🔑 then reach the 🏠 before the timer ends.</li>
                    <li><span className="font-semibold">Movement:</span> Click a highlighted neighbor cell, or use <kbd>WASD</kbd>/<kbd>Arrow Keys</kbd>.</li>
                    <li><span className="font-semibold">Walls:</span> Hitting a wall resets you to start and you <span className="underline">drop the key</span>. The 🔑 becomes visible again at its original spot.</li>
                    <li><span className="font-semibold">Trail:</span> Visited tiles darken to help memory; walls are invisible until you collide.</li>
                    <li><span className="font-semibold">Timer:</span> {Math.floor(timeLimit/60)} minutes total. When it hits zero, the run fails.</li>
                    <li><span className="font-semibold">Score:</span> Starts at 1000, minus <code>2 × seconds</code> and <code>5 × moves</code>.</li>
                    <li><span className="font-semibold">Difficulties:</span> Easy 4×4, Medium 5×5, Hard 6×6.</li>
                  </ul>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowHelp(false)}
                      className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                    >
                      Got it, let’s play
                    </button>
                  </div>
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
