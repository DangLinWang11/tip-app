import React from 'react';

interface LocationPinIconProps {
  size?: number;
  className?: string;
}

const LocationPinIcon: React.FC<LocationPinIconProps> = ({ size = 14, className = '' }) => {
  // Classic teardrop pin design with white circle in center
  // Standard map pin aspect ratio (width to height ~0.7)
  const viewBoxWidth = 24;
  const viewBoxHeight = 34;

  // Calculate proportional width based on height
  const width = (size * viewBoxWidth) / viewBoxHeight;

  // Extract color from className for currentColor support
  const colorClass = className || 'text-red-500';

  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      className={colorClass}
      style={{ display: 'inline-block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main teardrop pin shape */}
      <path
        d="M 12 2
           C 6.5 2, 2 6.5, 2 12
           C 2 17.5, 12 30, 12 30
           C 12 30, 22 17.5, 22 12
           C 22 6.5, 17.5 2, 12 2 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
      />

      {/* White center circle */}
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="white"
      />
    </svg>
  );
};

export default LocationPinIcon;
