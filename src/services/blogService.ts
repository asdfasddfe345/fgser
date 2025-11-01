import { supabase } from '../lib/supabaseClient';
import {
  BlogPost,
  BlogPostWithRelations,
  BlogCategory,
  BlogTag,
  BlogPostFilters,
  BlogPostsResponse
} from '../types/blog';

export const blogService = {
  async fetchPublishedPosts(
    page: number = 1,
    pageSize: number = 12,
    filters?: BlogPostFilters
  ): Promise<BlogPostsResponse> {
    try {
      let query = supabase
        .from('blog_posts')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,body_content.ilike.%${filters.search}%`);
      }

      if (filters?.category_id) {
        const { data: postIds } = await supabase
          .from('blog_post_categories')
          .select('blog_post_id')
          .eq('blog_category_id', filters.category_id);

        if (postIds && postIds.length > 0) {
          query = query.in('id', postIds.map(p => p.blog_post_id));
        } else {
          return {
            posts: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0
          };
        }
      }

      if (filters?.tag_id) {
        const { data: postIds } = await supabase
          .from('blog_post_tags')
          .select('blog_post_id')
          .eq('blog_tag_id', filters.tag_id);

        if (postIds && postIds.length > 0) {
          query = query.in('id', postIds.map(p => p.blog_post_id));
        } else {
          return {
            posts: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0
          };
        }
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: posts, error, count } = await query;

      if (error) throw error;

      const postsWithRelations = await Promise.all(
        (posts || []).map(async (post) => {
          const categories = await this.getPostCategories(post.id);
          const tags = await this.getPostTags(post.id);
          return { ...post, categories, tags } as BlogPostWithRelations;
        })
      );

      return {
        posts: postsWithRelations,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    } catch (error) {
      console.error('Error fetching published posts:', error);
      throw error;
    }
  },

  async fetchPostBySlug(slug: string): Promise<BlogPostWithRelations | null> {
    try {
      const { data: post, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      if (!post) return null;

      const categories = await this.getPostCategories(post.id);
      const tags = await this.getPostTags(post.id);

      await this.incrementViewCount(post.id);

      return { ...post, categories, tags };
    } catch (error) {
      console.error('Error fetching post by slug:', error);
      throw error;
    }
  },

  async getPostCategories(postId: string): Promise<BlogCategory[]> {
    try {
      const { data, error } = await supabase
        .from('blog_post_categories')
        .select(`
          blog_category_id,
          blog_categories (*)
        `)
        .eq('blog_post_id', postId);

      if (error) throw error;

      return (data || [])
        .map((item: any) => item.blog_categories)
        .filter(Boolean) as BlogCategory[];
    } catch (error) {
      console.error('Error fetching post categories:', error);
      return [];
    }
  },

  async getPostTags(postId: string): Promise<BlogTag[]> {
    try {
      const { data, error } = await supabase
        .from('blog_post_tags')
        .select(`
          blog_tag_id,
          blog_tags (*)
        `)
        .eq('blog_post_id', postId);

      if (error) throw error;

      return (data || [])
        .map((item: any) => item.blog_tags)
        .filter(Boolean) as BlogTag[];
    } catch (error) {
      console.error('Error fetching post tags:', error);
      return [];
    }
  },

  async fetchAllCategories(): Promise<BlogCategory[]> {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  async fetchAllTags(): Promise<BlogTag[]> {
    try {
      const { data, error } = await supabase
        .from('blog_tags')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  },

  async fetchCategoryBySlug(slug: string): Promise<BlogCategory | null> {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching category by slug:', error);
      return null;
    }
  },

  async fetchTagBySlug(slug: string): Promise<BlogTag | null> {
    try {
      const { data, error } = await supabase
        .from('blog_tags')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching tag by slug:', error);
      return null;
    }
  },

  async fetchRelatedPosts(postId: string, limit: number = 4): Promise<BlogPostWithRelations[]> {
    try {
      const categories = await this.getPostCategories(postId);
      const tags = await this.getPostTags(postId);

      const categoryIds = categories.map(c => c.id);
      const tagIds = tags.map(t => t.id);

      let relatedPostIds: string[] = [];

      if (categoryIds.length > 0) {
        const { data: categoryPosts } = await supabase
          .from('blog_post_categories')
          .select('blog_post_id')
          .in('blog_category_id', categoryIds)
          .neq('blog_post_id', postId);

        if (categoryPosts) {
          relatedPostIds = categoryPosts.map(p => p.blog_post_id);
        }
      }

      if (tagIds.length > 0) {
        const { data: tagPosts } = await supabase
          .from('blog_post_tags')
          .select('blog_post_id')
          .in('blog_tag_id', tagIds)
          .neq('blog_post_id', postId);

        if (tagPosts) {
          relatedPostIds = [...new Set([...relatedPostIds, ...tagPosts.map(p => p.blog_post_id)])];
        }
      }

      if (relatedPostIds.length === 0) return [];

      const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('*')
        .in('id', relatedPostIds)
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const postsWithRelations = await Promise.all(
        (posts || []).map(async (post) => {
          const postCategories = await this.getPostCategories(post.id);
          const postTags = await this.getPostTags(post.id);
          return { ...post, categories: postCategories, tags: postTags };
        })
      );

      return postsWithRelations;
    } catch (error) {
      console.error('Error fetching related posts:', error);
      return [];
    }
  },

  async incrementViewCount(postId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_blog_view_count', { post_id: postId }).maybeSingle();

      if (error) {
        await supabase
          .from('blog_posts')
          .update({ view_count: supabase.sql`view_count + 1` })
          .eq('id', postId);
      }
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  },

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  },

  async getBlogStatistics(): Promise<{
    totalPosts: number;
    totalCategories: number;
    featuredPosts: number;
    averageReadingTime: number;
  }> {
    try {
      const { count: totalPosts } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString());

      const { count: totalCategories } = await supabase
        .from('blog_categories')
        .select('*', { count: 'exact', head: true });

      const { count: featuredPosts } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published')
        .eq('is_featured', true)
        .lte('published_at', new Date().toISOString());

      const { data: posts } = await supabase
        .from('blog_posts')
        .select('estimated_reading_time')
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString());

      const averageReadingTime = posts && posts.length > 0
        ? Math.round(posts.reduce((sum, p) => sum + (p.estimated_reading_time || 5), 0) / posts.length)
        : 5;

      return {
        totalPosts: totalPosts || 0,
        totalCategories: totalCategories || 0,
        featuredPosts: featuredPosts || 0,
        averageReadingTime
      };
    } catch (error) {
      console.error('Error fetching blog statistics:', error);
      return {
        totalPosts: 0,
        totalCategories: 0,
        featuredPosts: 0,
        averageReadingTime: 5
      };
    }
  },

  async fetchPublishedPostsWithAdvancedFilters(
    page: number = 1,
    pageSize: number = 12,
    filters?: {
      search?: string;
      category_id?: string;
      tag_id?: string;
      reading_difficulty?: string;
      reading_time_min?: number;
      reading_time_max?: number;
      is_featured?: boolean;
      sort_by?: 'newest' | 'oldest' | 'most_viewed' | 'trending';
    }
  ): Promise<BlogPostsResponse> {
    try {
      let query = supabase
        .from('blog_posts')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString());

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,body_content.ilike.%${filters.search}%`);
      }

      if (filters?.reading_difficulty) {
        query = query.eq('reading_difficulty', filters.reading_difficulty);
      }

      if (filters?.reading_time_min) {
        query = query.gte('estimated_reading_time', filters.reading_time_min);
      }

      if (filters?.reading_time_max) {
        query = query.lte('estimated_reading_time', filters.reading_time_max);
      }

      if (filters?.is_featured !== undefined) {
        query = query.eq('is_featured', filters.is_featured);
      }

      if (filters?.category_id) {
        const { data: postIds } = await supabase
          .from('blog_post_categories')
          .select('blog_post_id')
          .eq('blog_category_id', filters.category_id);

        if (postIds && postIds.length > 0) {
          query = query.in('id', postIds.map(p => p.blog_post_id));
        } else {
          return {
            posts: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0
          };
        }
      }

      if (filters?.tag_id) {
        const { data: postIds } = await supabase
          .from('blog_post_tags')
          .select('blog_post_id')
          .eq('blog_tag_id', filters.tag_id);

        if (postIds && postIds.length > 0) {
          query = query.in('id', postIds.map(p => p.blog_post_id));
        } else {
          return {
            posts: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0
          };
        }
      }

      switch (filters?.sort_by) {
        case 'oldest':
          query = query.order('published_at', { ascending: true });
          break;
        case 'most_viewed':
          query = query.order('view_count', { ascending: false });
          break;
        case 'trending':
          query = query.order('trending_score', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('published_at', { ascending: false });
          break;
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: posts, error, count } = await query;

      if (error) throw error;

      const postsWithRelations = await Promise.all(
        (posts || []).map(async (post) => {
          const categories = await this.getPostCategories(post.id);
          const tags = await this.getPostTags(post.id);
          return { ...post, categories, tags } as BlogPostWithRelations;
        })
      );

      return {
        posts: postsWithRelations,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    } catch (error) {
      console.error('Error fetching published posts with filters:', error);
      throw error;
    }
  },

    async trackUserInteraction(
    userId: string,
    blogPostId: string,
    interactionType: 'viewed' | 'bookmarked' | 'completed',
    readingProgress?: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('blog_user_interactions')
        .upsert({
          user_id: userId,
          blog_post_id: blogPostId,
          interaction_type: interactionType,
          reading_progress: readingProgress || 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,blog_post_id,interaction_type'
        });

      if (error) {
        // Silently fail if table doesn't exist
        if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('404')) {
          console.warn('blog_user_interactions table does not exist. Interaction tracking disabled.');
          return;
        }
        throw error;
      }
    } catch (error: any) {
      // Handle 404 errors gracefully
      if (error?.code === 'PGRST116' || error?.message?.includes('404') || error?.status === 404) {
        return;
      }
      console.error('Error tracking user interaction:', error);
    }
  },


    async getUserBookmarkedPosts(userId: string): Promise<BlogPostWithRelations[]> {
    try {
      const { data: interactions, error: interactionError } = await supabase
        .from('blog_user_interactions')
        .select('blog_post_id')
        .eq('user_id', userId)
        .eq('interaction_type', 'bookmarked');

      // Handle table not existing
      if (interactionError) {
        if (interactionError.code === 'PGRST116' || interactionError.message?.includes('does not exist') || interactionError.message?.includes('404')) {
          console.warn('blog_user_interactions table does not exist. Returning empty bookmarks.');
          return [];
        }
        throw interactionError;
      }

      if (!interactions || interactions.length === 0) return [];

      const postIds = interactions.map(i => i.blog_post_id);

      const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('*')
        .in('id', postIds)
        .eq('status', 'published')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false });

      if (error) throw error;

      const postsWithRelations = await Promise.all(
        (posts || []).map(async (post) => {
          const categories = await this.getPostCategories(post.id);
          const tags = await this.getPostTags(post.id);
          return { ...post, categories, tags } as BlogPostWithRelations;
        })
      );

      return postsWithRelations;
    } catch (error: any) {
      if (error?.code === 'PGRST116' || error?.message?.includes('404') || error?.status === 404) {
        return [];
      }
      console.error('Error fetching bookmarked posts:', error);
      return [];
    }
  },


  async isPostBookmarked(userId: string, blogPostId: string): Promise<boolean> {
    try {
      // Check if table exists first
      const { data, error } = await supabase
        .from('blog_user_interactions')
        .select('id')
        .eq('user_id', userId)
        .eq('blog_post_id', blogPostId)
        .eq('interaction_type', 'bookmarked')
        .maybeSingle();

      // If error is 404 or table doesn't exist, silently return false
      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('404')) {
          console.warn('blog_user_interactions table does not exist. Bookmark feature disabled.');
          return false;
        }
        throw error;
      }
      return !!data;
    } catch (error: any) {
      // Handle 404 or table missing errors gracefully
      if (error?.code === 'PGRST116' || error?.message?.includes('404') || error?.status === 404) {
        return false;
      }
      console.error('Error checking bookmark status:', error);
      return false;
    }
  },


    async removeBookmark(userId: string, blogPostId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('blog_user_interactions')
        .delete()
        .eq('user_id', userId)
        .eq('blog_post_id', blogPostId)
        .eq('interaction_type', 'bookmarked');

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('404')) {
          console.warn('blog_user_interactions table does not exist. Cannot remove bookmark.');
          return;
        }
        throw error;
      }
    } catch (error: any) {
      if (error?.code === 'PGRST116' || error?.message?.includes('404') || error?.status === 404) {
        return;
      }
      console.error('Error removing bookmark:', error);
    }
  }

};
