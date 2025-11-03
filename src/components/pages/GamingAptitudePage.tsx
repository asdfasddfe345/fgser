import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Star,
  TrendingUp,
  Lock,
  CheckCircle,
  Gamepad2,
  Zap,
  Target,
  Award,
  Brain,
  Key
} from 'lucide-react';
import { gamingService } from '../../services/gamingService';
import { CompanyWithProgress } from '../../types/gaming';
import { useAuth } from '../../contexts/AuthContext';

interface GamingAptitudePageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

export const GamingAptitudePage: React.FC<GamingAptitudePageProps> = ({
  isAuthenticated,
  onShowAuth
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanyWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState({
    totalScore: 0,
    completedLevels: 0,
    totalLevels: 0,
    rank: null as number | null
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      loadCompaniesWithProgress();
    } else {
      loadCompaniesWithoutProgress();
    }
  }, [isAuthenticated, user]);

  const loadCompaniesWithProgress = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const companiesData = await gamingService.getAllCompaniesWithProgress(user.id);
      setCompanies(companiesData);

      const totalScore = companiesData.reduce((sum, c) => sum + c.totalScore, 0);
      const completedLevels = companiesData.reduce((sum, c) => sum + c.completedLevels, 0);
      const totalLevels = companiesData.reduce((sum, c) => sum + c.totalLevels, 0);
      const rank = await gamingService.getUserRank(user.id);

      setGlobalStats({ totalScore, completedLevels, totalLevels, rank });
    } catch (error) {
      console.error('Error loading companies with progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompaniesWithoutProgress = async () => {
    try {
      setLoading(true);
      const companiesData = await gamingService.getAllCompanies();
      const formattedData: CompanyWithProgress[] = companiesData.map(company => ({
        company,
        levels: [],
        totalScore: 0,
        completedLevels: 0,
        totalLevels: 4
      }));
      setCompanies(formattedData);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyClick = (companyId: string) => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    navigate(`/gaming/${companyId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading gaming section...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-dark-50 dark:via-dark-100 dark:to-dark-200">
      <div className="relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob dark:bg-neon-purple-500"></div>
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000 dark:bg-neon-blue-500"></div>
      </div>

      <div className="relative container-responsive py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-6">
            <Gamepad2 className="w-16 h-16 text-blue-600 dark:text-neon-cyan-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Gaming Aptitude Center
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Test your problem-solving skills with Path Finder challenges designed for top consulting firms.
            Complete levels, earn scores, and climb the leaderboards!
          </p>
        </motion.div>

        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
          >
            <div className="bg-white dark:bg-dark-100 rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <Trophy className="w-6 h-6 text-yellow-600" />
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Score</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {globalStats.totalScore.toLocaleString()}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-100 rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {globalStats.completedLevels} / {globalStats.totalLevels}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-100 rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Global Rank</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {globalStats.rank ? `#${globalStats.rank}` : '-'}
              </p>
            </div>

            <div className="bg-white dark:bg-dark-100 rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <Star className="w-6 h-6 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Average</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {globalStats.completedLevels > 0
                  ? Math.round(globalStats.totalScore / globalStats.completedLevels)
                  : 0}
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-gradient-to-r from-orange-500 to-pink-600 dark:from-orange-600 dark:to-pink-700 rounded-2xl p-8 text-white shadow-xl h-full">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center space-x-3 mb-3">
                    <Target className="w-10 h-10" />
                    <Zap className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Bubble Selection</h2>
                  <p className="text-orange-100 mb-4">
                    Test your mental math speed and accuracy. Calculate expressions quickly and select bubbles in ascending order. 24 questions with adaptive difficulty across 14 sections!
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                      <Zap className="w-4 h-4" />
                      <span className="text-sm">Mental Math Speed</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                      <Target className="w-4 h-4" />
                      <span className="text-sm">24 Questions</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm">Adaptive Difficulty</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      onShowAuth();
                    } else {
                      navigate('/bubble-selection');
                    }
                  }}
                  className="mt-6 w-full px-8 py-4 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isAuthenticated ? 'Play Bubble Selection' : 'Login to Play'}
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 rounded-2xl p-8 text-white shadow-xl h-full">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center space-x-3 mb-3">
                    <Brain className="w-10 h-10" />
                    <Key className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Key Finder</h2>
                  <p className="text-blue-100 mb-4">
                    Test your spatial memory and navigation skills in this cognitive assessment game. Navigate through an invisible maze to find the key and reach the exit using only your memory.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                      <Brain className="w-4 h-4" />
                      <span className="text-sm">Memory Challenge</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                      <Target className="w-4 h-4" />
                      <span className="text-sm">3 Difficulty Levels</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-3 py-1">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm">Leaderboards</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/key-finder')}
                  className="mt-6 w-full px-8 py-4 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Play Key Finder
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Company Path Finder Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {companies.map((companyData, index) => (
              <motion.div
                key={companyData.company.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                className="group"
              >
                <button
                  onClick={() => handleCompanyClick(companyData.company.id)}
                  className="w-full bg-white dark:bg-dark-100 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-left"
                  style={{
                    borderTop: `4px solid ${companyData.company.primary_color}`
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-16 h-16 bg-white rounded-lg shadow-md flex items-center justify-center p-2">
                      <img
                        src={companyData.company.logo_url}
                        alt={companyData.company.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    {!isAuthenticated && (
                      <Lock className="w-6 h-6 text-gray-400" />
                    )}
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {companyData.company.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                    {companyData.company.description}
                  </p>

                  {isAuthenticated && companyData.levels.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {companyData.completedLevels} / {companyData.totalLevels}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-dark-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${(companyData.completedLevels / companyData.totalLevels) * 100}%`,
                            backgroundColor: companyData.company.primary_color
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center space-x-2">
                          <Trophy className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {companyData.totalScore.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < companyData.completedLevels
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-blue-600 dark:text-neon-cyan-400 font-semibold">
                      <Zap className="w-5 h-5" />
                      <span>{isAuthenticated ? 'Start Challenge' : 'Login to Play'}</span>
                    </div>
                  )}
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white dark:bg-dark-100 rounded-2xl p-8 shadow-lg"
        >
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-blue-600 dark:text-neon-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Choose a Challenge
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Select from Accenture, Cognizant, or Capgemini challenges with varying difficulty levels.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gamepad2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Solve the Puzzle
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Navigate from start to end by drawing a path, avoiding obstacles, within the time limit.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Earn Points & Rank
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Complete levels to unlock harder challenges, earn points, and climb the global leaderboard.
              </p>
            </div>
          </div>
        </motion.div>

        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 text-center"
          >
            <button
              onClick={onShowAuth}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg shadow-lg transition-all transform hover:scale-105"
            >
              Sign In to Start Playing
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
