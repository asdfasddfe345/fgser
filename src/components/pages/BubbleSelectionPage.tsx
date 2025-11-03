import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BubbleSelectionGame } from '../games/BubbleSelectionGame';
import { BubbleSelectionResults } from '../games/BubbleSelectionResults';

type GamePhase = 'menu' | 'playing' | 'results';

export const BubbleSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gamePhase, setGamePhase] = useState<GamePhase>('playing');
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);

  if (!user) {
    navigate('/gaming');
    return null;
  }

  const handleGameComplete = (sessionId: string) => {
    setCompletedSessionId(sessionId);
    setGamePhase('results');
  };

  const handlePlayAgain = () => {
    setCompletedSessionId(null);
    setGamePhase('playing');
  };

  const handleExit = () => {
    navigate('/gaming');
  };

  if (gamePhase === 'results' && completedSessionId) {
    return (
      <BubbleSelectionResults
        sessionId={completedSessionId}
        userId={user.id}
        onPlayAgain={handlePlayAgain}
        onExit={handleExit}
      />
    );
  }

  return (
    <BubbleSelectionGame
      userId={user.id}
      onGameComplete={handleGameComplete}
      onGameExit={handleExit}
    />
  );
};

export default BubbleSelectionPage;
