import React from 'react';
import { X } from 'lucide-react';
import UserJourneyMap from './UserJourneyMap';

interface ExpandedMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExpandedMapModal: React.FC<ExpandedMapModalProps> = ({
  isOpen,
  onClose
}) => {
  // Don't render if not open
  if (!isOpen) return null;

  // Close modal when clicking backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
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

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl w-full h-full max-w-6xl max-h-[85vh] overflow-hidden shadow-2xl relative">
        {/* Header with close button */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Your Food Journey</h2>
            <p className="text-sm text-gray-600">Click any restaurant pin to see your dishes</p>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
            aria-label="Close map"
          >
            <X size={24} className="text-gray-700" />
          </button>
        </div>

        {/* Expanded map content */}
        <div className="w-full h-full pt-20">
          <UserJourneyMap className="w-full h-full" />
        </div>

        {/* Map controls overlay */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="flex items-center space-x-3 text-sm text-gray-600">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span>Visited Restaurants</span>
            </div>
            <div className="text-gray-400">•</div>
            <span>Click pins for details</span>
          </div>
        </div>

        {/* Zoom hint */}
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          <p className="text-xs text-gray-500">Use scroll wheel to zoom</p>
        </div>
      </div>
    </div>
  );
};

export default ExpandedMapModal;