import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Key, Clock, Target, Trophy, TrendingUp, BarChart3 } from 'lucide-react';
import { KeyFinderGame } from '../games/KeyFinderGame';
import { keyFinderService } from '../../services/keyFinderService';
import { KeyFinderLeaderboardEntry } from '../../types/keyFinder';
import { useAuth } from '../../contexts/AuthContext';

type GameMode = 'menu' | 'playing' | 'results';

interface GameResults {
  score: number;
  time: number;
  moves: number;
}

export const KeyFinderPage: React.FC = () => {
  const { user } = useAuth();
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [gameResults, setGameResults] = useState<GameResults | null>(null);
  const [leaderboard, setLeaderboard] = useState<KeyFinderLeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);

  useEffect(() => {
    if (gameMode === 'menu') {
      loadLeaderboard();
    }
  }, [gameMode, selectedDifficulty]);

  const loadLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const data = await keyFinderService.getLeaderboard(selectedDifficulty, 'all_time', 10);
      setLeaderboard(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const handleStartGame = () => {
    if (!user) {
      alert('Please sign in to play the game');
      return;
    }
    setGameMode('playing');
  };

  const handleGameComplete = (score: number, time: number, moves: number) => {
    setGameResults({ score, time, moves });
    setGameMode('results');
  };

  const handleGameExit = () => {
    setGameMode('menu');
    setGameResults(null);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (gameMode === 'playing' && user) {
    return (
      <KeyFinderGame
        difficulty={selectedDifficulty}
        userId={user.id}
        onGameComplete={handleGameComplete}
        onGameExit={handleGameExit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <Brain className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Accenture Key Finder
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Test your spatial memory and navigation skills in this cognitive assessment game used by Accenture
          </p>
        </motion.div>

        {gameMode === 'results' && gameResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-8 mb-8"
          >
            <div className="text-center mb-6">
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Game Complete!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Here are your results
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 text-center">
                <Trophy className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Final Score</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {gameResults.score}
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 text-center">
                <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Time Taken</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {formatTime(gameResults.time)}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 text-center">
                <Target className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Moves</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {gameResults.moves}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setGameResults(null);
                setGameMode('menu');
              }}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              Back to Menu
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setSelectedDifficulty('easy')}
            className={`
              bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6 cursor-pointer transition-all
              ${selectedDifficulty === 'easy'
                ? 'ring-4 ring-green-500 scale-105'
                : 'hover:shadow-2xl hover:scale-102'
              }
            `}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Easy</h3>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Key className="w-4 h-4 mr-2 text-green-600" />
                8x8 Grid Size
              </li>
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4 mr-2 text-green-600" />
                6 Minutes
              </li>
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Target className="w-4 h-4 mr-2 text-green-600" />
                Fewer Obstacles
              </li>
            </ul>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Perfect for beginners and practicing the basics
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => setSelectedDifficulty('medium')}
            className={`
              bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6 cursor-pointer transition-all
              ${selectedDifficulty === 'medium'
                ? 'ring-4 ring-blue-500 scale-105'
                : 'hover:shadow-2xl hover:scale-102'
              }
            `}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Medium</h3>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Key className="w-4 h-4 mr-2 text-blue-600" />
                10x10 Grid Size
              </li>
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4 mr-2 text-blue-600" />
                5 Minutes
              </li>
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Target className="w-4 h-4 mr-2 text-blue-600" />
                Moderate Obstacles
              </li>
            </ul>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Standard difficulty matching Accenture assessment
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => setSelectedDifficulty('hard')}
            className={`
              bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6 cursor-pointer transition-all
              ${selectedDifficulty === 'hard'
                ? 'ring-4 ring-red-500 scale-105'
                : 'hover:shadow-2xl hover:scale-102'
              }
            `}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hard</h3>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Brain className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Key className="w-4 h-4 mr-2 text-red-600" />
                12x12 Grid Size
              </li>
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4 mr-2 text-red-600" />
                4 Minutes
              </li>
              <li className="flex items-center text-gray-600 dark:text-gray-400">
                <Target className="w-4 h-4 mr-2 text-red-600" />
                Many Obstacles
              </li>
            </ul>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maximum challenge for memory and navigation skills
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-8"
        >
          <button
            onClick={handleStartGame}
            className="px-12 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            Start Game
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Top Players - {selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)}
              </h2>
            </div>
          </div>

          {isLoadingLeaderboard ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`
                    flex items-center justify-between p-4 rounded-lg transition-colors
                    ${index < 3
                      ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20'
                      : 'bg-gray-50 dark:bg-dark-200'
                    }
                  `}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold
                      ${index === 0 ? 'bg-yellow-500 text-white' : ''}
                      ${index === 1 ? 'bg-gray-400 text-white' : ''}
                      ${index === 2 ? 'bg-orange-600 text-white' : ''}
                      ${index > 2 ? 'bg-gray-300 dark:bg-dark-300 text-gray-700 dark:text-gray-300' : ''}
                    `}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {entry.user_name || 'Anonymous'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {entry.completion_count} completions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {entry.highest_score}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {entry.fewest_moves} moves
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No scores yet. Be the first to complete this difficulty!
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6"
        >
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            How to Play
          </h3>
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="font-bold mr-2">1.</span>
              Navigate through an invisible maze using arrow keys
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              Find the hidden key first, then locate the exit door
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              If you hit a wall, you'll restart from the beginning
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">4.</span>
              Use your memory to remember wall locations and complete faster
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">5.</span>
              Complete within the time limit to earn a high score
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
};
