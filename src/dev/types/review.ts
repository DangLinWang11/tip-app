export type DishCategory = 'appetizer' | 'entree' | 'handheld' | 'side' | 'dessert' | 'drink';

export type MealTimeTag = 'breakfast' | 'brunch' | 'lunch' | 'dinner' | 'late_night' | 'dessert' | 'snack';

export type ServiceSpeed = 'fast' | 'normal' | 'slow';

export interface MediaObject {
  original: string;      // Full-resolution URL
  thumbnail: string;     // 200x200 thumbnail for feed display
  medium: string;        // 800x800 for detail views
  width?: number;        // Original width in pixels
  height?: number;       // Original height in pixels
}

export interface MediaBundle {
  photos: string[];               // Legacy: array of full-resolution URLs
  photoObjects?: MediaObject[];   // New: enhanced objects with thumbnail URLs
  videos: string[];
  thumbnails: string[];
}

export type ComparisonMode = 'same_restaurant' | 'history' | 'archetype' | 'free_text';

export interface ComparisonSelection {
  mode: ComparisonMode;
  targetDishId?: string;
  targetText?: string;
  archetypeTag?: string;
  reasons?: string[];
  targetLocation?: { city?: string; geohash?: string };
}

export interface OutcomeSelection {
  orderAgain: boolean;
  recommend: boolean;
  audience?: string[];
  returnIntent: 'for_this' | 'for_others' | 'no';
}

export interface ExplicitSelection {
  dishType: string | null;
  dishStyle: string | null;
  cuisine: string | null;
  attributes?: string[]; // Deprecated: kept for backward compatibility
  positiveTags: string[];
  negativeTags: string[];
  occasions: string[];
  dietary: string[];
}

export interface SentimentSelection {
  pricePerception: 'bargain' | 'fair' | 'overpriced' | null;
}

export interface ReviewDraft {
  userId: string;
  restaurantId?: string;
  restaurantPriceLevel?: '$' | '$$' | '$$$' | '$$$$' | null;
  restaurantCuisines?: string[];
  cuisines?: string[];
  dishCuisine?: string;
  tags?: string[];
  dishId?: string;
  dishName: string;
  dishCategory?: DishCategory;
  rating: number; // 0.1..10.0
  dishTag?: string;
  caption?: string;
  visitCaption?: string;
  personalNote?: string;
  negativeNote?: string;
  serverRating?: string | number | null;
  price?: string | null;
  media: MediaBundle;
  explicit?: ExplicitSelection;
  sentiment?: SentimentSelection;
  comparison?: ComparisonSelection;
  outcome: OutcomeSelection;
  mealTimes?: MealTimeTag[]; // When this dish is best eaten
  serviceSpeed?: ServiceSpeed | null; // Perceived service speed
  visitId?: string; // For multi-dish visits
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted?: boolean;
}

// Structured feedback types
export type ToGoFeedbackScore = 'poor' | 'ok' | 'great';
export type DineInWaitTime = 'too_long' | 'fine' | 'fast';
export type DineInStaffFriendliness = 'low' | 'ok' | 'great';
export type DineInNoiseLevel = 'too_loud' | 'fine' | 'quiet';

export interface ToGoFeedback {
  readyOnTime?: ToGoFeedbackScore;
  orderAccurate?: ToGoFeedbackScore;
  packagingQuality?: ToGoFeedbackScore;
  foodTemperature?: ToGoFeedbackScore;
  essentialsIncluded?: ToGoFeedbackScore;
  pickupEase?: ToGoFeedbackScore;
}

export interface DineInFeedback {
  waitTime?: DineInWaitTime;
  staffFriendliness?: DineInStaffFriendliness;
  noiseLevel?: DineInNoiseLevel;
}

// Visit-level draft (multi-dish flow)
export interface VisitDraft {
  restaurantId?: string;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPriceLevel?: '$' | '$$' | '$$$' | '$$$$' | null;
  mealTime?: MealTimeTag | 'unspecified';
  overallText?: string; // Visit-level caption that applies to every dish review
  serviceSpeed?: ServiceSpeed | null;
  visitId?: string;
  businessTags?: string[]; // Business highlight tags: Great Staff, Wonderful Atmosphere, etc.
  businessLowlights?: string[]; // Business lowlight tags: Rude Staff, Very Loud Environment, etc.
  isToGo?: boolean; // Whether the order was to-go/takeout
  toGoFeedback?: ToGoFeedback; // Optional structured to-go feedback (only when isToGo === true)
  dineInFeedback?: DineInFeedback; // Optional structured dine-in feedback (only when isToGo === false)
}

// Per-dish draft (multi-dish flow)
export interface DishDraft {
  id: string;
  mediaIds: string[];
  dishName: string;
  dishCategory?: DishCategory;
  dishCuisine?: string;
  rating: number;
  explicit?: ExplicitSelection;
  sentiment?: SentimentSelection;
  outcome: OutcomeSelection;
  caption?: string;
}
