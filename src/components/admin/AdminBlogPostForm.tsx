import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText,
  Image as ImageIcon,
  Calendar,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Eye,
  Tag,
  FolderOpen,
  Link as LinkIcon,
  Type,
  AlignLeft
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminBlogService } from '../../services/adminBlogService';
import { blogService } from '../../services/blogService';
import { BlogCategory, BlogTag, CreateBlogPostData } from '../../types/blog';

const blogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens'),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  body_content: z.string().min(100, 'Body content must be at least 100 characters'),
  featured_image_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  author_name: z.string().optional(),
  status: z.enum(['draft', 'published', 'scheduled']),
  published_at: z.string().optional(),
  meta_title: z.string().max(60, 'Meta title should be less than 60 characters').optional(),
  meta_description: z.string().max(160, 'Meta description should be less than 160 characters').optional(),
  category_ids: z.array(z.string()).optional(),
  tag_ids: z.array(z.string()).optional()
});

type BlogPostFormData = z.infer<typeof blogPostSchema>;

export const AdminBlogPostForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPost, setIsFetchingPost] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<BlogPostFormData>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      status: 'draft',
      category_ids: [],
      tag_ids: []
    }
  });

  const titleValue = watch('title');
  const statusValue = watch('status');
  const featuredImageUrl = watch('featured_image_url');

  useEffect(() => {
    loadCategoriesAndTags();
    if (isEditMode && id) {
      loadBlogPost(id);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    if (titleValue && !isEditMode) {
      const slug = blogService.generateSlug(titleValue);
      setValue('slug', slug);
    }
  }, [titleValue, isEditMode, setValue]);

  const loadCategoriesAndTags = async () => {
    try {
      const [fetchedCategories, fetchedTags] = await Promise.all([
        adminBlogService.fetchAllCategories(),
        adminBlogService.fetchAllTags()
      ]);
      setCategories(fetchedCategories);
      setTags(fetchedTags);
    } catch (err) {
      console.error('Error loading categories and tags:', err);
    }
  };

  const loadBlogPost = async (postId: string) => {
    try {
      setIsFetchingPost(true);
      const post = await adminBlogService.fetchPostById(postId);

      if (post) {
        reset({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt || '',
          body_content: post.body_content,
          featured_image_url: post.featured_image_url || '',
          author_name: post.author_name || '',
          status: post.status,
          published_at: post.published_at || '',
          meta_title: post.meta_title || '',
          meta_description: post.meta_description || ''
        });

        const categoryIds = post.categories?.map(c => c.id) || [];
        const tagIds = post.tags?.map(t => t.id) || [];

        setSelectedCategories(categoryIds);
        setSelectedTags(tagIds);
        setValue('category_ids', categoryIds);
        setValue('tag_ids', tagIds);
      }
    } catch (err) {
      console.error('Error loading blog post:', err);
      setError('Failed to load blog post');
    } finally {
      setIsFetchingPost(false);
    }
  };

  const onSubmit = async (data: BlogPostFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      const postData: CreateBlogPostData = {
        ...data,
        category_ids: selectedCategories,
        tag_ids: selectedTags
      };

      if (isEditMode && id) {
        await adminBlogService.updateBlogPost({ id, ...postData });
      } else {
        await adminBlogService.createBlogPost(postData);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/admin/blog');
      }, 1500);
    } catch (err: any) {
      console.error('Error saving blog post:', err);
      setError(err.message || 'Failed to save blog post');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      const newCategories = prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId];
      setValue('category_ids', newCategories);
      return newCategories;
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId];
      setValue('tag_ids', newTags);
      return newTags;
    });
  };

  if (isFetchingPost) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Loading blog post...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/blog')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog Posts
          </button>
        </div>

        <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-300 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">
                  {isEditMode ? 'Edit Blog Post' : 'Create New Blog Post'}
                </h1>
                <p className="text-blue-100 text-sm mt-1">
                  {isEditMode ? 'Update your blog post details' : 'Fill in all the details below'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="m-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Error</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="m-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">Success!</h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Blog post {isEditMode ? 'updated' : 'created'} successfully. Redirecting...
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Type className="w-4 h-4" />
                  Title (Heading) *
                </label>
                <input
                  {...register('title')}
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                  placeholder="Enter blog post title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <LinkIcon className="w-4 h-4" />
                  Slug (URL) *
                </label>
                <input
                  {...register('slug')}
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                  placeholder="blog-post-slug"
                />
                {errors.slug && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.slug.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <ImageIcon className="w-4 h-4" />
                  Featured Image URL
                </label>
                <input
                  {...register('featured_image_url')}
                  type="url"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                  placeholder="https://example.com/image.jpg"
                />
                {errors.featured_image_url && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.featured_image_url.message}</p>
                )}
                {featuredImageUrl && (
                  <div className="mt-3">
                    <img
                      src={featuredImageUrl}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-dark-400"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <AlignLeft className="w-4 h-4" />
                  Excerpt (Short Summary)
                </label>
                <textarea
                  {...register('excerpt')}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                  placeholder="Brief description of the blog post"
                />
                {errors.excerpt && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.excerpt.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FileText className="w-4 h-4" />
                  Body Content (Full Article) *
                </label>
                <textarea
                  {...register('body_content')}
                  rows={15}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100 font-mono text-sm"
                  placeholder="Write your full blog post content here. You can use HTML or plain text."
                />
                {errors.body_content && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.body_content.message}</p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Eye className="w-4 h-4" />
                  Status *
                </label>
                <select
                  {...register('status')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Calendar className="w-4 h-4" />
                  Published Date {statusValue === 'scheduled' && '*'}
                </label>
                <input
                  {...register('published_at')}
                  type="datetime-local"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Type className="w-4 h-4" />
                  Author Name
                </label>
                <input
                  {...register('author_name')}
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                  placeholder="Author name (defaults to admin email)"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <FolderOpen className="w-4 h-4" />
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategories.includes(category.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-300'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-dark-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-300'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 border-t border-gray-200 dark:border-dark-300 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  SEO Settings
                </h3>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Type className="w-4 h-4" />
                  Meta Title (SEO)
                </label>
                <input
                  {...register('meta_title')}
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                  placeholder="SEO title (defaults to post title)"
                />
                {errors.meta_title && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.meta_title.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <AlignLeft className="w-4 h-4" />
                  Meta Description (SEO)
                </label>
                <textarea
                  {...register('meta_description')}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                  placeholder="SEO description (defaults to excerpt)"
                />
                {errors.meta_description && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.meta_description.message}</p>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-dark-300">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {isEditMode ? 'Update Post' : 'Create Post'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/blog')}
                className="px-6 py-3 border border-gray-300 dark:border-dark-400 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
