import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { BlogPostFilters, BlogCategory } from '../../types/blog';

interface BlogFiltersComponentProps {
  filters: BlogPostFilters;
  categories: BlogCategory[];
  onFiltersChange: (filters: BlogPostFilters) => void;
  isLoading?: boolean;
}

export const BlogFilters: React.FC<BlogFiltersComponentProps> = ({
  filters,
  categories,
  onFiltersChange,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleCategoryChange = (categoryId: string) => {
    onFiltersChange({
      ...filters,
      category_id: categoryId === 'all' ? undefined : categoryId
    });
  };

  const handleDifficultyChange = (difficulty: string) => {
    onFiltersChange({
      ...filters,
      reading_difficulty: difficulty === 'all' ? undefined : (difficulty as any)
    });
  };

  const handleSortChange = (sortBy: string) => {
    onFiltersChange({
      ...filters,
      sort_by: sortBy as any
    });
  };

  const handleReadingTimeChange = (min?: number, max?: number) => {
    onFiltersChange({
      ...filters,
      reading_time_min: min,
      reading_time_max: max
    });
  };

  const handleFeaturedToggle = () => {
    onFiltersChange({
      ...filters,
      is_featured: filters.is_featured ? undefined : true
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
    setIsExpanded(false);
  };

  const hasActiveFilters = !!(
    filters.search ||
    filters.category_id ||
    filters.reading_difficulty ||
    filters.reading_time_min ||
    filters.reading_time_max ||
    filters.is_featured ||
    (filters.sort_by && filters.sort_by !== 'newest')
  );

  return (
    <div className="bg-white dark:bg-dark-100 rounded-xl shadow-lg border border-gray-200 dark:border-dark-300 p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={handleSearchChange}
            placeholder="Search articles by title or content..."
            disabled={isLoading}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100 disabled:opacity-50 transition-all"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              isExpanded || hasActiveFilters
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-300'
            }`}
            disabled={isLoading}
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                Active
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg font-medium hover:bg-red-200 dark:hover:bg-red-900/30 transition-all"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-300 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={filters.category_id || 'all'}
              onChange={(e) => handleCategoryChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Difficulty
            </label>
            <select
              value={filters.reading_difficulty || 'all'}
              onChange={(e) => handleDifficultyChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reading Time
            </label>
            <select
              value={
                filters.reading_time_min && filters.reading_time_max
                  ? `${filters.reading_time_min}-${filters.reading_time_max}`
                  : 'all'
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'all') {
                  handleReadingTimeChange(undefined, undefined);
                } else {
                  const [min, max] = value.split('-').map(Number);
                  handleReadingTimeChange(min, max);
                }
              }}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="all">Any Length</option>
              <option value="1-5">1-5 minutes</option>
              <option value="5-10">5-10 minutes</option>
              <option value="10-15">10-15 minutes</option>
              <option value="15-999">15+ minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sort By
            </label>
            <select
              value={filters.sort_by || 'newest'}
              onChange={(e) => handleSortChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="most_viewed">Most Viewed</option>
              <option value="trending">Trending</option>
            </select>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleFeaturedToggle}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            filters.is_featured
              ? 'bg-yellow-500 text-white'
              : 'bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-300'
          }`}
          disabled={isLoading}
        >
          Featured Only
        </button>
      </div>
    </div>
  );
};
