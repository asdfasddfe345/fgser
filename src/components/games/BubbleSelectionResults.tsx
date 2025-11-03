import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  Clock,
  Target,
  TrendingUp,
  Award,
  BarChart3,
  Share2,
  RotateCcw
} from 'lucide-react';
import { bubbleSelectionService } from '../../services/bubbleSelectionService';
import { adaptiveDifficultyService } from '../../services/adaptiveDifficultyService';
import { PerformanceMetrics, LeaderboardEntry } from '../../types/bubbleSelection';

interface BubbleSelectionResultsProps {
  sessionId: string;
  userId: string;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const BubbleSelectionResults: React.FC<BubbleSelectionResultsProps> = ({
  sessionId,
  userId,
  onPlayAgain,
  onExit
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [sessionId, userId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const performanceData = await bubbleSelectionService.getPerformanceMetrics(sessionId);
      setMetrics(performanceData);

      const leaderboardData = await bubbleSelectionService.getLeaderboard('all_time', 10);
      setLeaderboard(leaderboardData);

      const userEntry = await bubbleSelectionService.getUserLeaderboardEntry(userId, 'all_time');
      setUserRank(userEntry);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-dark-50 dark:via-dark-100 dark:to-dark-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  const performanceRating = adaptiveDifficultyService.getPerformanceRating(
    metrics.accuracy,
    metrics.averageTimePerQuestion
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-dark-50 dark:via-dark-100 dark:to-dark-200 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Trophy className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Game Complete!
          </h1>
          <p className={`text-2xl font-semibold ${performanceRating.color}`}>
            {performanceRating.rating}
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">
            {performanceRating.message}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
              <BarChart3 className="w-6 h-6 mr-2 text-blue-600" />
              Performance Overview
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="flex items-center space-x-3">
                  <Award className="w-6 h-6 text-blue-600" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">Total Score</span>
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.scoreBreakdown.totalScore}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <div className="flex items-center space-x-3">
                  <Target className="w-6 h-6 text-green-600" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">Accuracy</span>
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.accuracy.toFixed(1)}%
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <div className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">Avg Time</span>
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.averageTimePerQuestion.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">Best Streak</span>
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.bestStreak}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
              <Award className="w-6 h-6 mr-2 text-purple-600" />
              Score Breakdown
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Base Score</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {metrics.scoreBreakdown.baseScore}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${(metrics.scoreBreakdown.baseScore / metrics.scoreBreakdown.totalScore) * 100}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Time Bonus</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    +{metrics.scoreBreakdown.timeBonus}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${(metrics.scoreBreakdown.timeBonus / metrics.scoreBreakdown.totalScore) * 100}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Difficulty Bonus</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    +{metrics.scoreBreakdown.difficultyBonus}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{
                      width: `${(metrics.scoreBreakdown.difficultyBonus / metrics.scoreBreakdown.totalScore) * 100}%`
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Total Score</span>
                  <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {metrics.scoreBreakdown.totalScore}
                  </span>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  {metrics.correctAnswers} out of {metrics.totalQuestions} questions answered correctly
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {userRank && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6 mb-8"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Trophy className="w-6 h-6 mr-2 text-yellow-600" />
              Your All-Time Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-200 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Best Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userRank.best_score}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-200 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(userRank.average_score)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-200 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Games Played</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userRank.total_games_played}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-200 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Best Accuracy</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userRank.best_accuracy_percentage.toFixed(0)}%</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-dark-200 rounded-xl">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Best Streak</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{userRank.highest_streak}</p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-dark-100 rounded-2xl shadow-xl p-6 mb-8"
        >
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-yellow-600" />
            Global Leaderboard
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">Rank</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">Player</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Score</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Accuracy</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Games</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-gray-100 dark:border-gray-800 ${
                      entry.user_id === userId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        {index === 0 && <span className="text-2xl mr-2">🥇</span>}
                        {index === 1 && <span className="text-2xl mr-2">🥈</span>}
                        {index === 2 && <span className="text-2xl mr-2">🥉</span>}
                        <span className="font-semibold text-gray-900 dark:text-gray-100">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {entry.user_name}
                        {entry.user_id === userId && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-gray-900 dark:text-gray-100">{entry.best_score}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-gray-700 dark:text-gray-300">{entry.best_accuracy_percentage.toFixed(0)}%</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-gray-600 dark:text-gray-400">{entry.total_games_played}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={onPlayAgain}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center space-x-2"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Play Again</span>
          </button>
          <button
            onClick={onExit}
            className="px-6 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Exit to Menu
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default BubbleSelectionResults;
