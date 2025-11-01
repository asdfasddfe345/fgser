import { supabase } from '../lib/supabaseClient';
import {
  BlogPost,
  BlogPostWithRelations,
  BlogCategory,
  BlogTag,
  CreateBlogPostData,
  UpdateBlogPostData,
  BlogPostFilters,
  BlogPostsResponse
} from '../types/blog';

export const adminBlogService = {
  async fetchAllPosts(
    page: number = 1,
    pageSize: number = 20,
    filters?: BlogPostFilters
  ): Promise<BlogPostsResponse> {
    try {
      let query = supabase
        .from('blog_posts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

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
      console.error('Error fetching all posts:', error);
      throw error;
    }
  },

  async fetchPostById(id: string): Promise<BlogPostWithRelations | null> {
    try {
      const { data: post, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!post) return null;

      const categories = await this.getPostCategories(post.id);
      const tags = await this.getPostTags(post.id);

      return { ...post, categories, tags };
    } catch (error) {
      console.error('Error fetching post by id:', error);
      throw error;
    }
  },

  async createBlogPost(data: CreateBlogPostData): Promise<BlogPost> {
    try {
      const { data: user } = await supabase.auth.getUser();

      const postData: any = {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt || null,
        body_content: data.body_content,
        featured_image_url: data.featured_image_url || null,
        author_id: user?.user?.id || null,
        author_name: data.author_name || user?.user?.email || 'Admin',
        status: data.status,
        published_at: data.status === 'published' && !data.published_at
          ? new Date().toISOString()
          : data.published_at || null,
        meta_title: data.meta_title || data.title,
        meta_description: data.meta_description || data.excerpt || null
      };

      const { data: post, error } = await supabase
        .from('blog_posts')
        .insert(postData)
        .select()
        .single();

      if (error) throw error;

      if (data.category_ids && data.category_ids.length > 0) {
        await this.updatePostCategories(post.id, data.category_ids);
      }

      if (data.tag_ids && data.tag_ids.length > 0) {
        await this.updatePostTags(post.id, data.tag_ids);
      }

      return post;
    } catch (error) {
      console.error('Error creating blog post:', error);
      throw error;
    }
  },

  async updateBlogPost(data: UpdateBlogPostData): Promise<BlogPost> {
    try {
      const updateData: any = { ...data };
      delete updateData.id;
      delete updateData.category_ids;
      delete updateData.tag_ids;

      if (data.status === 'published' && !data.published_at) {
        const { data: existingPost } = await supabase
          .from('blog_posts')
          .select('published_at')
          .eq('id', data.id)
          .single();

        if (!existingPost?.published_at) {
          updateData.published_at = new Date().toISOString();
        }
      }

      const { data: post, error } = await supabase
        .from('blog_posts')
        .update(updateData)
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;

      if (data.category_ids !== undefined) {
        await this.updatePostCategories(data.id, data.category_ids);
      }

      if (data.tag_ids !== undefined) {
        await this.updatePostTags(data.id, data.tag_ids);
      }

      return post;
    } catch (error) {
      console.error('Error updating blog post:', error);
      throw error;
    }
  },

  async deleteBlogPost(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting blog post:', error);
      throw error;
    }
  },

  async updatePostCategories(postId: string, categoryIds: string[]): Promise<void> {
    try {
      await supabase
        .from('blog_post_categories')
        .delete()
        .eq('blog_post_id', postId);

      if (categoryIds.length > 0) {
        const insertData = categoryIds.map(categoryId => ({
          blog_post_id: postId,
          blog_category_id: categoryId
        }));

        const { error } = await supabase
          .from('blog_post_categories')
          .insert(insertData);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating post categories:', error);
      throw error;
    }
  },

  async updatePostTags(postId: string, tagIds: string[]): Promise<void> {
    try {
      await supabase
        .from('blog_post_tags')
        .delete()
        .eq('blog_post_id', postId);

      if (tagIds.length > 0) {
        const insertData = tagIds.map(tagId => ({
          blog_post_id: postId,
          blog_tag_id: tagId
        }));

        const { error } = await supabase
          .from('blog_post_tags')
          .insert(insertData);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating post tags:', error);
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

  async createCategory(name: string, description?: string): Promise<BlogCategory> {
    try {
      const slug = this.generateSlug(name);

      const { data, error } = await supabase
        .from('blog_categories')
        .insert({ name, slug, description: description || null })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },

  async updateCategory(id: string, name: string, description?: string): Promise<BlogCategory> {
    try {
      const slug = this.generateSlug(name);

      const { data, error } = await supabase
        .from('blog_categories')
        .update({ name, slug, description: description || null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },

  async deleteCategory(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('blog_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  async createTag(name: string): Promise<BlogTag> {
    try {
      const slug = this.generateSlug(name);

      const { data, error } = await supabase
        .from('blog_tags')
        .insert({ name, slug })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  },

  async updateTag(id: string, name: string): Promise<BlogTag> {
    try {
      const slug = this.generateSlug(name);

      const { data, error } = await supabase
        .from('blog_tags')
        .update({ name, slug })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  },

  async deleteTag(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('blog_tags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
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

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
};
