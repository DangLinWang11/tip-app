import React from 'react';
import { X, MapIcon } from 'lucide-react';
import UserJourneyMap from './UserJourneyMap';

interface ExpandedMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;        // optional userId for viewing other users' maps
  userName?: string;      // optional userName for header display
}

const ExpandedMapModal: React.FC<ExpandedMapModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName
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
      className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex items-center justify-center px-2 py-6 overscroll-contain"
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
        className="bg-white rounded-xl w-full max-w-6xl h-[calc(100dvh-8rem)] overflow-hidden shadow-2xl relative flex flex-col"
      >
        {/* Header with close button */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-start gap-2">
            <MapIcon size={20} className="text-primary mt-0.5" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {userName ? `${userName}'s Food Journey` : 'Your Food Journey'}
              </h2>
            </div>
          </div>
          
          <button
            onClick={() => { unlockScroll(); onClose(); }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
            aria-label="Close map"
          >
            <X size={24} className="text-gray-700" />
          </button>
        </div>

        {/* Expanded map content */}
        <div
          className="w-full h-full pt-20"
        >
          <UserJourneyMap className="w-full h-full" showLegend userId={userId} />
        </div>


        {/* Removed zoom hint for a cleaner look */}
      </div>
    </div>
  );
};

export default ExpandedMapModal;
