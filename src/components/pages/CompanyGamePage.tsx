import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  CheckCircle,
  Trophy,
  Clock,
  Target,
  Star,
  ArrowLeft,
  Info,
  TrendingUp
} from 'lucide-react';
import { gamingService } from '../../services/gamingService';
import { CompanyWithProgress, LevelWithProgress, LeaderboardEntry } from '../../types/gaming';
import { useAuth } from '../../contexts/AuthContext';
import { PathFinderGame } from '../games/PathFinderGame';

interface CompanyGamePageProps {
  onShowAuth: () => void;
}

export const CompanyGamePage: React.FC<CompanyGamePageProps> = ({ onShowAuth }) => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [companyData, setCompanyData] = useState<CompanyWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<LevelWithProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      onShowAuth();
      return;
    }

    if (companyId) {
      loadCompanyData();
    }
  }, [companyId, isAuthenticated, user]);

  const loadCompanyData = async () => {
    if (!user || !companyId) return;

    try {
      setLoading(true);
      const data = await gamingService.getCompanyWithProgress(user.id, companyId);
      setCompanyData(data);

      const leaderboardData = await gamingService.getLeaderboard(companyId, undefined, 'all_time', 10);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Error loading company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLevelClick = (levelData: LevelWithProgress) => {
    if (!levelData.progress?.is_unlocked) {
      return;
    }
    setShowInstructions(true);
    setSelectedLevel(levelData);
  };

  const handleStartGame = () => {
    setShowInstructions(false);
  };

  const handleGameComplete = async () => {
    setSelectedLevel(null);
    await loadCompanyData();
  };

  const handleGameExit = () => {
    setSelectedLevel(null);
  };

  const getLevelStatusIcon = (levelData: LevelWithProgress) => {
    if (levelData.progress?.is_completed) {
      return <CheckCircle className="w-6 h-6 text-green-600" />;
    }
    if (levelData.progress?.is_unlocked) {
      return <Target className="w-6 h-6 text-blue-600" />;
    }
    return <Lock className="w-6 h-6 text-gray-400" />;
  };

  const getLevelStars = (levelData: LevelWithProgress) => {
    if (!levelData.progress?.is_completed) return 0;
    const score = levelData.progress.best_score || 0;
    const target = levelData.level.target_score;

    if (score >= target * 1.5) return 3;
    if (score >= target * 1.2) return 2;
    if (score >= target) return 1;
    return 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Company not found</p>
          <button
            onClick={() => navigate('/gaming')}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Gaming
          </button>
        </div>
      </div>
    );
  }

  if (selectedLevel && !showInstructions && user) {
    return (
      <PathFinderGame
        level={selectedLevel.level}
        company={companyData.company}
        userId={user.id}
        onGameComplete={handleGameComplete}
        onGameExit={handleGameExit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-100">
      <div className="container-responsive py-12">
        <button
          onClick={() => navigate('/gaming')}
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Gaming Center</span>
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white dark:bg-dark-100 rounded-2xl p-8 shadow-lg"
            style={{ borderTop: `4px solid ${companyData.company.primary_color}` }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-white rounded-lg shadow-md flex items-center justify-center p-2">
                  <img
                    src={companyData.company.logo_url}
                    alt={companyData.company.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {companyData.company.name} Path Finder
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Complete all levels to master the challenge
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Your Score</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {companyData.totalScore.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Progress</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {companyData.completedLevels}/{companyData.totalLevels}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-200 dark:bg-dark-200 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${(companyData.completedLevels / companyData.totalLevels) * 100}%`,
                  backgroundColor: companyData.company.primary_color
                }}
              />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Levels</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {companyData.levels.map((levelData, index) => {
                const isLocked = !levelData.progress?.is_unlocked;
                const stars = getLevelStars(levelData);

                return (
                  <motion.button
                    key={levelData.level.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => handleLevelClick(levelData)}
                    disabled={isLocked}
                    className={`bg-white dark:bg-dark-100 rounded-xl p-6 shadow-lg text-left transition-all transform ${
                      isLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:shadow-xl hover:-translate-y-1'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getLevelStatusIcon(levelData)}
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          Level {levelData.level.level_number}
                        </h3>
                      </div>
                      {levelData.progress?.is_completed && (
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < stars
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Grid Size</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {levelData.level.grid_size}x{levelData.level.grid_size}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Time Limit</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {Math.floor(levelData.level.time_limit_seconds / 60)} min
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Target Score</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {levelData.level.target_score}
                        </span>
                      </div>
                    </div>

                    {levelData.progress?.is_completed && (
                      <div className="pt-4 border-t border-gray-200 dark:border-dark-300">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Best Score</span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {levelData.progress.best_score?.toLocaleString()}
                          </span>
                        </div>
                        {levelData.progress.best_time_seconds && (
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Best Time</span>
                            <span className="font-semibold text-blue-600 dark:text-neon-cyan-400">
                              {Math.floor(levelData.progress.best_time_seconds / 60)}:
                              {(levelData.progress.best_time_seconds % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {isLocked && (
                      <div className="pt-4 border-t border-gray-200 dark:border-dark-300">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Complete Level {levelData.level.level_number - 1} to unlock
                        </p>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Leaderboard</h2>
            <div className="bg-white dark:bg-dark-100 rounded-xl p-6 shadow-lg">
              {leaderboard.length > 0 ? (
                <div className="space-y-3">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        entry.user_id === user?.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'bg-gray-50 dark:bg-dark-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-gray-200 dark:bg-dark-300 text-gray-700 dark:text-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {entry.user_name}
                            {entry.user_id === user?.id && ' (You)'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-gray-100">
                          {entry.total_score.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 dark:text-gray-400">
                  No leaderboard entries yet. Be the first!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showInstructions && selectedLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-dark-100 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center space-x-3 mb-6">
                <Info className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Game Instructions
                </h2>
              </div>

              <div className="space-y-6 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Objective
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Draw a path from the green start cell to the red end cell by clicking or dragging
                    through adjacent cells. Avoid obstacles (dark cells) and complete the path before
                    time runs out!
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    How to Play
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
                    <li>Click and drag to draw your path from start to end</li>
                    <li>You can only move to adjacent cells (up, down, left, right)</li>
                    <li>Click on a cell in your path to backtrack and change direction</li>
                    <li>Dark cells are obstacles - you cannot pass through them</li>
                    <li>Complete the path within the time limit to win</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Scoring
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
                    <li>Base score: 1000 points</li>
                    <li>Time bonus: Faster completion = more points</li>
                    <li>Efficiency bonus: Shorter paths = more points</li>
                    <li>Meet the target score to unlock the next level</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    Level {selectedLevel.level.level_number} Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p className="text-blue-800 dark:text-blue-200">
                      <strong>Grid Size:</strong> {selectedLevel.level.grid_size}x{selectedLevel.level.grid_size}
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      <strong>Time Limit:</strong> {Math.floor(selectedLevel.level.time_limit_seconds / 60)} minutes
                    </p>
                    <p className="text-blue-800 dark:text-blue-200">
                      <strong>Target Score:</strong> {selectedLevel.level.target_score} points
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={handleStartGame}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Start Game
                </button>
                <button
                  onClick={() => {
                    setShowInstructions(false);
                    setSelectedLevel(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
