import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, Eye, Bookmark, BookmarkCheck, TrendingUp, Star } from 'lucide-react';
import { BlogPostWithRelations } from '../../types/blog';
import { blogService } from '../../services/blogService';
import { useAuth } from '../../contexts/AuthContext';

interface EnhancedBlogPostCardProps {
  post: BlogPostWithRelations;
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

export const EnhancedBlogPostCard: React.FC<EnhancedBlogPostCardProps> = ({
  post,
  isAuthenticated,
  onShowAuth
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isCheckingBookmark, setIsCheckingBookmark] = useState(false);

  useEffect(() => {
    if (user?.id) {
      checkBookmarkStatus();
    }
  }, [user?.id, post.id]);

  const checkBookmarkStatus = async () => {
    if (!user?.id) return;
    setIsCheckingBookmark(true);
    try {
      const bookmarked = await blogService.isPostBookmarked(user.id, post.id);
      setIsBookmarked(bookmarked);
    } catch (error) {
      console.error('Error checking bookmark status:', error);
    } finally {
      setIsCheckingBookmark(false);
    }
  };

  const handleBookmarkToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      onShowAuth();
      return;
    }

    if (!user?.id) return;

    try {
      if (isBookmarked) {
        await blogService.removeBookmark(user.id, post.id);
        setIsBookmarked(false);
      } else {
        await blogService.trackUserInteraction(user.id, post.id, 'bookmarked');
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDifficultyBadge = () => {
    if (!post.reading_difficulty) return null;

    const badges = {
      beginner: {
        color: 'from-green-500 to-emerald-500',
        text: 'Beginner'
      },
      intermediate: {
        color: 'from-yellow-500 to-orange-500',
        text: 'Intermediate'
      },
      advanced: {
        color: 'from-red-500 to-pink-500',
        text: 'Advanced'
      }
    };

    const badge = badges[post.reading_difficulty];

    return (
      <span className={`px-2 py-1 bg-gradient-to-r ${badge.color} text-white rounded text-xs font-semibold`}>
        {badge.text}
      </span>
    );
  };

  const isTrending = post.trending_score && post.trending_score > 0.5;
  const readingTime = post.estimated_reading_time || blogService.calculateReadingTime(post.body_content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => navigate(`/blog/${post.slug}`)}
      className={`bg-white dark:bg-dark-100 rounded-xl border-2 ${
        post.is_featured
          ? 'border-yellow-400 dark:border-yellow-500 shadow-lg shadow-yellow-200 dark:shadow-yellow-900/30'
          : 'border-gray-200 dark:border-dark-300'
      } hover:border-blue-400 dark:hover:border-neon-cyan-500 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group`}
    >
      {post.is_featured && (
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <Star className="w-4 h-4" />
            <span className="font-bold text-sm">Featured Article</span>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-shrink-0 w-full sm:w-32 h-32 bg-white dark:bg-dark-200 rounded-lg border border-gray-200 dark:border-dark-300 overflow-hidden relative">
            {post.featured_image_url ? (
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-full h-full rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">${post.title.charAt(0)}</div>`;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                {post.title.charAt(0)}
              </div>
            )}
            {isTrending && (
              <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Trending
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 pr-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {post.title}
                </h3>
                {post.author_name && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    by {post.author_name}
                  </p>
                )}
              </div>

              <button
                onClick={handleBookmarkToggle}
                disabled={isCheckingBookmark}
                className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg transition-colors"
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this article'}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Bookmark className="w-5 h-5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
                )}
              </button>
            </div>

            {post.excerpt && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                {post.excerpt}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-3">
              {getDifficultyBadge()}
              {post.categories?.slice(0, 2).map((category) => (
                <span
                  key={category.id}
                  className="px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-medium border border-blue-200 dark:border-blue-700/50"
                >
                  {category.name}
                </span>
              ))}
              {post.categories && post.categories.length > 2 && (
                <span className="px-2 py-1 bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-400 rounded text-xs font-medium">
                  +{post.categories.length - 2}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-gray-200 dark:border-dark-300">
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(post.published_at || post.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{readingTime} min</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{post.view_count}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/blog/${post.slug}`);
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-500 dark:to-purple-500 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all duration-200"
              >
                Read Article
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
