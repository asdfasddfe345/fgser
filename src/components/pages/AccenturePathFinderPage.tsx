import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { gamingService } from '../../services/gamingService';
import { AccenturePathFinderGame } from '../games/AccenturePathFinderGame';
import { GameLevel, GamingCompany } from '../../types/gaming';
import { Trophy, Clock, Target, ArrowRight } from 'lucide-react';

export const AccenturePathFinderPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<GamingCompany | null>(null);
  const [levels, setLevels] = useState<GameLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<GameLevel | null>(null);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGameData();
  }, []);

  const loadGameData = async () => {
    try {
      const companies = await gamingService.getAllCompanies();
      const accenture = companies.find(c => c.name === 'Accenture');

      if (accenture) {
        setCompany(accenture);
        const gameLevels = await gamingService.getCompanyLevels(accenture.id);
        setLevels(gameLevels);
      }
    } catch (error) {
      console.error('Error loading game data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLevelSelect = (level: GameLevel) => {
    setSelectedLevel(level);
  };

  const handleGameComplete = (score: number, time: number, moves: number, xpEarned: number) => {
    alert(`Game Complete!\nScore: ${score}\nTime: ${time}s\nMoves: ${moves}\nXP Earned: ${xpEarned}`);
    setSelectedLevel(null);
    loadGameData();
  };

  const handleGameExit = () => {
    setSelectedLevel(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-cyan-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Sign In Required</h2>
          <p className="text-gray-300 mb-6">Please sign in to play Path Finder.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-cyan-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-200">Loading game...</p>
        </div>
      </div>
    );
  }

  if (selectedLevel) {
    return (
      <AccenturePathFinderGame
        level={selectedLevel}
        onGameComplete={handleGameComplete}
        onGameExit={handleGameExit}
        isPracticeMode={isPracticeMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-cyan-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-['Orbitron']">
            Accenture Path Finder
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Test your logical thinking and problem-solving skills. Connect the space shuttle to the planet by rotating arrow tiles to create a valid path.
          </p>
        </div>

        <div className="mb-8 flex justify-center">
          <label className="flex items-center space-x-3 bg-gray-800 px-6 py-3 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={isPracticeMode}
              onChange={(e) => setIsPracticeMode(e.target.checked)}
              className="w-5 h-5 text-cyan-600 rounded"
            />
            <span className="text-white font-semibold">Practice Mode (Unlimited Time)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {levels.map((level, index) => (
            <div
              key={level.id}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border-2 border-cyan-500/30 hover:border-cyan-500 transition-all cursor-pointer shadow-lg hover:shadow-neon-cyan"
              onClick={() => handleLevelSelect(level)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white">Level {level.level_number}</h3>
                <Trophy className="w-8 h-8 text-yellow-400" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-gray-300">
                  <div className="flex items-center space-x-2">
                    <Target className="w-5 h-5 text-green-400" />
                    <span>Grid Size:</span>
                  </div>
                  <span className="font-semibold text-white">{level.grid_size}x{level.grid_size}</span>
                </div>

                <div className="flex items-center justify-between text-gray-300">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span>Time Limit:</span>
                  </div>
                  <span className="font-semibold text-white">{level.time_limit_seconds}s</span>
                </div>

                <div className="flex items-center justify-between text-gray-300">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span>Target Score:</span>
                  </div>
                  <span className="font-semibold text-white">{level.target_score}</span>
                </div>
              </div>

              <button
                className="mt-6 w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all shadow-neon-cyan"
              >
                <span>Play Level {level.level_number}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
