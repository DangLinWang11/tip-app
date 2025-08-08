import React, { useState, useEffect, useRef } from 'react';
import { ChevronRightIcon, ShuffleIcon, UserIcon, EyeIcon, EyeOffIcon, Camera, X } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  auth, 
  signUpWithEmail, 
  signInWithEmail, 
  createUserProfile, 
  getUserProfile,
  updateLastLogin 
} from '../lib/firebase';
import { uploadPhoto } from '../services/reviewService';
import { getInitials } from '../utils/avatarUtils';

interface OnboardingProps {
  onComplete: () => void;
}

interface CropPosition {
  x: number;
  y: number;
  scale: number;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignInMode, setIsSignInMode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

  // Profile picture states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [cropPosition, setCropPosition] = useState<CropPosition>({ 
    x: 50, 
    y: 50, 
    scale: 1 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageEditorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clear auth error when switching modes or changing inputs
  useEffect(() => {
    setAuthError('');
  }, [isSignInMode, email, password]);

  // Check if user already has a complete profile
  const checkExistingUser = async (user: User) => {
    try {
      const result = await getUserProfile(user.uid);
      if (result.success && result.profile) {
        return result.profile;
      }
      return null;
    } catch (error) {
      console.error('Error checking existing user:', error);
      return null;
    }
  };

