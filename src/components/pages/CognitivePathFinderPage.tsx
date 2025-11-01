import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CognitivePathFinderGame } from '../games/CognitivePathFinderGame';

export const CognitivePathFinderPage: React.FC = () => {
  const navigate = useNavigate();

  const handleExit = () => {
    navigate('/gaming');
  };

  return <CognitivePathFinderGame onExit={handleExit} />;
};
