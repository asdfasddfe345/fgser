import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCw, Repeat, RotateCcw, Clock, Target, Trophy, Zap, CheckCircle, XCircle } from 'lucide-react';
import { ArrowTile } from './ArrowTile';
import { pathFinderService } from '../../services/pathFinderService';
import { GridConfig, GameState } from '../../types/pathfinder';

interface Props {
  level: { id: string; level_number: number; grid_size: number; target_score: number };
  onGameComplete: (score:number, time:number, moves:number, xp:number)=>void;
  onGameExit: () => void;
  isPracticeMode?: boolean;
}

export const AccenturePathFinderGame: React.FC<Props> = ({ level, onGameComplete, onGameExit, isPracticeMode=false }) => {
  const [grid, setGrid] = useState<GridConfig | null>(null);
  const [game, setGame] = useState<GameState>({
    status:'idle', selectedTile:null, timeRemaining:240, totalMoves:0,
    rotationCount:0, flipCount:0, currentScore:0, isPathValid:false
  });
  const timerRef = useRef<NodeJS.Timeout|null>(null);

  useEffect(()=>{ init(); return ()=>{ if(timerRef.current) clearInterval(timerRef.current); }; },[level]);

  function init(){
    const g = pathFinderService.generateGrid(level.grid_size, level.level_number);
    setGrid(g);
    setGame({ status:'ready', selectedTile:null, timeRemaining:240, totalMoves:0,
      rotationCount:0, flipCount:0, currentScore:0, isPathValid:false });
  }

  function start(){
    if (!grid) return;
    setGame(s=>({ ...s, status:'playing' }));
    if (!isPracticeMode){
      timerRef.current = setInterval(()=>{
        setGame(prev=>{
          const t = prev.timeRemaining-1;
          if (t<=0){ if(timerRef.current) clearInterval(timerRef.current); return { ...prev, status:'failed', timeRemaining:0 }; }
          return { ...prev, timeRemaining:t };
        });
      },1000);
    }
  }

  function pause(){ if(timerRef.current){ clearInterval(timerRef.current); timerRef.current=null; } setGame(s=>({...s,status:'paused'})); }
  function resume(){ setGame(s=>({...s,status:'playing'})); if(!isPracticeMode){ start(); } }
  function reset(){ if(timerRef.current){ clearInterval(timerRef.current); timerRef.current=null; } init(); }

  function select(row:number,col:number){
    if (game.status!=='playing' || !grid) return;
    const t = grid.tiles[row][col];
    if (t.isStart || t.isEnd) return;
    setGame(s=>({ ...s, selectedTile:{row,col} }));
    const g = { ...grid };
    g.tiles = g.tiles.map((r,ri)=> r.map((tt,ci)=> ({ ...tt, isSelected: ri===row && ci===col })));
    setGrid(g);
  }

  function rotate(){
    if (!grid || !game.selectedTile || game.status!=='playing') return;
    const {row,col} = game.selectedTile;
    const g = { ...grid };
    g.tiles[row][col] = pathFinderService.rotateTile(g.tiles[row][col]);
    setGrid(g);
    const total = game.totalMoves+1, rc = game.rotationCount+1;
    setGame(s=>({ ...s, totalMoves:total, rotationCount:rc }));
    validate(g);
  }
  function flip(){
    if (!grid || !game.selectedTile || game.status!=='playing') return;
    const {row,col} = game.selectedTile;
    const g = { ...grid };
    g.tiles[row][col] = pathFinderService.flipTile(g.tiles[row][col]);
    setGrid(g);
    const total = game.totalMoves+1, fc = game.flipCount+1;
    setGame(s=>({ ...s, totalMoves:total, flipCount:fc }));
    validate(g);
  }

  function validate(g: GridConfig){
    const res = pathFinderService.validatePath(g);
    const gg = { ...g };
    gg.tiles = gg.tiles.map(row => row.map(t => ({
      ...t,
      isInPath: res.pathTiles.some(p=>p.row===t.row && p.col===t.col)
    })));
    setGrid(gg);
    setGame(s=>({ ...s, isPathValid: res.isValid }));
    if (res.isValid) complete(gg);
  }

  function complete(g: GridConfig){
    if (timerRef.current){ clearInterval(timerRef.current); timerRef.current=null; }
    const elapsed = 240 - game.timeRemaining;
    const score = pathFinderService.calculateScore(elapsed, 240, game.totalMoves, g.optimalMoves);
    setGame(s=>({ ...s, status:'completed', currentScore: score.finalScore }));
    onGameComplete(score.finalScore, elapsed, game.totalMoves, 0);
  }

  const timeFmt = (s:number)=> `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  if (!grid) return <div className="p-6 text-center text-white">Generating puzzle…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-cyan-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-['Orbitron']">Accenture Path Finder</h1>
            <p className="text-gray-300 mt-1">Level {level.level_number} — {level.grid_size}×{level.grid_size}</p>
            {isPracticeMode && <p className="text-yellow-300 text-sm">Practice Mode — Unlimited time</p>}
          </div>
          <button onClick={onGameExit} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Exit</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {!isPracticeMode && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30">
              <div className="flex items-center space-x-3">
                <Clock className="w-6 h-6 text-cyan-400"/>
                <div><p className="text-sm text-gray-400">Time Remaining</p>
                  <p className={`text-2xl font-bold ${game.timeRemaining<30 ? 'text-red-400':'text-white'}`}>{timeFmt(game.timeRemaining)}</p></div>
              </div>
            </div>
          )}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30">
            <div className="flex items-center space-x-3">
              <Target className="w-6 h-6 text-green-400"/>
              <div><p className="text-sm text-gray-400">Total Moves</p>
                <p className="text-2xl font-bold text-white">{game.totalMoves} / {grid.optimalMoves}</p></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30">
            <div className="flex items-center space-x-3">
              <Trophy className="w-6 h-6 text-yellow-400"/>
              <div><p className="text-sm text-gray-400">Target Score</p>
                <p className="text-2xl font-bold text-white">{level.target_score}</p></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-cyan-500/30">
            <div className="flex items-center space-x-3">
              <Zap className="w-6 h-6 text-purple-400"/>
              <div><p className="text-sm text-gray-400">Actions</p>
                <p className="text-2xl font-bold text-white">R:{game.rotationCount} F:{game.flipCount}</p></div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-cyan-500/30">
          <div className="flex items-center justify-center mb-4 gap-3 flex-wrap">
            {game.status==='ready' && (
              <button onClick={start} className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                <Play className="w-5 h-5"/>Start
              </button>
            )}
            {game.status==='playing' && (
              <>
                <button onClick={pause} className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg">
                  <Pause className="w-5 h-5"/>Pause
                </button>
                <button onClick={rotate} disabled={!game.selectedTile}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
                  <RotateCw className="w-5 h-5"/>Rotate
                </button>
                <button onClick={flip} disabled={!game.selectedTile}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50">
                  <Repeat className="w-5 h-5"/>Flip
                </button>
              </>
            )}
            {game.status==='paused' && (
              <button onClick={resume} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                <Play className="w-5 h-5"/>Resume
              </button>
            )}
            <button onClick={reset} className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
              <RotateCcw className="w-5 h-5"/>Reset
            </button>
          </div>

          <div className="flex justify-center">
            <div className="inline-grid gap-2 p-4 bg-gray-900/50 rounded-lg"
                 style={{ gridTemplateColumns:`repeat(${level.grid_size}, minmax(0, 1fr))`, maxWidth:'640px', width:'100%' }}>
              {grid.tiles.map((row,ri)=> row.map((tile,ci)=>(
                <ArrowTile key={`${ri}-${ci}`} tile={tile}
                  onSelect={()=>select(ri,ci)} isDisabled={game.status!=='playing'} />
              )))}
            </div>
          </div>

          <div className="mt-4 text-center text-gray-300 text-sm">
            {game.selectedTile ? `Selected: Row ${game.selectedTile.row+1}, Col ${game.selectedTile.col+1}` : 'Select a tile to Rotate/Flip'}
          </div>
        </div>

        <AnimatePresence>
          {game.status==='completed' && (
            <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full text-center border-2 border-cyan-500">
                <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4"/>
                <h2 className="text-3xl font-bold text-white mb-2">Level Complete!</h2>
                <p className="text-gray-300 mb-6">Path completed in {game.totalMoves} moves.</p>
                <button onClick={onGameExit} className="w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg">Continue</button>
              </div>
            </motion.div>
          )}
          {game.status==='failed' && (
            <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full text-center border-2 border-red-500">
                <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4"/>
                <h2 className="text-3xl font-bold text-white mb-2">Time’s up!</h2>
                <div className="flex gap-3 mt-4">
                  <button onClick={reset} className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Try Again</button>
                  <button onClick={onGameExit} className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg">Exit</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
