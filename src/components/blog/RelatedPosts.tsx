import React from 'react';
import { BlogPostWithRelations } from '../../types/blog';
import { BlogPostCard } from './BlogPostCard';

interface RelatedPostsProps {
  posts: BlogPostWithRelations[];
}

export const RelatedPosts: React.FC<RelatedPostsProps> = ({ posts }) => {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 pt-12 border-t border-gray-200 dark:border-dark-300">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Related Articles
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
};
