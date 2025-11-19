// File: src/pages/Onboarding.tsx
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { logEvent } from 'firebase/analytics';
import { analytics } from '../lib/firebase';
import { ChevronRightIcon, ShuffleIcon, UserIcon, EyeIcon, EyeOffIcon, Camera, X } from 'lucide-react';
import {
  auth,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  createUserProfile,
  updateLastLogin,
  getUserProfile
} from '../lib/firebase';
import { uploadPhoto } from '../services/reviewService';
import { getInitials } from '../utils/avatarUtils';

interface OnboardingProps {
  onComplete: () => void;
  needsUsernameOnly?: boolean; // NEW: Skip to username step if user is already authenticated
}

interface CropPosition {
  x: number;
  y: number;
  scale: number;
}

const PREVIEW_SIZE = 400;

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, needsUsernameOnly = false }) => {
  const [step, setStep] = useState(needsUsernameOnly ? 2 : 0); // Start at username if already authenticated
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignInMode, setIsSignInMode] = useState(false);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  // Swipe tabs for the auth step
  const [activeTab, setActiveTab] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Profile picture states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [originalSelectedImage, setOriginalSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState<CropPosition>({
    x: 0,
    y: 0,
    scale: 1
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageEditorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

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
        // Update last login
        await updateLastLogin();

        let userProfile: any = null;
        try {
          const profileResult = await getUserProfile(result.user.uid);
          if (profileResult.success) {
            userProfile = profileResult.profile;
          }
        } catch (profileError) {
          console.error('Failed to fetch profile after email auth:', profileError);
        }

        if (!userProfile?.username) {
          // Move to username step (for new users). App.tsx will switch
          // to main app for existing users; RedirectAfterLogin uses ?redirect.
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

  // Handle Google authentication
  const handleGoogleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const result = await signInWithGoogle();

      if (result.success && result.user) {
        // Update last login
        await updateLastLogin();

        let userProfile: any = null;
        try {
          const profileResult = await getUserProfile(result.user.uid);
          if (profileResult.success) {
            userProfile = profileResult.profile;
          }
        } catch (profileError) {
          console.error('Failed to fetch profile after Google auth:', profileError);
        }
        
        if (!userProfile?.username) {
          // Move to username step; main app + RedirectAfterLogin will handle redirect.
          setStep(2);
        }
      } else {
        setAuthError(result.error || 'Google sign-in failed');
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
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

    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    setUsername(`${randomAdj}_${randomNoun}_${randomNum}`);
  };

  // Handle image selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAuthError('Image must be smaller than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setAuthError('Please select a valid image file');
        return;
      }

      setOriginalImage(imagePreview);
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    setCropPosition(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleScaleChange = (scale: number) => {
    setCropPosition(prev => ({ ...prev, scale }));
  };

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
        const size = PREVIEW_SIZE;
        canvas.width = size;
        canvas.height = size;

        const zoom = cropPosition.scale;
        const sourceWidth = size / zoom;
        const sourceHeight = size / zoom;

        const previewToImageScaleX = img.width / PREVIEW_SIZE;
        const previewToImageScaleY = img.height / PREVIEW_SIZE;

        let sourceX = (img.width / 2) - (sourceWidth / 2) - ((cropPosition.x * previewToImageScaleX) / zoom);
        let sourceY = (img.height / 2) - (sourceHeight / 2) - ((cropPosition.y * previewToImageScaleY) / zoom);

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

  const applyCroppedImage = async () => {
    try {
      const croppedFile = await createCroppedImage();
      setSelectedImage(croppedFile);
      setShowImageEditor(false);
      
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
      setAuthError('Failed to crop image');
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

  const handleNext = async () => {
    if (step === 1) {
      await handleAuthentication();
    } else if (step < 2) {
      setStep(step + 1);
    } else {
      // Final step - create user profile
      const currentUser = auth.currentUser;
      if (currentUser && username.trim()) {
        setIsAuthenticating(true);
        
        let avatarUrl = '';
        
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
          // After profile creation, honor redirect if present
          try {
            const sp = new URLSearchParams(window.location.search);
            const redirect = sp.get('redirect');
            if (redirect) {
              // Clear redirect param
              sp.delete('redirect');
              const base = window.location.origin + window.location.pathname;
              const rest = sp.toString();
              const newUrl = rest ? `${base}?${rest}` : base;
              window.history.replaceState({}, '', newUrl);
              window.location.assign(redirect);
              return;
            }
          } catch {}
          onComplete();
        } else {
          setAuthError(result.error || 'Error saving profile. Please try again.');
        }
        
        setIsAuthenticating(false);
      }
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPassword = (password: string) => {
    return password.length >= 6;
  };

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

  const encodeRedirect = (path: string) => `/login?redirect=${encodeURIComponent(path)}`;
  const setRedirectQueryParam = (path: string) => {
    const sp = new URLSearchParams(location.search);
    sp.set('redirect', path);
    const base = window.location.pathname;
    const newUrl = `${base}?${sp.toString()}`;
    window.history.replaceState({}, '', newUrl);
    setRedirectAfterAuth(path);
  };
  const isAuthed = !!auth.currentUser;
  const goOwner = () => {
    const target = '/owner/dashboard';
    try { if (analytics) logEvent(analytics as any, 'owner_entry', { source: 'onboarding', variant: 'owner' }); } catch {}
    if (isAuthed) {
      navigate(target);
      return;
    }
    // Unauthed: open the auth panel inline and prepare redirect to Owner Portal
    setStep(1);
    setActiveTab(0);
    tabsRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    setIsSignInMode(true);
    setRedirectQueryParam(target);
  };
  const goClaim = () => {
    const params = new URLSearchParams(location.search);
    const claimId = params.get('claim');
    const target = claimId ? `/owner?start=claim&claim=${claimId}` : '/owner?start=claim';
    try { if (analytics) logEvent(analytics as any, 'owner_entry', { source: 'onboarding', variant: 'claim' }); } catch {}
    if (isAuthed) {
      navigate(target);
      return;
    }
    // Unauthed: open the auth panel inline and prepare redirect to Claim flow
    setStep(1);
    setActiveTab(0);
    tabsRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    setIsSignInMode(true);
    setRedirectQueryParam(target);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6">
      <div className="flex-1 flex flex-col justify-center items-center">
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

        {step === 1 && (
          <>
            <div className="w-full max-w-sm mx-auto">
              <div className="flex items-end justify-center gap-8 mb-6 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => { setActiveTab(0); tabsRef.current?.scrollTo({ left: 0, behavior: 'smooth' }); }}
                  className={`relative px-1 pb-2 text-sm font-semibold ${activeTab===0 ? 'text-black' : 'text-gray-400'}`}
                  aria-selected={activeTab===0}
                >
                  For You
                  <span className={`pointer-events-none absolute left-0 right-0 -bottom-[1px] h-0.5 rounded-full ${activeTab===0 ? 'bg-black' : 'bg-transparent'}`}></span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab(1); const el=tabsRef.current; if(el) el.scrollTo({ left: el.clientWidth, behavior: 'smooth' }); }}
                  className={`relative px-1 pb-2 text-sm font-semibold ${activeTab===1 ? 'text-black' : 'text-gray-400'}`}
                  aria-selected={activeTab===1}
                >
                  For Restaurants
                  <span className={`pointer-events-none absolute left-0 right-0 -bottom-[1px] h-0.5 rounded-full ${activeTab===1 ? 'bg-black' : 'bg-transparent'}`}></span>
                </button>
              </div>
              <div ref={tabsRef} onScroll={() => { const el=tabsRef.current; if(!el) return; const idx=Math.round(el.scrollLeft/Math.max(1,el.clientWidth)); if(idx!==activeTab) setActiveTab(idx); }} className="flex overflow-x-auto snap-x snap-mandatory" style={{scrollSnapType:'x mandatory', scrollbarWidth:'none', msOverflowStyle:'none'}}>
                <style>{`div[style*="scroll-snap-type"]::-webkit-scrollbar{display:none}`}</style>
                {/* Panel 1: Auth */}
                <div className="min-w-full snap-center px-1">
                  <h1 className="text-3xl font-bold mb-6 text-center">{isSignInMode ? 'Welcome Back!' : 'Create an Account'}</h1>
                  <button onClick={handleGoogleSignIn} disabled={isAuthenticating} className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-medium flex items-center justify-center mb-6 hover:bg-gray-50 transition-colors disabled:opacity-50">
                    {isAuthenticating ? (<div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2" />) : (
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    )}
                    Continue with Google
                  </button>
                  <div className="flex items-center mb-6"><div className="flex-1 border-t border-gray-300"></div><span className="px-4 text-sm text-gray-500">or</span><div className="flex-1 border-t border-gray-300"></div></div>
                  <div className="mb-8">
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Email Address</label>
                      <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className={`w-full p-4 border rounded-xl text-lg ${email && !isValidEmail(email) ? 'border-red-300':'border-gray-300'}`} placeholder="your@email.com" autoComplete="email" />
                      {email && !isValidEmail(email) && (<p className="text-xs text-red-500 mt-1">Please enter a valid email address</p>)}
                    </div>
                    <div className="mb-2">
                      <label className="block text-sm font-medium mb-2">Password</label>
                      <div className="relative">
                        <input type={showPassword?'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} className={`w-full p-4 border rounded-xl text-lg pr-12 ${password && !isValidPassword(password)?'border-red-300':'border-gray-300'}`} placeholder={isSignInMode?'Enter your password':'Create a password'} autoComplete={isSignInMode?'current-password':'new-password'} />
                        <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">{showPassword ? <EyeOffIcon size={20}/> : <EyeIcon size={20}/>}</button>
                      </div>
                      {!isSignInMode && password && !isValidPassword(password) && (<p className="text-xs text-red-500 mt-1">Password must be at least 6 characters long</p>)}
                    </div>
                    {authError && (<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{authError}</div>)}
                    <div className="mt-4 text-center"><button onClick={()=>setIsSignInMode(!isSignInMode)} className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors">{isSignInMode ? 'New user? Create account' : 'Already have an account? Sign In'}</button></div>
                  </div>
                </div>
                {/* Panel 2: Restaurants */}
                <div className="min-w-full snap-center px-1">
                  <h1 className="text-3xl font-bold mb-6 text-center">For Restaurants</h1>
                  <section className="w-full border rounded-2xl p-4">
                    <h3 className="text-lg font-semibold">Restaurant Access</h3>
                    <p className="text-sm text-gray-600 mt-1">Tip owners get insights, top dishes, and simple promos — all free.</p>
                    <div className="mt-3 grid gap-2">
                      <button type="button" onClick={goOwner} aria-label="Owner portal sign-in" className="w-full rounded-xl border px-4 py-3 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2" title="Analytics & deals for your restaurant.">Open Owner Portal</button>
                      <button type="button" onClick={goClaim} aria-label="Claim my restaurant" className="w-full rounded-xl bg-primary text-white px-4 py-3 text-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2" title="Analytics & deals for your restaurant.">Claim my restaurant</button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="w-full mb-6 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-bold text-center flex-1">
                Create your profile
              </h1>
              <div className="w-12"></div>
            </div>
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

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Onboarding;
