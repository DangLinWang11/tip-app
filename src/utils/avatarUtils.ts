// Utility functions for avatar handling

/**
 * Generates initials from username and display name
 * @param username - The username
 * @param displayName - Optional display name
 * @returns Two-character initials in uppercase
 */
export const getInitials = (username: string, displayName?: string): string => {
  if (displayName && displayName !== username) {
    const names = displayName.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
};

/**
 * Generates a data URI for an avatar with initials
 * @param initials - The initials to display
 * @param size - Size of the avatar (default: 150)
 * @param bgColor - Background color (default: #EF4444 - primary red)
 * @param textColor - Text color (default: white)
 * @returns Data URI string for the avatar
 */
export const generateAvatarDataUri = (
  initials: string, 
  size: number = 150, 
  bgColor: string = '#EF4444', 
  textColor: string = '#FFFFFF'
): string => {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bgColor}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
            font-family="system-ui, -apple-system, sans-serif" 
            font-size="${size/3}" font-weight="600" fill="${textColor}">
        ${initials}
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Gets the appropriate avatar URL or generates an initials avatar
 * @param userProfile - User profile object
 * @returns Avatar URL (either real image or generated initials)
 */
export const getAvatarUrl = (userProfile: {
  avatar?: string;
  username: string;
  displayName?: string;
}): string => {
  if (userProfile.avatar) {
    return userProfile.avatar;
  }
  
  const initials = getInitials(userProfile.username, userProfile.displayName);
  return generateAvatarDataUri(initials);
};