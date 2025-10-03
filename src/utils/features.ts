// src/utils/features.ts
export const FEATURES = {
  // Social Features (MVP: Disabled)
  SOCIAL_FEED: false,           // Home page social feed from other users
  USER_FOLLOWING: false,        // Follow/unfollow other users
  LIKES_COMMENTS: false,        // Like and comment on posts
  NOTIFICATIONS: false,         // Alerts/notifications page
  USER_DISCOVERY: false,        // Finding and viewing other user profiles
  
  // Gamification Features (MVP: Disabled)
  TIER_RANKINGS: false,         // Top dish/restaurant rankings
  POINTS_SYSTEM: false,         // Points earning and rewards
  LEADERBOARDS: false,          // User ranking comparisons
  
  // Advanced Features (MVP: Disabled)  
  PUBLIC_PROFILES: false,       // Public user profile viewing
  SOCIAL_SHARING: false,        // Share posts to other platforms
  RESTAURANT_SOCIAL: false,     // Restaurant posts in social feed
  
  // Experimental
  NEW_CREATE_FLOW: true,        // New multi-step create review flow
  NEW_CREATE_V2: true,         // Create wizard v2 (caption step)

  // Core MVP Features (Always Enabled)
  PERSONAL_REVIEWS: true,       // User's own review creation and history
  RESTAURANT_DISCOVERY: true,   // Restaurant search and discovery
  REVIEW_CREATION: true,        // Create new reviews
  PERSONAL_STATS: true,         // Individual user statistics
  FOOD_MAP: true               // Personal food journey tracking
};

// Helper function to check if feature is enabled
export const isFeatureEnabled = (feature: keyof typeof FEATURES): boolean => {
  return FEATURES[feature];
};

// Development override - set to true to enable all features for testing
const DEVELOPMENT_MODE = false;

export const useFeature = (feature: keyof typeof FEATURES): boolean => {
  if (DEVELOPMENT_MODE) return true;
  return isFeatureEnabled(feature);
};

