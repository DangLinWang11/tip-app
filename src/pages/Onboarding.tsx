import React, { useState } from 'react';
import { ChevronRightIcon, ShuffleIcon, UserIcon } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const generateRandomUsername = () => {
    const adjectives = ['Hungry', 'Tasty', 'Spicy', 'Sweet', 'Savory', 'Crispy', 'Juicy'];
    const nouns = ['Foodie', 'Chef', 'Eater', 'Gourmet', 'Critic', 'Taster', 'Diner'];
    const randomNum = Math.floor(Math.random() * 1000);
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    setUsername(`${randomAdj}${randomNoun}${randomNum}`);
  };

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onComplete();
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
      {step === 1 && (
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
              Create an Account
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
                We'll send you a verification code
              </p>
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
        onClick={handleNext} 
        className="w-full bg-primary text-white py-4 rounded-xl font-medium flex items-center justify-center transition-colors hover:opacity-90 disabled:opacity-50"
        disabled={step === 1 && phoneNumber.length < 14} // Disable if phone incomplete
      >
        {step === 2 ? 'Get Started' : 
         step === 1 ? 'Continue' : 'Next'}
        <ChevronRightIcon size={20} className="ml-1" />
      </button>
    </div>
  );
};

export default Onboarding;