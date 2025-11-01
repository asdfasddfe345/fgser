import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FolderOpen, Star, Clock } from 'lucide-react';

interface BlogStatsProps {
  totalPosts: number;
  totalCategories: number;
  featuredPosts: number;
  averageReadingTime: number;
}

export const BlogStats: React.FC<BlogStatsProps> = ({
  totalPosts,
  totalCategories,
  featuredPosts,
  averageReadingTime
}) => {
  const stats = [
    {
      label: 'Total Articles',
      value: totalPosts,
      icon: <BookOpen className="w-5 h-5" />,
      color: 'blue'
    },
    {
      label: 'Categories',
      value: totalCategories,
      icon: <FolderOpen className="w-5 h-5" />,
      color: 'green'
    },
    {
      label: 'Featured Posts',
      value: featuredPosts,
      icon: <Star className="w-5 h-5" />,
      color: 'yellow'
    },
    {
      label: 'Avg. Read Time',
      value: `${averageReadingTime} min`,
      icon: <Clock className="w-5 h-5" />,
      color: 'purple'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/20',
          text: 'text-blue-600 dark:text-blue-400'
        };
      case 'green':
        return {
          bg: 'bg-green-100 dark:bg-green-900/20',
          text: 'text-green-600 dark:text-green-400'
        };
      case 'yellow':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/20',
          text: 'text-yellow-600 dark:text-yellow-400'
        };
      case 'purple':
        return {
          bg: 'bg-purple-100 dark:bg-purple-900/20',
          text: 'text-purple-600 dark:text-purple-400'
        };
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-900/20',
          text: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => {
        const colors = getColorClasses(stat.color);
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-dark-100 rounded-xl shadow-lg p-4 text-center border border-gray-200 dark:border-dark-300 hover:shadow-xl transition-shadow duration-300"
          >
            <div
              className={`${colors.bg} w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${colors.text}`}
            >
              {stat.icon}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stat.value}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {stat.label}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
