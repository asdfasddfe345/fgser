import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ArrowRight, XCircle, CheckCircle, Clock } from 'lucide-react';
import KeyFinderGame from './KeyFinderGame'; // <-- adjust import path

type Difficulty = 'easy' | 'medium' | 'hard';

interface SeriesResult {
  level: Difficulty;
  score: number;
  timeTaken: number;
  moves: number;
  completed: boolean;
}

interface KeyFinderLevelsProps {
  userId: string;
  onSeriesComplete?: (summary: {
    totalScore: number;
    totalTime: number;
    totalMoves: number;
    results: SeriesResult[];
  }) => void;
  onExit?: () => void; // user quits mid-series
  // Optional: if you want to start from a specific level
  startLevel?: Difficulty; // 'easy'|'medium'|'hard'
  autoAdvanceDelayMs?: number; // default 1200
}

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

const label = (d: Difficulty) =>
  d === 'easy' ? 'Easy' : d === 'medium' ? 'Medium' : 'Hard';

const KeyFinderLevels: React.FC<KeyFinderLevelsProps> = ({
  userId,
  onSeriesComplete,
  onExit,
  startLevel = 'easy',
  autoAdvanceDelayMs = 1200,
}) => {
  const startIdx = useMemo(
    () => Math.max(0, LEVELS.indexOf(startLevel)),
    [startLevel]
  );

  const [levelIndex, setLevelIndex] = useState<number>(startIdx);
  const [results, setResults] = useState<SeriesResult[]>([]);
  const [showInterlude, setShowInterlude] = useState<null | {
    title: string;
    subtitle?: string;
    icon: 'win' | 'fail';
  }>(null);
  const [seriesDone, setSeriesDone] = useState(false);

  const totalScore = useMemo(
    () => results.reduce((s, r) => s + r.score, 0),
    [results]
  );
  const totalTime = useMemo(
    () => results.reduce((s, r) => s + r.timeTaken, 0),
    [results]
  );
  const totalMoves = useMemo(
    () => results.reduce((s, r) => s + r.moves, 0),
    [results]
  );

  const autoNextTimer = useRef<number | null>(null);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    };
  }, []);

  const currentLevel = LEVELS[levelIndex];

  // When a level is completed successfully
  const handleLevelComplete = (score: number, time: number, moves: number) => {
    const entry: SeriesResult = {
      level: currentLevel,
      score,
      timeTaken: time,
      moves,
      completed: true,
    };
    setResults(prev => [...prev, entry]);

    const hasNext = levelIndex < LEVELS.length - 1;

    setShowInterlude({
      title: 'Level Cleared!',
      subtitle: hasNext
        ? `Next up: ${label(LEVELS[levelIndex + 1])}`
        : 'Series Complete',
      icon: 'win',
    });

    // Auto-advance to the next level or finish the series
    if (hasNext) {
      if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
      autoNextTimer.current = window.setTimeout(() => {
        setShowInterlude(null);
        setLevelIndex(i => i + 1);
      }, autoAdvanceDelayMs);
    } else {
      // End of series
      if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
      autoNextTimer.current = window.setTimeout(() => {
        setShowInterlude(null);
        setSeriesDone(true);
        onSeriesComplete?.({
          totalScore,
          totalTime,
          totalMoves,
          results: [...results, entry],
        });
      }, autoAdvanceDelayMs);
    }
  };

  // When a level is NOT completed (timeout or user pressed Exit)
  const handleLevelExit = () => {
    const entry: SeriesResult = {
      level: currentLevel,
      score: 0,
      timeTaken: 300, // your child component uses 5:00 (300s) timing
      moves: 0,
      completed: false,
    };
    setResults(prev => [...prev, entry]);
    setShowInterlude({
      title: 'Level Failed',
      subtitle: 'Series ended. Try again!',
      icon: 'fail',
    });

    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    autoNextTimer.current = window.setTimeout(() => {
      setShowInterlude(null);
      setSeriesDone(true);
      onSeriesComplete?.({
        totalScore,
        totalTime,
        totalMoves,
        results: [...results, entry],
      });
    }, autoAdvanceDelayMs);
  };

  const restartSeries = () => {
    if (autoNextTimer.current) window.clearTimeout(autoNextTimer.current);
    setLevelIndex(startIdx);
    setResults([]);
    setSeriesDone(false);
    setShowInterlude(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 py-8 px-4 flex items-center justify-center">
      <div className="w-full max-w-6xl">
        {/* Header / Progress */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-white text-2xl font-semibold">Key Finder – 3 Level Series</h1>
            <p className="text-slate-300 text-sm">Complete each level to auto-advance. Each level: <strong>5:00</strong>.</p>
          </div>
          <div className="flex items-center gap-2">
            {LEVELS.map((lv, idx) => {
              const done = results.find(r => r.level === lv);
              const active = idx === levelIndex && !seriesDone;
              return (
                <div
                  key={lv}
                  className={`px-3 py-1 rounded-full border text-sm flex items-center gap-1
                    ${done ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200' :
                      active ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200' :
                      'bg-slate-700/40 border-slate-600 text-slate-300'}
                  `}
                  title={label(lv)}
                >
                  {label(lv)}
                  {idx < LEVELS.length - 1 && <ArrowRight className="w-3 h-3 opacity-70" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Level */}
        {!seriesDone && (
          <KeyFinderGame
            difficulty={currentLevel}
            userId={userId}
            onGameComplete={handleLevelComplete}
            onGameExit={handleLevelExit}
          />
        )}

        {/* Final Summary */}
        <AnimatePresence>
          {seriesDone && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-800 border-4 border-slate-600 rounded-2xl p-8 w-full max-w-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Trophy className="w-8 h-8 text-yellow-400" />
                  <h2 className="text-white text-2xl font-bold">Series Summary</h2>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                    <div className="text-slate-300 text-xs mb-1">Total Score</div>
                    <div className="text-white text-2xl font-semibold">{totalScore}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                    <div className="text-slate-300 text-xs mb-1">Total Time (s)</div>
                    <div className="text-white text-2xl font-semibold">{totalTime}</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                    <div className="text-slate-300 text-xs mb-1">Total Moves</div>
                    <div className="text-white text-2xl font-semibold">{totalMoves}</div>
                  </div>
                </div>

                <div className="bg-slate-700/40 rounded-xl overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/60 text-slate-300">
                      <tr>
                        <th className="p-3 text-left">Level</th>
                        <th className="p-3 text-right">Score</th>
                        <th className="p-3 text-right">Time (s)</th>
                        <th className="p-3 text-right">Moves</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, idx) => (
                        <tr key={idx} className="border-t border-slate-600/60 text-slate-200">
                          <td className="p-3">{label(r.level)}</td>
                          <td className="p-3 text-right">{r.score}</td>
                          <td className="p-3 text-right">{r.timeTaken}</td>
                          <td className="p-3 text-right">{r.moves}</td>
                          <td className="p-3 text-center">
                            {r.completed ? (
                              <span className="inline-flex items-center gap-1 text-emerald-300">
                                <CheckCircle className="w-4 h-4" /> Cleared
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-300">
                                <XCircle className="w-4 h-4" /> Failed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={onExit ?? (() => {})}
                    className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white"
                  >
                    Exit
                  </button>
                  <button
                    onClick={restartSeries}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    Restart Series
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inter-level overlay */}
        <AnimatePresence>
          {showInterlude && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-800 border-4 border-slate-600 rounded-2xl p-8 w-full max-w-md text-center"
              >
                <div className="flex items-center justify-center mb-3">
                  {showInterlude.icon === 'win' ? (
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  ) : (
                    <XCircle className="w-10 h-10 text-rose-400" />
                  )}
                </div>
                <h3 className="text-white text-2xl font-bold mb-1">{showInterlude.title}</h3>
                {showInterlude.subtitle && (
                  <p className="text-slate-300">{showInterlude.subtitle}</p>
                )}
                <div className="flex items-center justify-center gap-2 mt-4 text-slate-300">
                  <Clock className="w-4 h-4" />
                  <span>Advancing…</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default KeyFinderLevels;
