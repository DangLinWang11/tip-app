import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HamburgerMenu from './HamburgerMenu';

interface ProfileHeaderProps {
  username: string;
  showMenu?: boolean;
  onBack?: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  username,
  showMenu = false,
  onBack
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left: Back button */}
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={24} className="text-gray-700" />
        </button>

        {/* Center: Username */}
        <h1 className="text-lg font-semibold text-gray-900">
          @{username}
        </h1>

        {/* Right: Hamburger menu or empty space for balance */}
        {showMenu ? (
          <HamburgerMenu />
        ) : (
          <div className="w-10" />
        )}
      </div>
    </header>
  );
};

export default ProfileHeader;