  // Handle email/password authentication
  const handleAuthentication = async () => {
    if (!email.trim() || !password.trim()) return;

    setIsAuthenticating(true);
    setAuthError('');

    try {
      let result;
      if (isSignInMode) {
        result = await signInWithEmail(email.trim(), password);
      } else {
        result = await signUpWithEmail(email.trim(), password);
      }

      if (result.success && result.user) {
        // Update last login for existing users
        if (isSignInMode) {
          await updateLastLogin();
        }

        // Check if user already has a complete profile
        const existingProfile = await checkExistingUser(result.user);
        
        if (existingProfile && existingProfile.username && existingProfile.isOnboarded) {
          // User exists with complete profile - complete onboarding
          onComplete();
        } else {
          // New user or incomplete profile - go to username step
          setStep(2);
        }
      } else {
        setAuthError(result.error || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const generateRandomUsername = () => {
    const adjectives = [
      'Crispy', 'Savory', 'Smoky', 'Tender', 'Zesty', 'Buttery', 'Spicy', 'Sweet', 
      'Tangy', 'Rich', 'Creamy', 'Golden', 'Fresh', 'Juicy', 'Flaky', 'Moist',
      'Sizzling', 'Aromatic', 'Delicate', 'Bold', 'Mild', 'Robust', 'Silky', 'Velvety',
      'Crunchy', 'Chewy', 'Fluffy', 'Dense', 'Light', 'Heavy', 'Warm', 'Cool',
      'Hot', 'Chilled', 'Frozen', 'Steamy', 'Bubbly', 'Fizzy', 'Smooth', 'Chunky',
      'Thick', 'Thin', 'Layered', 'Stuffed', 'Glazed', 'Grilled', 'Roasted', 'Baked',
      'Fried', 'Steamed', 'Boiled', 'Seared', 'Charred', 'Caramelized', 'Marinated', 'Seasoned'
    ];

    const nouns = [
      'Chef', 'Bistro', 'Kitchen', 'Flavor', 'Spice', 'Grill', 'Plate', 'Fork',
      'Knife', 'Spatula', 'Whisk', 'Ladle', 'Tongs', 'Skillet', 'Pan', 'Pot',
      'Oven', 'Stove', 'Burner', 'Flame', 'Heat', 'Fire', 'Smoke', 'Steam',
      'Recipe', 'Dish', 'Menu', 'Course', 'Meal', 'Feast', 'Banquet', 'Buffet',
      'Table', 'Counter', 'Bar', 'Cafe', 'Diner', 'Restaurant', 'Eatery', 'Tavern',
      'Pub', 'Lounge', 'Bakery', 'Patisserie', 'Pizzeria', 'Steakhouse', 'Seafood', 'Sushi',
      'Noodle', 'Pasta', 'Bread', 'Dessert', 'Appetizer', 'Entree', 'Salad', 'Soup',
      'Sauce', 'Broth', 'Stock', 'Marinade', 'Dressing', 'Seasoning', 'Herb', 'Pepper'
    ];

    const randomNum = Math.floor(Math.random() * 9000) + 1000; // 1000-9999 for 4 digits
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    setUsername(`${randomAdj}_${randomNoun}_${randomNum}`);
  };

  // Handle image selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setAuthError('Image must be smaller than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setAuthError('Please select a valid image file');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
        setShowImageEditor(true);
        setCropPosition({ x: 50, y: 50, scale: 1 });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageEditorRef.current) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const rect = imageEditorRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(100, cropPosition.x + (deltaX / rect.width) * 100));
    const newY = Math.max(0, Math.min(100, cropPosition.y + (deltaY / rect.height) * 100));
    
    setCropPosition(prev => ({ ...prev, x: newX, y: newY }));
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
        const size = 400; // Final image size
        canvas.width = size;
        canvas.height = size;

        // Calculate crop area
        const imgAspect = img.width / img.height;
        let drawWidth = img.width * cropPosition.scale;
        let drawHeight = img.height * cropPosition.scale;
        
        if (imgAspect > 1) {
          drawHeight = drawWidth / imgAspect;
        } else {
          drawWidth = drawHeight * imgAspect;
        }

        const offsetX = (cropPosition.x / 100) * (size - drawWidth);
        const offsetY = (cropPosition.y / 100) * (size - drawHeight);

        // Create circular clipping path
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        // Draw image
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

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
    } catch (error) {
      console.error('Error cropping image:', error);
      setAuthError('Failed to crop image');
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      // Handle email/password authentication
      await handleAuthentication();
    } else if (step < 2) {
      setStep(step + 1);
    } else {
      // Final step - create user profile and complete onboarding
      const currentUser = auth.currentUser;
      if (currentUser && username.trim()) {
        setIsAuthenticating(true);
        
        let avatarUrl = '';
        
        // Upload profile picture if one was selected
        if (selectedImage) {
          try {
            avatarUrl = await uploadPhoto(selectedImage);
          } catch (uploadError) {
            console.error('Failed to upload profile picture:', uploadError);
            setAuthError('Failed to upload profile picture. Saving other information...');
          }
        }
        
        const result = await createUserProfile(currentUser, {
          username: username.trim().toLowerCase(),
          displayName: username.trim(),
          avatar: avatarUrl
        });
        
        if (result.success) {
          onComplete();
        } else {
          setAuthError(result.error || 'Error saving profile. Please try again.');
        }
        
        setIsAuthenticating(false);
      }
    }
  };

  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation
  const isValidPassword = (password: string) => {
    return password.length >= 6;
  };

