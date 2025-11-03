// src/components/pathfinder/ArrowTile.tsx
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
  const renderArrows = () => {
    const dirs = rotateDirections(tile.pattern.arrow_directions, tile.rotation);
    return dirs.map((d, i) => {
      const pos: Record<string, string> = {
        up: '-translate-y-2',
        down: 'translate-y-2',
        left: '-translate-x-2',
        right: 'translate-x-2'
      };
      const deg: Record<string, string> = { up: '0deg', right: '90deg', down: '180deg', left: '270deg' };
      return (
        <div key={i} className="absolute inset-0 flex items-center justify-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`text-white drop-shadow-lg transform ${pos[d]}`}
            style={{ rotate: deg[d] }}
          >
            <path d="M10 0 L15 8 L12 8 L12 12 L8 12 L8 8 L5 8 Z" />
          </svg>
        </div>
      );
    });
  };

  const getTileColor = () => {
    if (tile.isStart) return 'from-green-500 to-green-600';
    if (tile.isEnd) return 'from-red-500 to-red-600';
    if (tile.isSelected) return 'from-yellow-400 to-yellow-500';
    if (tile.isInPath) return 'from-blue-400 to-blue-500';
    return 'from-gray-600 to-gray-700';
  };

  const getBorderColor = () => {
    if (tile.isSelected) return 'border-yellow-300';
    if (tile.isInPath) return 'border-blue-300';
    return 'border-gray-500';
  };

  const clickable = !tile.isStart && !tile.isEnd && !isDisabled;

  return (
    <motion.button
      onClick={onSelect}
      disabled={!clickable}
      className={`
        relative aspect-square w-full rounded-lg border-2 ${getBorderColor()}
        bg-gradient-to-br ${getTileColor()}
        overflow-hidden disabled:cursor-not-allowed
        ${clickable ? 'hover:scale-105 hover:shadow-neon-cyan cursor-pointer' : ''}
        transition-all duration-200 flex items-center justify-center
      `}
      whileHover={clickable ? { scale: 1.05 } : {}}
      whileTap={clickable ? { scale: 0.95 } : {}}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {tile.isStart ? (
          <Rocket className="w-6 h-6 text-white" />
        ) : tile.isEnd ? (
          <Globe className="w-6 h-6 text-white" />
        ) : (
          <>
            {renderArrows()}
            {tile.isSelected && (
              <motion.div
                className="absolute inset-0 border-4 border-yellow-300 rounded-lg"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </>
        )}
      </div>

      {tile.isInPath && (
        <motion.div
          className="absolute inset-0 bg-blue-400/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.button>
  );
};
