import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, Globe } from 'lucide-react';
import { GridTile } from '../../types/pathfinder';

interface Props {
  tile: GridTile;
  onSelect: () => void;
  isDisabled?: boolean;
}

export const ArrowTile: React.FC<Props> = ({ tile, onSelect, isDisabled=false }) => {
  const color = tile.isStart ? 'from-green-500 to-green-600'
    : tile.isEnd ? 'from-red-500 to-red-600'
    : tile.isSelected ? 'from-yellow-400 to-yellow-500'
    : tile.isInPath ? 'from-blue-500 to-blue-600'
    : 'from-slate-600 to-slate-700';

  const border = tile.isSelected ? 'border-yellow-300'
    : tile.isInPath ? 'border-blue-300'
    : 'border-slate-500';

  const renderArrows = () => {
    const arrows: JSX.Element[] = [];
    tile.pattern.arrow_directions.forEach((dir, i) => {
      let rotate = 0, pos = '';
      if (dir === 'up') { rotate = 0; pos = 'top-1 left-0 right-0'; }
      if (dir === 'down') { rotate = 180; pos = 'bottom-1 left-0 right-0'; }
      if (dir === 'left') { rotate = -90; pos = 'left-1 top-0 bottom-0'; }
      if (dir === 'right') { rotate = 90; pos = 'right-1 top-0 bottom-0'; }
      arrows.push(
        <div key={`${dir}-${i}`} className={`absolute ${pos} flex items-center justify-center`}>
          <svg width="18" height="18" viewBox="0 0 20 20" className="text-white" style={{ transform:`rotate(${rotate}deg)` }}>
            <path d="M10 1 L17 10 L12.5 10 L12.5 17 L7.5 17 L7.5 10 L3 10 Z" fill="currentColor"/>
          </svg>
        </div>
      );
    });
    return arrows;
  };

  return (
    <motion.button
      onClick={onSelect}
      disabled={isDisabled || tile.isStart || tile.isEnd}
      className={`relative aspect-square w-full rounded-lg border-2 ${border}
                  bg-gradient-to-br ${color} overflow-hidden disabled:opacity-60
                  ${!tile.isStart && !tile.isEnd && !isDisabled ? 'hover:scale-105 cursor-pointer' : ''} transition-all`}
      whileTap={!tile.isStart && !tile.isEnd && !isDisabled ? { scale: 0.95 } : {}}
      animate={{ rotate: tile.rotation }}
      transition={{ rotate: { type:'spring', stiffness: 300, damping: 30 }}}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {tile.isStart ? <Rocket className="w-6 h-6 text-white"/> :
         tile.isEnd ? <Globe className="w-6 h-6 text-white"/> :
         renderArrows()}
      </div>
      {tile.isInPath && (
        <motion.div className="absolute inset-0 bg-blue-400/20"
          initial={{ opacity:0 }} animate={{ opacity:[0,0.5,0] }}
          transition={{ duration:2, repeat:Infinity, ease:'easeInOut' }}/>
      )}
    </motion.button>
  );
};
