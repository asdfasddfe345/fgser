import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Globe } from 'lucide-react';
import { GridTile } from '../../types/pathfinder';
import { rotateDirections } from '../../helpers/direction';

interface ArrowTileProps {
  tile: GridTile;
  onSelect: () => void;
  isDisabled?: boolean;
}

export const ArrowTile: React.FC<ArrowTileProps> = ({ tile, onSelect, isDisabled = false }) => {
  const dirs = rotateDirections(tile.pattern.arrow_directions, tile.rotation);

  const renderArrows = () =>
    dirs.map((d, i) => {
      const rotate = d === 'up' ? '0deg' : d === 'right' ? '90deg' : d === 'down' ? '180deg' : '270deg';
      const offset =
        d === 'up' ? '-translate-y-2' : d === 'down' ? 'translate-y-2' : d === 'left' ? '-translate-x-2' : 'translate-x-2';
      return (
        <div key={i} className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" className={`text-white drop-shadow-lg transform ${offset}`} style={{ rotate }}>
            <path d="M10 0 L15 8 L12 8 L12 12 L8 12 L8 8 L5 8 Z" />
          </svg>
        </div>
      );
    });

  const baseTile = 'bg-gradient-to-br from-blue-600 to-blue-700';
  const inPathTile = 'from-blue-500 to-blue-600';
  const selectedRing = tile.isSelected ? 'ring-4 ring-yellow-300' : '';

  const colorClass = tile.isStart
    ? 'from-green-500 to-green-600'
    : tile.isEnd
      ? 'from-red-500 to-red-600'
      : tile.isInPath
        ? inPathTile
        : baseTile;

  const clickable = !tile.isStart && !tile.isEnd && !isDisabled;

  return (
    <motion.button
      onClick={onSelect}
      disabled={!clickable}
      className={`relative aspect-square w-full rounded-md border border-slate-800 bg-gradient-to-br ${colorClass} ${selectedRing} shadow-sm overflow-hidden disabled:cursor-not-allowed ${clickable ? 'hover:scale-[1.03] cursor-pointer' : ''} transition-all duration-150`}
      whileHover={clickable ? { scale: 1.03 } : {}}
      whileTap={clickable ? { scale: 0.97 } : {}}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {tile.isStart ? <Rocket className="w-5 h-5 text-white" /> : tile.isEnd ? <Globe className="w-5 h-5 text-white" /> : renderArrows()}
      </div>

      {tile.isInPath && !tile.isStart && !tile.isEnd && (
        <motion.div className="absolute inset-0 bg-blue-300/10" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} />
      )}
    </motion.button>
  );
};
