import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Eye, ArrowLeft, Share2, Facebook, Twitter, Linkedin } from 'lucide-react';
import { blogService } from '../../services/blogService';
import { BlogPostWithRelations } from '../../types/blog';
import { BlogPostSEO } from '../blog/BlogPostSEO';
import { RelatedPosts } from '../blog/RelatedPosts';
import { Breadcrumb } from '../common/Breadcrumb';

export const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostWithRelations | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogPostWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadPost(slug);
    }
  }, [slug]);

  const loadPost = async (postSlug: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedPost = await blogService.fetchPostBySlug(postSlug);

      if (!fetchedPost) {
        setError('Blog post not found');
        return;
      }

      setPost(fetchedPost);

      const related = await blogService.fetchRelatedPosts(fetchedPost.id, 3);
      setRelatedPosts(related);
    } catch (err: any) {
      console.error('Error loading post:', err);
      setError(err.message || 'Failed to load blog post');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const shareOnSocial = (platform: 'facebook' | 'twitter' | 'linkedin') => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post?.title || '');

    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    };

    window.open(shareUrls[platform], '_blank', 'width=600,height=400');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-300 p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {error || 'Post Not Found'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The blog post you're looking for doesn't exist or has been removed.
            </p>
            <button
              onClick={() => navigate('/blog')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Blog
            </button>
          </div>
        </div>
      </div>
    );
  }

  const readingTime = blogService.calculateReadingTime(post.body_content);

  return (
    <>
      <BlogPostSEO post={post} />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200">
        <article className="max-w-4xl mx-auto px-4 py-12">
          <div className="mb-6">
            <Breadcrumb
              items={[
                { label: 'Home', path: '/' },
                { label: 'Blog', path: '/blog' },
                { label: post.title, path: `/blog/${post.slug}` }
              ]}
            />
            <button
              onClick={() => navigate('/blog')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors mt-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Blog
            </button>
          </div>

          <header className="mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.categories?.map((category) => (
                <span
                  key={category.id}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium rounded-full"
                >
                  {category.name}
                </span>
              ))}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">
                {post.excerpt}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-6 text-gray-600 dark:text-gray-400 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                  {(post.author_name || 'A')[0].toUpperCase()}
                </div>
                <span className="font-medium">{post.author_name || 'Admin'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(post.published_at || post.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{readingTime} min read</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{post.view_count} views</span>
              </div>
            </div>
          </header>

          {post.featured_image_url && (
            <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
              <img
                src={post.featured_image_url}
                alt={post.title}
                className="w-full h-auto"
              />
            </div>
          )}

          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-300 p-8 md:p-12 mb-8">
            <div
              className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-gray-100"
              dangerouslySetInnerHTML={{ __html: post.body_content }}
            />
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-300 p-6 mb-8">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-3 py-1 bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 text-sm rounded-full"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-300 p-6 mb-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Share this article
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => shareOnSocial('facebook')}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  title="Share on Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </button>
                <button
                  onClick={() => shareOnSocial('twitter')}
                  className="p-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors"
                  title="Share on Twitter"
                >
                  <Twitter className="w-5 h-5" />
                </button>
                <button
                  onClick={() => shareOnSocial('linkedin')}
                  className="p-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white transition-colors"
                  title="Share on LinkedIn"
                >
                  <Linkedin className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {relatedPosts.length > 0 && <RelatedPosts posts={relatedPosts} />}
        </article>
      </div>
    </>
  );
};
