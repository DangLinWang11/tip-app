import React from 'react';
import UserJourneyMap from './UserJourneyMap';

interface FocusRestaurant {
  lat: number;
  lng: number;
  id: string;
  name: string;
}

interface ExpandedMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;        // optional userId for viewing other users' maps
  userName?: string;      // optional userName for header display
  userTierIndex?: number; // badge tier index for header display
  homeCountry?: string;   // ISO country code for map centering
  allowHomeCountryOverride?: boolean;
  focusRestaurant?: FocusRestaurant;
}

const ExpandedMapModal: React.FC<ExpandedMapModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  userTierIndex,
  homeCountry,
  allowHomeCountryOverride = true,
  focusRestaurant
}) => {
  // Don't render if not open
  if (!isOpen) return null;

  // Close modal when clicking backdrop
  const unlockScroll = () => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      unlockScroll();
      onClose();
    }
  };

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Save original overflow styles so we can restore precisely
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent page scroll when modal is open (iOS-friendly)
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalBodyOverflow || '';
      document.documentElement.style.overflow = originalHtmlOverflow || '';
    };
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex items-center justify-center px-2 pb-6 overscroll-contain"
      onClick={handleBackdropClick}
      onTouchStart={(e) => { e.stopPropagation(); }}
      onTouchMove={(e) => { e.stopPropagation(); }}
      onTouchEnd={(e) => { e.stopPropagation(); }}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onPointerMove={(e) => { e.stopPropagation(); }}
      onPointerUp={(e) => { e.stopPropagation(); }}
      onWheel={(e) => { e.stopPropagation(); }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-6xl h-[calc(100dvh-6rem)] overflow-hidden shadow-2xl relative flex flex-col"
      >
        <div className="w-full h-full">
          <UserJourneyMap
            className="w-full h-full"
            showLegend
            userId={userId}
            userName={userName}
            userTierIndex={userTierIndex}
            homeCountry={homeCountry}
            focusRestaurant={focusRestaurant}
            onClose={() => { unlockScroll(); onClose(); }}
            allowHomeCountryOverride={allowHomeCountryOverride}
          />
        </div>
      </div>
    </div>
  );
};

export default ExpandedMapModal;
