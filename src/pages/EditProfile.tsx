import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Shuffle, Lock, Save, X } from 'lucide-react';
import { getUserProfile, updateUserProfile, getCurrentUser } from '../lib/firebase';
import { uploadPhoto } from '../services/reviewService';
import { getInitials } from '../utils/avatarUtils';

interface EditProfileForm {
  username: string;
  displayName: string;
  bio: string;
  avatar: string;
}

interface CropPosition {
  x: number;
  y: number;
  scale: number;
}

const PREVIEW_SIZE = 400;

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [originalProfile, setOriginalProfile] = useState<any>(null);
  const [formData, setFormData] = useState<EditProfileForm>({
    username: '',
    displayName: '',
    bio: '',
    avatar: ''
  });
  
  // Profile picture states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [originalSelectedImage, setOriginalSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState<CropPosition>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageEditorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          setError('No authenticated user found');
          return;
        }

        const result = await getUserProfile();
        if (result.success && result.profile) {
          const profile = result.profile;
          setOriginalProfile(profile);
          setFormData({
            username: profile.username || '',
            displayName: profile.displayName || '',
            bio: profile.bio || '',
            avatar: profile.avatar || ''
          });
        } else {
          setError(result.error || 'Failed to load profile');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Generate random username
  const generateRandomUsername = () => {
    const adjectives = ['Cool', 'Epic', 'Tasty', 'Fresh', 'Spicy', 'Sweet', 'Crispy', 'Juicy', 'Bold', 'Zesty'];
    const nouns = ['Foodie', 'Eater', 'Chef', 'Critic', 'Lover', 'Hunter', 'Explorer', 'Guru', 'Expert', 'Fan'];
    const numbers = Math.floor(Math.random() * 99) + 1;
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    
    const newUsername = `${randomAdjective}${randomNoun}${numbers}`;
    setFormData(prev => ({ ...prev, username: newUsername }));
  };

  // Handle form input changes
  const handleInputChange = (field: keyof EditProfileForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccessMessage(null);
  };

  // Handle image selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image must be smaller than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      setOriginalImage(imagePreview ?? formData.avatar ?? null);
      setOriginalSelectedImage(selectedImage);
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
        setShowImageEditor(true);
        setCropPosition({ x: 0, y: 0, scale: 1 });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setCropPosition(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle scale change
  const handleScaleChange = (scale: number) => {
    setCropPosition(prev => ({ ...prev, scale }));
  };

  // Create cropped image
  const createCroppedImage = (): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!imagePreview || !canvasRef.current) {
        reject(new Error('No image to crop'));
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const size = PREVIEW_SIZE; // Final image size and preview size stay in sync
        canvas.width = size;
        canvas.height = size;

        const zoom = cropPosition.scale;
        const sourceWidth = size / zoom;
        const sourceHeight = size / zoom;

        const previewToImageScaleX = img.width / PREVIEW_SIZE;
        const previewToImageScaleY = img.height / PREVIEW_SIZE;

        let sourceX = (img.width / 2) - (sourceWidth / 2) - ((cropPosition.x * previewToImageScaleX) / zoom);
        let sourceY = (img.height / 2) - (sourceHeight / 2) - ((cropPosition.y * previewToImageScaleY) / zoom);

        // Clamp the crop box to stay within the source image bounds
        const maxSourceX = Math.max(img.width - sourceWidth, 0);
        const maxSourceY = Math.max(img.height - sourceHeight, 0);
        sourceX = Math.max(0, Math.min(sourceX, maxSourceX));
        sourceY = Math.max(0, Math.min(sourceY, maxSourceY));

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);

        canvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
            resolve(croppedFile);
          } else {
            reject(new Error('Failed to create cropped image'));
          }
        }, 'image/jpeg', 0.9);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imagePreview;
    });
  };

  // Apply cropped image
  const applyCroppedImage = async () => {
    try {
      const croppedFile = await createCroppedImage();
      setSelectedImage(croppedFile);
      setShowImageEditor(false);
      
      // Create new preview for the cropped image
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(croppedFile);
      setOriginalImage(null);
      setOriginalSelectedImage(null);
      setCropPosition({ x: 0, y: 0, scale: 1 });
    } catch (error) {
      console.error('Error cropping image:', error);
      setError('Failed to crop image');
    }
  };

  const handleCancelCrop = () => {
    setSelectedImage(originalSelectedImage);
    setImagePreview(originalImage);
    setCropPosition({ x: 0, y: 0, scale: 1 });
    setShowImageEditor(false);
    setOriginalImage(null);
    setOriginalSelectedImage(null);
  };

  // Form validation
  const validateForm = (): string | null => {
    if (!formData.username.trim()) {
      return 'Username is required';
    }
    
    if (formData.username.length < 3) {
      return 'Username must be at least 3 characters';
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    
    if (formData.bio.length > 160) {
      return 'Bio must be 160 characters or less';
    }
    
    return null;
  };

  // Handle save
  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let avatarUrl = formData.avatar;

      // Upload new profile picture if one was selected
      if (selectedImage) {
        try {
          avatarUrl = await uploadPhoto(selectedImage);
        } catch (uploadError) {
          console.error('Failed to upload profile picture:', uploadError);
          setError('Failed to upload profile picture. Saving other changes...');
          avatarUrl = formData.avatar; // Keep original avatar on upload failure
        }
      }

      // Update profile
      const updateData = {
        username: formData.username.trim(),
        displayName: formData.displayName.trim(),
        bio: formData.bio.trim(),
        avatar: avatarUrl
      };

      const result = await updateUserProfile(updateData);
      
      if (result.success) {
        setSuccessMessage('Profile updated successfully!');
        
        // Navigate back to profile after a short delay
        setTimeout(() => {
          navigate('/profile');
        }, 1500);
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Check if form has changes
  const hasChanges = () => {
    if (!originalProfile) return false;
    
    return (
      formData.username !== (originalProfile.username || '') ||
      formData.displayName !== (originalProfile.displayName || '') ||
      formData.bio !== (originalProfile.bio || '') ||
      selectedImage !== null
    );
  };

  // User avatar component
  const UserAvatar: React.FC<{ size?: string }> = ({ size = 'w-24 h-24' }) => {
    const [imageError, setImageError] = useState(false);
    
    const avatarToShow = imagePreview || formData.avatar;
    
    if (avatarToShow && !imageError) {
      return (
        <img 
          src={avatarToShow}
          alt="Profile"
          className={`${size} rounded-full object-cover border-4 border-gray-200`}
          onError={() => setImageError(true)}
        />
      );
    }

    return (
      <div className={`${size} rounded-full bg-primary flex items-center justify-center border-4 border-gray-200`}>
        <span className="text-white font-semibold text-lg">
          {getInitials(formData.username, formData.displayName)}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/profile')}
              className="mr-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold">Edit Profile</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              saving || !hasChanges()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-red-600'
            }`}
          >
            <Save size={16} className="mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Profile Picture Section */}
        <div className="bg-white rounded-xl p-6 mb-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Profile Picture</h2>
          <div className="flex items-center space-x-4">
            <UserAvatar />
            <div className="flex-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                <Camera size={16} className="mr-2" />
                Change Photo
              </button>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG up to 5MB. Square images work best.
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-xl p-6 mb-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
          
          {/* Username */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter username"
              />
              <button
                onClick={generateRandomUsername}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Generate random username"
              >
                <Shuffle size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Letters, numbers, and underscores only. Minimum 3 characters.
            </p>
          </div>

          {/* Display Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter display name"
            />
          </div>

          {/* Bio */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              placeholder="Tell us about yourself..."
              maxLength={160}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.bio.length}/160 characters
            </p>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Account Settings</h2>
          
          <button
            onClick={() => navigate('/profile/change-password')}
            className="flex items-center justify-between w-full p-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div className="flex items-center">
              <Lock size={20} className="text-gray-600 mr-3" />
              <span className="font-medium">Change Password</span>
            </div>
            <ArrowLeft size={16} className="text-gray-400 rotate-180" />
          </button>
        </div>
      </div>

      {/* Image Editor Modal */}
      {showImageEditor && imagePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Crop Profile Picture</h3>
              <button
                onClick={handleCancelCrop}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <div
                ref={imageEditorRef}
                className="relative mx-auto border-2 border-gray-300 rounded-xl overflow-hidden cursor-move"
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={imagePreview}
                  alt="Crop preview"
                  className="absolute"
                  style={{
                    width: `${100 * cropPosition.scale}%`,
                    height: `${100 * cropPosition.scale}%`,
                    left: `calc(50% - ${50 * cropPosition.scale}% + ${cropPosition.x}px)`,
                    top: `calc(50% - ${50 * cropPosition.scale}% + ${cropPosition.y}px)`
                  }}
                  draggable={false}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoom
              </label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={cropPosition.scale}
                onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCancelCrop}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCroppedImage}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default EditProfile;
