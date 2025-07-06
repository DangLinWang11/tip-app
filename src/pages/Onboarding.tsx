import React, { useState, useEffect } from 'react';
import { ChevronRightIcon, ShuffleIcon, UserIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  auth, 
  signUpWithEmail, 
  signInWithEmail, 
  createUserProfile, 
  getUserProfile,
  updateLastLogin 
} from '../lib/firebase';

interface OnboardingProps {
  onComplete: () => void;
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
    const adjectives = ['Hungry', 'Tasty', 'Spicy', 'Sweet', 'Savory', 'Crispy', 'Juicy'];
    const nouns = ['Foodie', 'Chef', 'Eater', 'Gourmet', 'Critic', 'Taster', 'Diner'];
    const randomNum = Math.floor(Math.random() * 1000);
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    setUsername(`${randomAdj}${randomNoun}${randomNum}`);
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
        
        const result = await createUserProfile(currentUser, {
          username: username.trim(),
          displayName: username.trim()
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
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <UserIcon size={40} className="text-gray-500" />
                </div>
              </div>
              <div className="flex justify-center mt-2">
                <button className="text-secondary text-sm font-medium hover:opacity-75 transition-opacity">
                  Upload photo (coming soon)
                </button>
              </div>
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
    </div>
  );
};

export default Onboarding;