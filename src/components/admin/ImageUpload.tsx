import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      return 'Please upload a PNG or JPEG image';
    }

    if (file.size > maxSize) {
      return 'Image size must be less than 5MB';
    }

    return null;
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('company-logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleFileSelect = async (file: File) => {
    setUploadError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setIsUploading(true);

    try {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      const publicUrl = await uploadImageToStorage(file);

      onImageUploaded(publicUrl);
      setPreviewUrl(publicUrl);
      setUploadError(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveImage = async () => {
    if (previewUrl && previewUrl.includes('company-logos')) {
      try {
        const path = previewUrl.split('/company-logos/')[1];
        if (path) {
          await supabase.storage.from('company-logos').remove([path]);
        }
      } catch (error) {
        console.error('Error removing image from storage:', error);
      }
    }

    setPreviewUrl(null);
    onImageRemoved();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <ImageIcon className="w-4 h-4 inline mr-1" />
        Company Logo
      </label>

      {!previewUrl ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:border-neon-cyan-400 dark:bg-neon-cyan-500/10'
              : 'border-gray-300 hover:border-blue-400 dark:border-dark-300 dark:hover:border-neon-cyan-400'
          } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="w-12 h-12 text-blue-500 dark:text-neon-cyan-400 animate-spin" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Uploading image...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-blue-100 dark:bg-neon-cyan-500/20 w-16 h-16 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600 dark:text-neon-cyan-400" />
              </div>
              <div>
                <p className="text-gray-700 dark:text-gray-200 font-medium mb-1">
                  Drop company logo here or click to upload
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  PNG or JPEG, max 5MB
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative border-2 border-gray-200 dark:border-dark-300 rounded-xl p-4 bg-gray-50 dark:bg-dark-200">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-24 h-24 bg-white dark:bg-dark-100 rounded-lg overflow-hidden border border-gray-200 dark:border-dark-300 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Company logo preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Logo uploaded successfully
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                {previewUrl}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemoveImage}
              className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Remove image"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        This logo will be displayed on the job listing cards and job details page
      </p>
    </div>
  );
};
