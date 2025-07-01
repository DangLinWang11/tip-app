import React, { useState, useEffect } from 'react';
import { ChevronRightIcon, ShuffleIcon, UserIcon } from 'lucide-react';
import { 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface OnboardingProps {
  onComplete: () => void;
  needsPhoneOnly?: boolean;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, needsPhoneOnly = false }) => {
  const [step, setStep] = useState(needsPhoneOnly ? 1 : 0);
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSignInMode, setIsSignInMode] = useState(needsPhoneOnly);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  // Initialize reCAPTCHA verifier
  useEffect(() => {
    const initRecaptcha = () => {
      if (!recaptchaVerifier) {
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA solved');
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
          }
        });
        setRecaptchaVerifier(verifier);
      }
    };

    initRecaptcha();

    return () => {
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
      }
    };
  }, [recaptchaVerifier]);

  // Check if user already exists in Firestore
  const checkExistingUser = async (user: User) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error('Error checking existing user:', error);
      return null;
    }
  };

  // Save user profile to Firestore
  const saveUserProfile = async (user: User, profileData: any) => {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        ...profileData,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date()
      });
      return true;
    } catch (error) {
      console.error('Error saving user profile:', error);
      return false;
    }
  };

  // Send SMS verification code
  const sendVerificationCode = async () => {
    if (!recaptchaVerifier || !phoneNumber) return;

    setIsSendingCode(true);
    try {
      // Convert formatted phone to E.164 format
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const e164Phone = `+1${cleanPhone}`;
      
      const confirmation = await signInWithPhoneNumber(auth, e164Phone, recaptchaVerifier);
      setConfirmationResult(confirmation);
      setStep(1.5);
      console.log('SMS sent successfully');
    } catch (error: any) {
      console.error('Error sending SMS:', error);
      alert(`Error sending verification code: ${error.message}`);
      
      // Reset reCAPTCHA on error
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        setRecaptchaVerifier(null);
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verify SMS code
  const verifyCode = async () => {
    if (!confirmationResult || !verificationCode) return;

    setIsVerifying(true);
    try {
      const result = await confirmationResult.confirm(verificationCode);
      const user = result.user;

      // Check if user already has a profile
      const existingProfile = await checkExistingUser(user);
      
      if (existingProfile && existingProfile.username) {
        // User exists with complete profile - sign them in
        onComplete();
      } else {
        // New user or incomplete profile - go to username step
        setStep(2);
      }
    } catch (error: any) {
      console.error('Error verifying code:', error);
      alert('Invalid verification code. Please try again.');
    } finally {
      setIsVerifying(false);
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
      // Send SMS verification code
      await sendVerificationCode();
    } else if (step === 1.5) {
      // This will be handled by verifyCode
      return;
    } else if (step < 2) {
      setStep(step + 1);
    } else {
      // Final step - save user profile and complete onboarding
      const currentUser = auth.currentUser;
      if (currentUser && username.trim()) {
        const success = await saveUserProfile(currentUser, {
          username: username.trim(),
          isOnboarded: true
        });
        
        if (success) {
          onComplete();
        } else {
          alert('Error saving profile. Please try again.');
        }
      }
    }
  };

  const handleSkip = () => {
    // Skip phone number step, go to username
    if (step === 1) {
      setStep(2);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (phoneNumber.length >= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    } else if (phoneNumber.length >= 3) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    } else {
      return phoneNumber;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6">
      {/* Skip button for phone number step */}
      {step === 1 && !needsPhoneOnly && (
        <div className="flex justify-end mb-4">
          <button 
            onClick={handleSkip}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            Skip
          </button>
        </div>
      )}

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

        {/* Step 1: Phone Number Input */}
        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold mb-8 text-center">
              {isSignInMode ? "Welcome Back!" : "Create an Account"}
            </h1>
            <div className="w-full max-w-sm mb-8">
              <label className="block text-sm font-medium mb-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="w-full p-4 border border-gray-300 rounded-xl text-lg"
                placeholder="(555) 123-4567"
                maxLength={14}
                inputMode="numeric"
              />
              <p className="text-xs text-gray-500 mt-2">
                {isSignInMode ? "We'll send you a verification code to confirm it's you" : "We'll send you a verification code"}
              </p>
              {!needsPhoneOnly && (
                <div className="mt-3 text-center">
                  <button 
                    onClick={() => setIsSignInMode(!isSignInMode)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors cursor-pointer"
                  >
                    {isSignInMode ? "New user? Create account" : "Already have an account? Sign In"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 1.5: Verification Code Input */}
        {step === 1.5 && (
          <>
            <h1 className="text-3xl font-bold mb-8 text-center">
              {isSignInMode ? "Welcome back!" : "Verify your phone"}
            </h1>
            <div className="w-full max-w-sm mb-8">
              <label className="block text-sm font-medium mb-2">Verification Code</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full p-4 border border-gray-300 rounded-xl text-lg text-center tracking-widest"
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                {isSignInMode 
                  ? `Enter the 6-digit code sent to ${phoneNumber}`
                  : `Enter the 6-digit code sent to ${phoneNumber}`
                }
              </p>
              <div className="mt-4 text-center">
                <button 
                  onClick={() => setStep(1)}
                  className="text-secondary text-sm font-medium hover:opacity-75 transition-opacity"
                >
                  Change phone number
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
                  Upload photo
                </button>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Bottom Button */}
      <button 
        onClick={step === 1.5 ? verifyCode : handleNext} 
        className="w-full bg-primary text-white py-4 rounded-xl font-medium flex items-center justify-center transition-colors hover:opacity-90 disabled:opacity-50"
        disabled={
          (step === 1 && (phoneNumber.length < 14 || isSendingCode)) || 
          (step === 1.5 && (verificationCode.length < 6 || isVerifying)) ||
          (step === 2 && !username.trim())
        }
      >
        {(isVerifying || isSendingCode) ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            {step === 1 ? 'Sending...' : 'Verifying...'}
          </>
        ) : (
          <>
            {step === 2 ? 'Get Started' : 
             step === 1.5 ? 'Verify' :
             step === 1 ? 'Send Code' : 'Next'}
            <ChevronRightIcon size={20} className="ml-1" />
          </>
        )}
      </button>

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </div>
  );
};

export default Onboarding;