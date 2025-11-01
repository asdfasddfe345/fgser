import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Edit, Trash2, Loader2, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminBlogService } from '../../services/adminBlogService';
import { BlogCategory, BlogTag } from '../../types/blog';

export const AdminBlogCategoriesManager: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [tagName, setTagName] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'category' | 'tag'; id: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [fetchedCategories, fetchedTags] = await Promise.all([
        adminBlogService.fetchAllCategories(),
        adminBlogService.fetchAllTags()
      ]);
      setCategories(fetchedCategories);
      setTags(fetchedTags);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setError(null);
      if (editingCategory) {
        await adminBlogService.updateCategory(editingCategory, categoryName, categoryDescription);
        setSuccess('Category updated successfully');
      } else {
        await adminBlogService.createCategory(categoryName, categoryDescription);
        setSuccess('Category created successfully');
      }
      await loadData();
      resetCategoryForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!deleteConfirm || deleteConfirm.type !== 'category' || deleteConfirm.id !== id) {
      setDeleteConfirm({ type: 'category', id });
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      await adminBlogService.deleteCategory(id);
      setSuccess('Category deleted successfully');
      await loadData();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    }
  };

  const handleEditCategory = (category: BlogCategory) => {
    setEditingCategory(category.id);
    setCategoryName(category.name);
    setCategoryDescription(category.description || '');
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDescription('');
  };

  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      setError('Tag name is required');
      return;
    }

    try {
      setError(null);
      if (editingTag) {
        await adminBlogService.updateTag(editingTag, tagName);
        setSuccess('Tag updated successfully');
      } else {
        await adminBlogService.createTag(tagName);
        setSuccess('Tag created successfully');
      }
      await loadData();
      resetTagForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save tag');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!deleteConfirm || deleteConfirm.type !== 'tag' || deleteConfirm.id !== id) {
      setDeleteConfirm({ type: 'tag', id });
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      await adminBlogService.deleteTag(id);
      setSuccess('Tag deleted successfully');
      await loadData();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete tag');
    }
  };

  const handleEditTag = (tag: BlogTag) => {
    setEditingTag(tag.id);
    setTagName(tag.name);
  };

  const resetTagForm = () => {
    setEditingTag(null);
    setTagName('');
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Loading...</p>
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-blue-600" />
            Manage Categories & Tags
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Organize your blog posts with categories and tags
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-300 overflow-hidden">
            <div className="bg-blue-600 p-4 text-white">
              <h2 className="text-xl font-bold">Categories</h2>
            </div>

            <div className="p-6">
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                    placeholder="e.g., Resume Tips"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={categoryDescription}
                    onChange={(e) => setCategoryDescription(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                    placeholder="Brief description"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCategory}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {editingCategory ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingCategory ? 'Update' : 'Add'} Category
                  </button>
                  {editingCategory && (
                    <button
                      onClick={resetCategoryForm}
                      className="px-4 py-2 border border-gray-300 dark:border-dark-400 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-200 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-300 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className={`transition-colors ${
                          deleteConfirm?.type === 'category' && deleteConfirm?.id === category.id
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                        }`}
                        title={
                          deleteConfirm?.type === 'category' && deleteConfirm?.id === category.id
                            ? 'Click again to confirm'
                            : 'Delete'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No categories yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-lg border border-gray-200 dark:border-dark-300 overflow-hidden">
            <div className="bg-green-600 p-4 text-white">
              <h2 className="text-xl font-bold">Tags</h2>
            </div>

            <div className="p-6">
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Tag Name
                  </label>
                  <input
                    type="text"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-dark-200 dark:text-gray-100"
                    placeholder="e.g., ATS"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTag}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {editingTag ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {editingTag ? 'Update' : 'Add'} Tag
                  </button>
                  {editingTag && (
                    <button
                      onClick={resetTagForm}
                      className="px-4 py-2 border border-gray-300 dark:border-dark-400 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-dark-200 rounded-full hover:bg-gray-100 dark:hover:bg-dark-300 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tag.name}</span>
                    <button
                      onClick={() => handleEditTag(tag)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      title="Edit"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className={`transition-colors ${
                        deleteConfirm?.type === 'tag' && deleteConfirm?.id === tag.id
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                      }`}
                      title={
                        deleteConfirm?.type === 'tag' && deleteConfirm?.id === tag.id
                          ? 'Click again to confirm'
                          : 'Delete'
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {tags.length === 0 && (
                  <p className="w-full text-center text-gray-500 dark:text-gray-400 py-8">No tags yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
