import React, { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface LocationDeniedMessageProps {
  feature: string;
  onDismiss?: () => void;
}

const LocationDeniedMessage: React.FC<LocationDeniedMessageProps> = ({ feature, onDismiss }) => {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);
  }, []);

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-900 mb-2">
          Location access needed to {feature}
        </p>
        {isIOS ? (
          <p className="text-xs text-red-800">
            <span className="font-medium">On iPhone:</span> Settings → Safari → Clear Website Data, then re-add this app
          </p>
        ) : (
          <p className="text-xs text-red-800">
            Enable location in your browser settings to use this feature
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-red-100 rounded transition-colors"
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4 text-red-600" />
        </button>
      )}
    </div>
  );
};

export default LocationDeniedMessage;
