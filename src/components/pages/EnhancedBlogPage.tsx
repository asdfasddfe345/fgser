import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { blogService } from '../../services/blogService';
import { BlogPostWithRelations, BlogCategory, BlogPostFilters } from '../../types/blog';
import { EnhancedBlogPostCard } from '../blog/EnhancedBlogPostCard';
import { BlogStats } from '../blog/BlogStats';
import { BlogFilters } from '../blog/BlogFilters';
import { Pagination } from '../common/Pagination';
import { Breadcrumb } from '../common/Breadcrumb';

interface EnhancedBlogPageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

export const EnhancedBlogPage: React.FC<EnhancedBlogPageProps> = ({
  isAuthenticated,
  onShowAuth
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState<BlogPostWithRelations[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [filters, setFilters] = useState<BlogPostFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  });

  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [stats, setStats] = useState({
    totalPosts: 0,
    totalCategories: 0,
    featuredPosts: 0,
    averageReadingTime: 5
  });

  const pageSize = 12;

  useEffect(() => {
    loadCategories();
    loadStats();
  }, []);

  useEffect(() => {
    loadPosts(currentPage, filters);
  }, [currentPage, filters]);

  useEffect(() => {
    const pageParam = searchParams.get('page');
    const pageNumber = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    if (pageNumber !== currentPage) {
      setCurrentPage(pageNumber);
    }
  }, [searchParams]);

  const loadCategories = async () => {
    try {
      const fetchedCategories = await blogService.fetchAllCategories();
      setCategories(fetchedCategories);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadStats = async () => {
    try {
      const blogStats = await blogService.getBlogStatistics();
      setStats(blogStats);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadPosts = useCallback(async (page = 1, newFilters = filters) => {
    setIsLoading(true);
    setError(null);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const response = await blogService.fetchPublishedPostsWithAdvancedFilters(
        page,
        pageSize,
        newFilters
      );

      setPosts(response.posts);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setCurrentPage(page);

      setSearchParams({ page: page.toString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pageSize, setSearchParams]);

  const handleFiltersChange = (newFilters: BlogPostFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setSearchParams({ page: '1' });
  };

  const handlePageChange = (page: number) => {
    loadPosts(page, filters);
  };

  const handleRefreshStats = async () => {
    await loadStats();
    await loadPosts(1, filters);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="w-full max-w-full mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 py-3">
            <button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Blog</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <Breadcrumb
            items={[
              { label: 'Home', path: '/' },
              { label: 'Blog', path: '/blog' }
            ]}
          />
        </div>

        <div className="text-center mb-12">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Explore Our Blog
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Expert insights on resume optimization, career development, and job search strategies to help you succeed.
          </p>

          <div className="flex items-center justify-center space-x-4 mt-6">
            <button
              onClick={handleRefreshStats}
              disabled={isLoading}
              className="px-4 py-3 rounded-xl font-semibold bg-white dark:bg-dark-100 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-300 hover:scale-105 transition-all shadow-lg disabled:opacity-50 flex items-center space-x-2"
              title="Refresh statistics"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        <BlogStats
          totalPosts={stats.totalPosts}
          totalCategories={stats.totalCategories}
          featuredPosts={stats.featuredPosts}
          averageReadingTime={stats.averageReadingTime}
        />

        <div className="mb-8">
          <BlogFilters
            filters={filters}
            categories={categories}
            onFiltersChange={handleFiltersChange}
            isLoading={isLoading}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8 dark:bg-red-900/20 dark:border-red-500/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">
                    Error Loading Articles
                  </h3>
                  <p className="text-red-700 dark:text-red-400">{error}</p>
                </div>
              </div>
              <button
                onClick={() => loadPosts(currentPage)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {!error && (
          <>
            <div className="space-y-4 mb-8">
              {posts.map((post) => (
                <EnhancedBlogPostCard
                  key={post.id}
                  post={post}
                  isAuthenticated={isAuthenticated}
                  onShowAuth={onShowAuth}
                />
              ))}
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3 dark:text-neon-cyan-400" />
                <span className="text-lg text-gray-600 dark:text-gray-300">
                  Loading articles...
                </span>
              </div>
            )}

            {!isLoading && posts.length > 0 && totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(currentPage - 1) * pageSize + 1} -{' '}
                    {Math.min(currentPage * pageSize, total)} of {total} articles
                  </p>
                </div>
              </div>
            )}

            {!isLoading && posts.length === 0 && (
              <div className="text-center py-12">
                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 dark:bg-dark-200">
                  <BookOpen className="w-10 h-10 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No Articles Found
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Try adjusting your filters or search terms to find more content.
                </p>
                <button
                  onClick={() => setFilters({})}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
