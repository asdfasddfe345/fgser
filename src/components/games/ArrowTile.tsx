import React from 'react';
import { motion } from 'framer-motion';
import { GridTile } from '../../types/pathfinder';
import { Rocket, Globe } from 'lucide-react';

interface ArrowTileProps {
  tile: GridTile;
  onSelect: () => void;
  isDisabled?: boolean;
}

export const ArrowTile: React.FC<ArrowTileProps> = ({ tile, onSelect, isDisabled = false }) => {
  const renderArrows = () => {
    const { arrow_directions } = tile.pattern;
    const arrows: JSX.Element[] = [];

    arrow_directions.forEach((direction, index) => {
      let transform = '';
      let position = '';

      switch (direction) {
        case 'up':
          transform = 'rotate(0deg)';
          position = 'top-1';
          break;
        case 'down':
          transform = 'rotate(180deg)';
          position = 'bottom-1';
          break;
        case 'left':
          transform = 'rotate(-90deg)';
          position = 'left-1';
          break;
        case 'right':
          transform = 'rotate(90deg)';
          position = 'right-1';
          break;
      }

      arrows.push(
        <div
          key={`${direction}-${index}`}
          className={`absolute ${position} inset-x-0 flex justify-center items-center`}
          style={{ transform }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="text-white drop-shadow-lg"
          >
            <path d="M10 0 L15 8 L12 8 L12 12 L8 12 L8 8 L5 8 Z" />
          </svg>
        </div>
      );
    });

    return arrows;
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

  return (
    <motion.button
      onClick={onSelect}
      disabled={isDisabled || tile.isStart || tile.isEnd}
      className={`
        relative aspect-square w-full rounded-lg border-2 ${getBorderColor()}
        bg-gradient-to-br ${getTileColor()}
        overflow-hidden
        disabled:cursor-not-allowed
        ${!tile.isStart && !tile.isEnd && !isDisabled ? 'hover:scale-105 hover:shadow-neon-cyan cursor-pointer' : ''}
        transition-all duration-200
        flex items-center justify-center
      `}
      whileHover={!tile.isStart && !tile.isEnd && !isDisabled ? { scale: 1.05 } : {}}
      whileTap={!tile.isStart && !tile.isEnd && !isDisabled ? { scale: 0.95 } : {}}
      animate={{
        rotate: tile.rotation
      }}
      transition={{
        rotate: {
          type: 'spring',
          stiffness: 300,
          damping: 30
        }
      }}
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
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
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
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}
    </motion.button>
  );
};
