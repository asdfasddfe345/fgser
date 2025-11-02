// src/components/games/KeyFinderGame.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Info, X, Smartphone, MonitorSmartphone } from 'lucide-react';
import { keyFinderService } from '../../services/keyFinderService';

type Difficulty = 'easy' | 'medium' | 'hard';
type Dir = 'u' | 'd' | 'l' | 'r';

interface KeyFinderGameProps {
  difficulty: Difficulty;             // 'easy' => 4x4, 'medium' => 5x5, 'hard' => 6x6
  userId: string;
  onGameComplete: (score: number, time: number, moves: number) => void;
  onGameExit: () => void;
  boardPx?: number;                   // default desktop target width/height
}

interface Pos { x: number; y: number; }

const GRID_MAP = { easy: 4, medium: 5, hard: 6 } as const;
const TIME_MAP = { easy: 300, medium: 300, hard: 300 } as const;
const DENSITY_MAP = { easy: 0.18, medium: 0.22, hard: 0.26 } as const;

const arrowForDelta = (dx: number, dy: number) => {
  if (dx === 1) return '▶';
  if (dx === -1) return '◀';
  if (dy === 1) return '▼';
  if (dy === -1) return '▲';
  return '';
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

const KeyFinderGame: React.FC<KeyFinderGameProps> = ({
  difficulty,
  userId,
  onGameComplete,
  onGameExit,
  boardPx = 720,
}) => {
  // ---------- grid & timing ----------
  const gridSize = GRID_MAP[difficulty];
  const timeLimit = TIME_MAP[difficulty];

  // ---------- viewport-aware sizing ----------
  const [vw, setVw] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [vh, setVh] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 768);
  const [fitToScreen, setFitToScreen] = useState(true);

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Room for header/footer on phones
  const maxBoardByW = Math.max(280, vw - 32);    // 16px side padding
  const maxBoardByH = Math.max(280, vh - 220);   // controls + copy space
  const autoBoard = Math.min(boardPx, maxBoardByW, maxBoardByH);
  const boardSize = fitToScreen ? autoBoard : boardPx;

  // 2px smaller cells (as requested)
  const cell = useMemo(() => Math.max(24, Math.floor(boardSize / gridSize) - 2), [boardSize, gridSize]);

  // ---------- game state ----------
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
  const [showHelp, setShowHelp] = useState(true);

  const timerRef = useRef<number | null>(null);
  const flashTO = useRef<number | null>(null);

  // init when difficulty changes
  useEffect(() => { init(); /* eslint-disable-next-line */ }, [difficulty]);

  // ticking timer
  useEffect(() => {
    if (!started || over) return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onTimeoutInternal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as number;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [started, over]);

  const init = () => {
    // scatter walls
    const obstacles: Pos[] = [];
    const obstacleCount = Math.floor(gridSize * gridSize * DENSITY_MAP[difficulty]);
    while (obstacles.length < obstacleCount) {
      const w = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) };
      // avoid start & dupes
      if (!(w.x === 0 && w.y === 0) && !obstacles.some(o => o.x === w.x && o.y === w.y)) {
        obstacles.push(w);
      }
    }

    // place key
    let k: Pos;
    do { k = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) }; }
    while ((k.x === 0 && k.y === 0) || obstacles.some(o => o.x === k.x && o.y === k.y));

    // place exit
    let e: Pos;
    do { e = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) }; }
    while (
      (e.x === 0 && e.y === 0) ||
      (e.x === k.x && e.y === k.y) ||
      obstacles.some(o => o.x === e.x && o.y === e.y)
    );

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
  const isNeighbor = (x: number, y: number) => (Math.abs(x - player.x) + Math.abs(y - player.y)) === 1;

  const tryMove = useCallback((dx: number, dy: number) => {
    if (over || !started) return;
    const target = { x: player.x + dx, y: player.y + dy };
    if (!inBounds(target)) return;

    if (isWall(target)) {
      const dir: Dir = dx === 1 ? 'r' : dx === -1 ? 'l' : dy === 1 ? 'd' : 'u';
      setFlashEdge({ x: player.x, y: player.y, dir });
      if (flashTO.current) window.clearTimeout(flashTO.current);
      flashTO.current = window.setTimeout(() => setFlashEdge(null), 220) as unknown as number;

      // collision → reset to start & drop key (key icon appears again)
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
    if (hasKey && target.x === exitPos.x && target.y === exitPos.y) void onCompleteInternal();
  }, [player, hasKey, over, started, walls, keyPos, exitPos]);

  const onCellClick = (x: number, y: number) => {
    const dx = x - player.x;
    const dy = y - player.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    tryMove(Math.sign(dx), Math.sign(dy));
  };

  // keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || over) return;
      if (e.key === 'ArrowUp') { e.preventDefault(); tryMove(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); tryMove(0, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); tryMove(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); tryMove(1, 0); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tryMove, started, over]);

  // completion / timeout
  const onCompleteInternal = async () => {
    setOver(true);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
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
    } catch { /* ignore */ }
    setTimeout(() => onGameComplete(score, timeTaken, moves), 500);
  };

  const onTimeoutInternal = async () => {
    setOver(true);
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    try {
      await keyFinderService.saveGameResult({
        user_id: userId,
        difficulty,
        score: 0,
        time_taken: timeLimit,
        moves_count: moves,
        completed: false,
      });
    } catch { /* ignore */ }
    // give a moment for the overlay
    setTimeout(onGameExit, 800);
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 py-6 px-3 flex items-center justify-center">
      <div className="w-full max-w-6xl">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(s => !s)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750"
            >
              <Info className="w-4 h-4" />
              How to Play
            </button>

            <button
              onClick={() => setFitToScreen(s => !s)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-700 text-white hover:bg-cyan-600"
              title={fitToScreen ? 'Switch to 100% size' : 'Fit to screen'}
            >
              {fitToScreen ? <Smartphone className="w-4 h-4" /> : <MonitorSmartphone className="w-4 h-4" />}
              {fitToScreen ? '100% Size' : 'Fit to Screen'}
            </button>
          </div>

          <div className="px-4 py-2 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-200" />
            <span className={`text-xl font-bold ${timeLeft < 20 ? 'text-red-400' : ''}`}>{fmt(timeLeft)}</span>
          </div>
        </div>

        {/* Mobile banner */}
        {vw < 768 && (
          <div className="mb-3">
            <div className="mx-auto w-fit px-3 py-2 rounded-full text-xs md:text-sm bg-slate-900/80 border border-slate-700 text-slate-100 shadow">
              Best experienced on a desktop/laptop. On mobile, try “Desktop site” or tap “Fit to Screen”.
            </div>
          </div>
        )}

        {/* Board */}
        <div className="bg-slate-900/60 rounded-3xl shadow-2xl p-4 border-2 border-slate-800 relative">
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
                  {/* neighbor hint diamond + arrow */}
                  {neighbor && !isPlayer && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rotate-45 rounded-sm bg-white/30 shadow-sm" />
                      <div className="absolute text-slate-800/80 text-lg font-semibold">
                        {arrowForDelta(x - player.x, y - player.y)}
                      </div>
                    </div>
                  )}

                  {/* collision flash on active cell */}
                  {flashEdge && isPlayer && (
                    <div className="absolute inset-0">
                      {flashEdge.dir === 'u' && <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />}
                      {flashEdge.dir === 'd' && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-red-500" />}
                      {flashEdge.dir === 'l' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                      {flashEdge.dir === 'r' && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-red-500" />}
                    </div>
                  )}

                  {/* player / key / exit */}
                  {isPlayer && (
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                      className="w-full h-full flex items-center justify-center relative z-10">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-slate-700">
                        <span className="text-xl sm:text-2xl select-none">👤</span>
                      </div>
                    </motion.div>
                  )}
                  {showKey && !isPlayer && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl select-none">🔑</span>
                    </div>
                  )}
                  {showExit && !isPlayer && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl select-none">🏠</span>
                    </div>
                  )}

                  {/* walls are implicit: clicking them is blocked via logic */}
                </div>
              );
            })}
          </div>

          {/* bottom controls */}
          <div className="mt-6 text-center space-y-4">
            <p className="text-slate-200 text-base sm:text-lg font-medium">
              Collect <span className="text-yellow-400 font-bold">1 KEY</span> then reach the{' '}
              <span className="text-green-400 font-bold">DOOR</span>. Avoid walls — hitting one resets you to start and the key reappears.
            </p>
            <button
              onClick={onGameExit}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors shadow"
            >
              Exit Game
            </button>
          </div>
        </div>

        {/* How to Play */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-4"
            >
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-semibold">How to Play</h3>
                  <button onClick={() => setShowHelp(false)} className="p-1 rounded hover:bg-slate-800">
                    <X className="w-4 h-4 text-slate-300" />
                  </button>
                </div>
                <ul className="text-sm space-y-1.5 leading-6">
                  <li>• Tap/click a neighboring cell (or use Arrow keys) to move.</li>
                  <li>• First collect the <span className="text-yellow-300">🔑 key</span>, then go to the <span className="text-green-300">🏠 door</span>.</li>
                  <li>• Hitting a wall flashes red, sends you back to start, and the key shows again.</li>
                  <li>• Score = 1000 − 2×seconds − 5×moves. Finish faster with fewer moves for a higher score.</li>
                  <li>• Grid sizes: Easy 4×4, Medium 5×5, Hard 6×6.</li>
                  <li>• Best on desktop/laptop. On mobile, use “Desktop site” or tap “Fit to Screen”.</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlays */}
        <AnimatePresence>
          {over && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center border-4 border-slate-600"
              >
                <h2 className="text-3xl font-bold text-white mb-4">
                  {timeLeft === 0 ? "Time's Up!" : 'Great job!'}
                </h2>
                <p className="text-slate-300 text-lg">
                  {timeLeft === 0 ? 'You ran out of time. Try again!' : 'You found the door!'}
                </p>
                <button
                  onClick={onGameExit}
                  className="mt-6 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold"
                >
                  Continue
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default KeyFinderGame;
