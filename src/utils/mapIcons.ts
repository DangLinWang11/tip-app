/**
 * Utility functions for creating custom map pin icons
 */

/**
 * Creates a custom dish rating pin icon with rating number and gold star
 * @param rating - The dish rating as a string (e.g., "9.2")
 * @returns Data URI string for the SVG icon
 */
export const createDishRatingPinIcon = (rating: string): string => {
  const primaryRed = '#ff3131';
  const goldStar = '#FFD700';
  const goldStarStroke = '#F59E0B';
  const canvasWidth = 64;
  const canvasHeight = 48;
  const pillWidth = 60;
  const pillHeight = 32;
  const pillRadius = 16;

  const svg = `
    <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Subtle drop shadow for depth -->
        <filter id="shadow-${rating}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Shadow base -->
      <ellipse cx="${canvasWidth/2}" cy="${pillHeight + 14}" rx="20" ry="3" fill="black" opacity="0.15"/>

      <!-- Main pill background (white with red border) -->
      <rect
        x="2"
        y="2"
        width="${pillWidth}"
        height="${pillHeight}"
        rx="${pillRadius}"
        fill="white"
        stroke="${primaryRed}"
        stroke-width="2.5"
        filter="url(#shadow-${rating})"
      />

      <!-- Rating number (bold red) -->
      <text
        x="20"
        y="22"
        font-family="Arial, sans-serif"
        font-size="15"
        font-weight="bold"
        fill="${primaryRed}"
        text-anchor="middle"
      >${rating}</text>

      <!-- Gold star icon -->
      <path
        d="M 12 2 L 14.4 7.2 L 20 8 L 16 12 L 17 18 L 12 15 L 7 18 L 8 12 L 4 8 L 9.6 7.2 Z"
        fill="${goldStar}"
        stroke="${goldStarStroke}"
        stroke-width="0.5"
        transform="translate(30, 7) scale(0.9)"
      />

      <!-- Pointer triangle (pointing down) -->
      <path
        d="M ${canvasWidth/2 - 5} ${pillHeight + 2} L ${canvasWidth/2} ${canvasHeight - 2} L ${canvasWidth/2 + 5} ${pillHeight + 2} Z"
        fill="${primaryRed}"
      />
    </svg>
  `;

  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};
