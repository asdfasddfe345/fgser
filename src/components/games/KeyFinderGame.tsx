// src/components/games/KeyFinderGame.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Info, HelpCircle } from 'lucide-react';
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
  // Viewport + mobile detection
  const [vw, setVw] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobileUA =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isNarrow = vw < 768;
  const isMobile = isMobileUA || isNarrow;

  const [showMobileNotice, setShowMobileNotice] = useState(false);
  useEffect(() => setShowMobileNotice(isMobile), [isMobile]);

  // Game state
  const gridSize = GRID_MAP[difficulty];
  const timeLimit = TIME_MAP[difficulty];
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
  const [doorFlash, setDoorFlash] = useState<null | { x: number; y: number }>(null); // NEW: door feedback
  const [showHowTo, setShowHowTo] = useState(true); // show instructions at start
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
    setDoorFlash(null);
  };

  const inBounds = (p: Pos) => p.x >= 0 && p.x < gridSize && p.y >= 0 && p.y < gridSize;
  const isWall = (p: Pos) => walls.some(w => w.x === p.x && w.y === p.y);

  const tryMove = useCallback((dx: number, dy: number) => {
    if (over || !started) return;
    const target = { x: player.x + dx, y: player.y + dy };
    if (!inBounds(target)) return;

    // Block the door unless the player has the key
    if (!hasKey && target.x === exitPos.x && target.y === exitPos.y) {
      setDoorFlash({ x: exitPos.x, y: exitPos.y });
      window.setTimeout(() => setDoorFlash(null), 250);
      return; // no move, no penalty
    }

    // Wall collision: flash edge, reset to start, drop key
    if (isWall(target)) {
      const dir: Dir = dx === 1 ? 'r' : dx === -1 ? 'l' : dy === 1 ? 'd' : 'u';
      setFlashEdge({ x: player.x, y: player.y, dir });
      if (flashTO.current) window.clearTimeout(flashTO.current);
      flashTO.current = window.setTimeout(() => setFlashEdge(null), 220);

      setPlayer({ x: 0, y: 0 });
      setHasKey(false);
      setMoves(m => m + 1);
      setTrail(new Set(['0,0']));
      return;
    }

    // Move
    setPlayer(target);
    setMoves(m => m + 1);
    setTrail(prev => new Set([...prev, `${target.x},${target.y}`]));

    // Pick key
    if (!hasKey && target.x === keyPos.x && target.y === keyPos.y) setHasKey(true);

    // Finish if on door with key
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
      <div className="max-w-6xl mx-auto w-full">
        {/* Header with desktop hint + How to Play button */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-3 text-sm text-slate-200 flex items-center gap-3">
            <Info className="w-4 h-4 text-cyan-300 shrink-0" />
            <div>
              <span className="font-semibold text-white">Best on Desktop/Laptop.</span>{' '}
              If using a phone, enable <span className="font-semibold">Desktop site</span> and zoom out a bit.
            </div>
          </div>
          <button
            onClick={() => setShowHowTo(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
          >
            <HelpCircle className="w-5 h-5" />
            How to Play
          </button>
        </div>

        <div className="bg-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 border-4 border-slate-700">
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
                >
                  {neighbor && !isPlayer && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rotate-45 rounded-sm bg-white/30 shadow-sm" />
                      <div className="absolute text-slate-800/80 text-lg font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        {arrowForDelta(x - player.x, y - player.y)}
                      </div>
                    </div>
                  )}

                  {/* Flash current cell edge on hitting a wall */}
                  {flashEdge && isPlayer && (
                    <div className="absolute inset-0">
                      {flashEdge.dir === 'u' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />}
                      {flashEdge.dir === 'd' && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-red-500" />}
                      {flashEdge.dir === 'l' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                      {flashEdge.dir === 'r' && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                    </div>
                  )}

                  {/* Player */}
                  {isPlayer && (
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                      className="w-full h-full flex items-center justify-center relative z-10">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-slate-700">
                        <span className="text-2xl select-none">👤</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Key */}
                  {showKey && !isPlayer && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl select-none">🔑</span>
                    </div>
                  )}

                  {/* Door / Locked Door with flash */}
                  {showExit && !isPlayer && (
                    <div className="w-full h-full flex items-center justify-center relative">
                      {hasKey ? (
                        <span className="text-2xl select-none">🏠</span>
                      ) : (
                        <>
                          <span className="text-2xl select-none">🔒</span>
                          {doorFlash && doorFlash.x === x && doorFlash.y === y && (
                            <div className="absolute inset-0 ring-4 ring-red-500/70 animate-pulse pointer-events-none rounded-none" />
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Walls are invisible (classic cognitive rules) */}
                  {blocked && null}
                </div>
              );
            })}
          </div>

          {/* HUD */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="bg-slate-700 rounded-full px-6 py-3 flex items-center space-x-3 border-2 border-slate-600 shadow-lg">
                <Clock className="w-6 h-6 text-slate-200" />
                <span className="text-2xl font-bold text-white">{formatTime(timeLeft)}</span>
              </div>
            </div>

            <button
              onClick={onGameExit}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg"
            >
              Exit Game
            </button>
          </div>
        </div>
      </div>

      {/* HOW TO PLAY MODAL */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-lg rounded-2xl border-2 border-slate-700 bg-slate-900 text-slate-100 p-6"
            >
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-6 h-6 text-cyan-300" />
                <h3 className="text-xl font-bold">How to Play</h3>
              </div>
              <ol className="list-decimal pl-5 space-y-2 text-slate-200 leading-6">
                <li>Tap / click an adjacent tile (↑ ↓ ← →) to move the player.</li>
                <li>Collect exactly <span className="text-yellow-400 font-semibold">one 🔑 key</span>.</li>
                <li>After collecting the key, reach the <span className="text-green-400 font-semibold">🏠 door</span>.</li>
                <li>Hidden walls reset you to the start and the key reappears at its original position.</li>
                <li>Finish before the clock hits 0 to maximize your score.</li>
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                  <p className="font-semibold mb-1 text-white">Scoring</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    <li>Base: 1000</li>
                    <li>-2 per second used</li>
                    <li>-5 per move</li>
                  </ul>
                </div>
                <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-3">
                  <p className="font-semibold mb-1 text-white">Tips</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">
                    <li>Memorize safe corridors.</li>
                    <li>If blocked, try a different branch.</li>
                    <li>Keep moves minimal.</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowHowTo(false)}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                >
                  Start Playing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile notice */}
      <AnimatePresence>
        {showMobileNotice && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-2xl border-2 border-slate-700 bg-slate-900 text-slate-100 p-6"
            >
              <h3 className="text-xl font-bold mb-2">Best on Desktop/Laptop</h3>
              <p className="text-slate-300 leading-6">
                For the intended practice experience, please open this game on a
                <span className="font-semibold text-white"> desktop or laptop</span>. On phone, enable
                <span className="font-semibold"> “Desktop site”</span> and zoom out a bit.
              </p>
              <div className="mt-4 text-sm text-slate-300 space-y-2">
                <p className="font-semibold">Quick tips:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Chrome (Android): ⋮ → <em>Desktop site</em></li>
                  <li>Safari (iOS): aA → <em>Request Desktop Website</em></li>
                </ul>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => setShowMobileNotice(false)}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
                >
                  Continue on Mobile
                </button>
                <button
                  onClick={onGameExit}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100"
                >
                  Exit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KeyFinderGame;