  // User avatar component
  const UserAvatar: React.FC<{ size?: string }> = ({ size = 'w-24 h-24' }) => {
    const [imageError, setImageError] = useState(false);
    
    const avatarToShow = imagePreview;
    
    if (avatarToShow && !imageError) {
      return (
        <img 
          src={avatarToShow}
          alt="Profile"
          className={`${size} rounded-full object-cover`}
          onError={() => setImageError(true)}
        />
      );
    }

    return (
      <div className={`${size} rounded-full bg-primary flex items-center justify-center`}>
        <span className="text-white font-semibold text-lg">
          {username ? getInitials(username, username) : <UserIcon size={40} className="text-white" />}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6">
      <div className="flex-1 flex flex-col justify-center items-center">
        {/* Step 0: Welcome Screen */}
        {step === 0 && (
          <>
            <div className="w-48 h-48 rounded-full overflow-hidden mb-8 shadow-lg">
              <img 
                src="/images/tip-splash-screen.png"
                alt="Tip App"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-3xl font-bold mb-6 text-center">
              Welcome to the tastiest social app
            </h1>
            <p className="text-center text-gray-600 mb-8 px-4">
              Discover the best dishes at restaurants near you with photos,
              videos, and ratings from real diners.
            </p>
          </>
        )}

        {/* Step 1: Email/Password Input */}
        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold mb-8 text-center">
              {isSignInMode ? "Welcome Back!" : "Create an Account"}
            </h1>
            <div className="w-full max-w-sm mb-8">
              {/* Email Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full p-4 border rounded-xl text-lg ${
                    email && !isValidEmail(email) ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="your@email.com"
                  autoComplete="email"
                />
                {email && !isValidEmail(email) && (
                  <p className="text-xs text-red-500 mt-1">Please enter a valid email address</p>
                )}
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full p-4 border rounded-xl text-lg pr-12 ${
                      password && !isValidPassword(password) ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder={isSignInMode ? "Enter your password" : "Create a password"}
                    autoComplete={isSignInMode ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                  </button>
                </div>
                {!isSignInMode && password && !isValidPassword(password) && (
                  <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters long</p>
                )}
              </div>

              {/* Error Message */}
              {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{authError}</p>
                </div>
              )}

              {/* Toggle Sign In/Sign Up */}
              <div className="mt-4 text-center">
                <button 
                  onClick={() => setIsSignInMode(!isSignInMode)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors cursor-pointer"
                >
                  {isSignInMode ? "New user? Create account" : "Already have an account? Sign In"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Username Creation */}
        {step === 2 && (
          <>
            <h1 className="text-3xl font-bold mb-6 text-center">
              Create your profile
            </h1>
            <div className="w-full mb-6">
              <label className="block text-sm font-medium mb-2">Username</label>
              <div className="flex items-center">
                <input 
                  type="text" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  className="flex-1 p-3 border border-gray-300 rounded-l-xl" 
                  placeholder="Choose a username" 
                />
                <button 
                  onClick={generateRandomUsername} 
                  className="bg-secondary text-white p-3 rounded-r-xl hover:bg-opacity-90 transition-colors"
                >
                  <ShuffleIcon size={24} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                You can always change this later
              </p>
            </div>
            {/* Error Message */}
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{authError}</p>
              </div>
            )}

            <div className="w-full mb-8">
              <label className="block text-sm font-medium mb-2">
                Profile Picture
              </label>
              <div className="flex justify-center">
                <UserAvatar />
              </div>
              <div className="flex justify-center mt-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center text-secondary text-sm font-medium hover:opacity-75 transition-opacity"
                >
                  <Camera size={16} className="mr-1" />
                  Upload photo
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
          </>
        )}

      </div>

      {/* Bottom Button */}
      <button 
        onClick={handleNext} 
        className="w-full bg-primary text-white py-4 rounded-xl font-medium flex items-center justify-center transition-colors hover:opacity-90 disabled:opacity-50"
        disabled={
          (step === 1 && (!email.trim() || !password.trim() || !isValidEmail(email) || (!isSignInMode && !isValidPassword(password)) || isAuthenticating)) ||
          (step === 2 && (!username.trim() || isAuthenticating))
        }
      >
        {isAuthenticating ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            {step === 2 ? 'Creating Profile...' : isSignInMode ? 'Signing In...' : 'Creating Account...'}
          </>
        ) : (
          <>
            {step === 2 ? 'Get Started' : 
             step === 1 ? (isSignInMode ? 'Sign In' : 'Create Account') : 'Next'}
            <ChevronRightIcon size={20} className="ml-1" />
          </>
        )}
      </button>

      {/* Image Editor Modal */}
      {showImageEditor && imagePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Crop Profile Picture</h3>
              <button
                onClick={() => setShowImageEditor(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <div
                ref={imageEditorRef}
                className="relative w-64 h-64 mx-auto border-2 border-gray-300 rounded-full overflow-hidden cursor-move"
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
                    left: `${cropPosition.x - 50}%`,
                    top: `${cropPosition.y - 50}%`,
                    transform: 'translate(-50%, -50%)',
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
                onClick={() => setShowImageEditor(false)}
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

export default Onboarding;