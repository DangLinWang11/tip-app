import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, where, doc, getDoc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getUserProfile, getCurrentUser, updateUserStats } from '../lib/firebase';
import { inferFacetsFromText, tokenizeForSearch, normalizeToken } from '../utils/taxonomy';
import { getAvatarUrl } from '../utils/avatarUtils';
import type { ExplicitSelection, SentimentSelection } from '../dev/types/review';

// Category weights for quality score calculation
const CATEGORY_WEIGHTS: Record<string, number> = {
  // Main dishes
  'entrees': 1.0,
  'main course': 1.0,
  'mains': 1.0,
  'entree': 1.0,
  'main': 1.0,
  
  // Starters
  'appetizers': 0.7,
  'starters': 0.7,
  'small plates': 0.7,
  'appetizer': 0.7,
  'starter': 0.7,
  
  // Sides and lighter fare
  'sides': 0.5,
  'side': 0.5,
  'salads': 0.6,
  'salad': 0.6,
  'soups': 0.6,
  'soup': 0.6,
  
  // Desserts
  'desserts': 0.4,
  'dessert': 0.4,
  'sweets': 0.4,
  'sweet': 0.4,
  
  // Alcoholic beverages
  'cocktails': 0.6,
  'cocktail': 0.6,
  'wine': 0.6,
  'wines': 0.6,
  
  // Non-alcoholic beverages
  'beer': 0.5,
  'beers': 0.5,
  'coffee': 0.5,
  'tea': 0.4,
  'beverages': 0.3,
  'beverage': 0.3,
  'drinks': 0.3,
  'drink': 0.3,
  
  // Default categories
  'custom': 0.8,
  'other': 0.8
};

// Photo upload service
export const uploadPhoto = async (file: File | Blob): Promise<string> => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'video/mp4': 'mp4',
      'application/pdf': 'pdf',
    };

    const maybeFile = file as File as { name?: string };
    const rawName = typeof maybeFile?.name === 'string' ? maybeFile.name : '';
    let ext = rawName && rawName.includes('.') ? (rawName.split('.').pop() || '').toLowerCase() : '';
    if (!ext) {
      ext = mimeToExt[(file as any).type] || 'jpg';
    }
    const fileName = `reviews/${timestamp}_${randomString}.${ext}`;
    try { console.debug('[uploadPhoto] upload path', fileName, 'type', (file as any).type); } catch {}
    
    // Create storage reference
    const storageRef = ref(storage, fileName);
    
    // Upload file
    const contentType = (file as any).type || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    const snapshot = await uploadBytes(storageRef, file, { contentType });
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw new Error('Failed to upload photo');
  }
};

// Upload multiple photos
export const uploadMultiplePhotos = async (files: (File | Blob)[]): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file => uploadPhoto(file));
    const photoUrls = await Promise.all(uploadPromises);
    return photoUrls;
  } catch (error) {
    console.error('Error uploading multiple photos:', error);
    throw new Error('Failed to upload photos');
  }
};

// Lightweight creator for reviews using server timestamps and optimistic ms fallback
export type NewReviewInput = Record<string, any>;
export async function createReview(data: NewReviewInput): Promise<string> {
  const nowMs = Date.now();
  const docData = {
    ...data,
    createdAt: serverTimestamp(),
    createdAtMs: nowMs,
    updatedAt: serverTimestamp(),
    isDeleted: false,
    visibility: data?.visibility ?? 'public',
  };
  const ref = await addDoc(collection(db, 'reviews'), docData);
  return ref.id;
}

// Review data interface
export interface ReviewData {
  restaurantId?: string | null; // Firebase restaurant ID for linking
  visitId?: string; // NEW: Shared ID for multi-dish visits
  menuItemId?: string | null; // Firebase menu item ID for linking
  restaurant: string;
  location: string;
  dish: string;
  // Note: Firestore rules require dishName on create. We preserve dish for legacy reads,
  // and ensure dishName is populated in the builder.
  rating: number;
  personalNote: string;
  visitCaption?: string;
  visitMedia?: string[]; // NEW: Unassigned/"vibes" photos from the visit
  negativeNote: string;
  serverRating?: 'bad' | 'okay' | 'good' | null;
  price?: string | null;
  restaurantPriceLevel?: '$' | '$$' | '$$$' | '$$$$' | null;
  explicit?: ExplicitSelection | null;
  sentiment?: SentimentSelection | null;
  explicitTags?: string[];
  derivedTags?: string[];
  tags: string[];
  restaurantCuisines?: string[];
  cuisines?: string[];
  images: string[];
  isPublic: boolean;
}

// Canonical client payload for creating a review
export type ReviewCreatePayload = Omit<ReviewData, 'dish'> & {
  dish: string;
  dishName: string; // required by rules
};

// Runtime assert helper
function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// Centralized builder that enforces required fields (including dishName)
export function buildReviewCreatePayload(input: ReviewData & { caption?: string }): ReviewCreatePayload & { caption?: string } {
  const dishName = (input as any).dishName || input.dish || 'Unknown Dish';
  if (!(input as any).dishName) {
    // Log a warning if the caller didn't pass dishName explicitly
    // (we still populate it here to satisfy rules)
    try { console.warn('[buildReviewCreatePayload] dishName missing; deriving from dish'); } catch {}
  }
  assert(typeof dishName === 'string' && dishName.trim().length > 0, 'dishName is required');
  const payload: ReviewCreatePayload & { caption?: string } = {
    ...input,
    dishName,
    explicit: input.explicit ?? null,
    sentiment: input.sentiment ?? null,
    explicitTags: Array.isArray(input.explicitTags) ? input.explicitTags : [],
    derivedTags: Array.isArray(input.derivedTags) ? input.derivedTags : [],
  } as any;

  // Remove undefined caption to prevent Firestore validation errors
  if (payload.caption === undefined) {
    delete payload.caption;
  }

  return payload;
}

// Review identifier helpers
type ReviewIdentifierInput = string | { id?: string | null; reviewId?: string | null };

export const normalizeReviewId = (input: ReviewIdentifierInput): string => {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed) {
      return trimmed;
    }
  } else if (input) {
    if (typeof input.id === 'string' && input.id.trim()) {
      return input.id.trim();
    }
    if (typeof input.reviewId === 'string' && input.reviewId.trim()) {
      return input.reviewId.trim();
    }
  }

  throw new Error('Invalid review identifier');
};

export const reviewDoc = (reviewId: string) => doc(db, 'reviews', reviewId);

// Report a review for moderation (reason should align with future enum values like 'spam' | 'inappropriate' | 'incorrect-info')
export const reportReview = async (reviewId: string, reason: string, details: string) => {
  const user = getCurrentUser();
  const payload = {
    reviewId,
    reporterId: user?.uid || null,
    reason,
    details,
    createdAt: new Date().toISOString(),
    timestamp: serverTimestamp(),
  };
  await addDoc(collection(db, 'reports'), payload);
};


// Create restaurant if it doesn't exist in Firebase
const createRestaurantIfNeeded = async (restaurant: any): Promise<string> => {
  if (restaurant.googlePlaceId) {
    console.log('Checking for existing restaurant with placeId:', restaurant.googlePlaceId);
    const q = query(collection(db, 'restaurants'), where('googlePlaceId', '==', restaurant.googlePlaceId));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const existingId = snapshot.docs[0].id;
      console.log('? Found existing restaurant with googlePlaceId:', existingId);
      return existingId;
    }
  }

  if (restaurant.id && !restaurant.id.startsWith('manual_') && !restaurant.id.startsWith('google_')) {
    console.log('Using existing restaurant ID:', restaurant.id);
    return restaurant.id;
  }
  
  try {
    console.log('Creating new restaurant:', restaurant.name);
    
    const coordinates = {
      lat: restaurant.coordinates?.lat || restaurant.coordinates?.latitude || 0,
      lng: restaurant.coordinates?.lng || restaurant.coordinates?.longitude || 0,
      latitude: restaurant.coordinates?.lat || restaurant.coordinates?.latitude || 0,
      longitude: restaurant.coordinates?.lng || restaurant.coordinates?.longitude || 0
    };
    
    const newRestaurant = {
      name: restaurant.name,
      cuisines: restaurant.cuisines || [],
      location: {
        formatted: restaurant.address || restaurant.location?.formatted || 'Address not provided'
      },
      phone: restaurant.phone || '',
      coordinates,
      googlePlaceId: restaurant.googlePlaceId || null,
      qualityScore: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'restaurants'), newRestaurant);
    console.log('? Created new restaurant with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('? Error creating restaurant:', error);
    throw new Error('Failed to create restaurant');
  }
};
// Create menu item if it doesn't exist in Firebase
const createMenuItemIfNeeded = async (dishName: string, restaurantId: string, selectedMenuItem: any, fallbackCategory?: string): Promise<string> => {
  // If it's already a Firebase menu item with valid ID, return it
  if (selectedMenuItem?.id && !selectedMenuItem.id.startsWith('manual_')) {
    console.log('Using existing menu item ID:', selectedMenuItem.id);
    return selectedMenuItem.id;
  }

  try {
    // Before creating a new dish, check if one with the same name already exists for this restaurant
    console.log('Checking for existing menu item:', dishName, 'at restaurant:', restaurantId);
    const existingItemQuery = query(
      collection(db, 'menuItems'),
      where('name', '==', dishName),
      where('restaurantId', '==', restaurantId)
    );

    const existingItemSnapshot = await getDocs(existingItemQuery);

    // If a dish with this name already exists for this restaurant, return its ID
    if (!existingItemSnapshot.empty) {
      const existingItem = existingItemSnapshot.docs[0];
      console.log('✅ Found existing menu item with ID:', existingItem.id);
      return existingItem.id;
    }

    // Only create a new dish if none exists
    console.log('Creating new menu item:', dishName, 'for restaurant:', restaurantId);
    const newMenuItem = {
      name: dishName,
      category: selectedMenuItem?.category || fallbackCategory || 'Custom',
      price: selectedMenuItem?.price || null,
      description: selectedMenuItem?.description || '',
      restaurantId: restaurantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'menuItems'), newMenuItem);
    console.log('✅ Created new menu item with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating menu item:', error);
    throw new Error('Failed to create menu item');
  }
};


// Fetch menu item category helper for downstream scoring/facet logic
export const getMenuItemCategory = async (menuItemId: string): Promise<string | null> => {
  if (!menuItemId) {
    return null;
  }

  try {
    const menuItemRef = doc(db, 'menuItems', menuItemId);
    const snapshot = await getDoc(menuItemRef);
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as { category?: string } | undefined;
    const rawCategory = typeof data?.category === 'string' ? data.category : undefined;
    const normalized = rawCategory ? normalizeToken(rawCategory) : '';
    return normalized || null;
  } catch (error) {
    console.warn('Failed to fetch menu item category', { menuItemId, error });
    return null;
  }
};



// Save review to Firestore with automatic restaurant/dish creation
export const saveReview = async (
  reviewData: ReviewData, 
  selectedRestaurant: any, 
  selectedMenuItem: any
): Promise<string> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be authenticated to save reviews');
    }

    console.log('🔄 Starting review save process...');
    console.log('Restaurant data:', selectedRestaurant);
    console.log('Menu item data:', selectedMenuItem);

    // Step 1: Create restaurant if it doesn't exist
    const restaurantId = await createRestaurantIfNeeded(selectedRestaurant);
    
    // Step 2: Create menu item if it doesn't exist  
    const menuItemId = await createMenuItemIfNeeded(reviewData.dish, restaurantId, selectedMenuItem, (reviewData as any)?.dishCategory);

    const menuItemRef = doc(db, 'menuItems', menuItemId);
    const restaurantDocRef = doc(db, 'restaurants', restaurantId);

    const cuisineSources = Array.isArray(reviewData.cuisines)
      ? reviewData.cuisines
      : Array.isArray(reviewData.restaurantCuisines)
        ? reviewData.restaurantCuisines
        : [];

    const normalizedUserCuisines = cuisineSources
      .map((entry) => normalizeToken(entry))
      .filter((entry): entry is string => Boolean(entry));

    const cuisinesForReview = normalizedUserCuisines.length
      ? Array.from(new Set(normalizedUserCuisines))
      : undefined;

    let cuisinesForRestaurantDoc: string[] | undefined;

    try {
      const restaurantSnapshot = await getDoc(restaurantDocRef);
      const existingRestaurantCuisinesRaw = restaurantSnapshot.exists() && Array.isArray(restaurantSnapshot.data()?.cuisines)
        ? (restaurantSnapshot.data()?.cuisines as string[])
        : [];
      const normalizedExisting = existingRestaurantCuisinesRaw
        .map((entry) => normalizeToken(entry))
        .filter((entry): entry is string => Boolean(entry));
      const existingUnique = Array.from(new Set(normalizedExisting));
      const existingAlreadyNormalized =
        existingRestaurantCuisinesRaw.length === existingUnique.length &&
        existingRestaurantCuisinesRaw.every((value, index) => value === existingUnique[index]);

      const cuisineSetForRestaurant = new Set(existingUnique);
      normalizedUserCuisines.forEach((value) => cuisineSetForRestaurant.add(value));
      const mergedRestaurantCuisines = Array.from(cuisineSetForRestaurant);
      const hasNewCuisine = normalizedUserCuisines.some((value) => !existingUnique.includes(value));
      const shouldUpdateRestaurantCuisines =
        mergedRestaurantCuisines.length > 0 && (!existingAlreadyNormalized || hasNewCuisine);

      if (shouldUpdateRestaurantCuisines) {
        cuisinesForRestaurantDoc = mergedRestaurantCuisines;
      }
    } catch (error) {
      console.warn('Failed to inspect restaurant cuisines', { restaurantId, error });
    }

    const facetSourceParts = [
      reviewData.dish,
      selectedRestaurant?.name,
      reviewData.personalNote,
      reviewData.negativeNote,
      ...(reviewData.tags || [])
    ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);

    const combinedFacetText = facetSourceParts.join(' ');
    const inferredFacets = inferFacetsFromText(combinedFacetText);

    const cuisineSet = new Set<string>([...inferredFacets.cuisines, ...normalizedUserCuisines]);
    const mergedCuisines = Array.from(cuisineSet);

    const searchTokens = tokenizeForSearch(
      reviewData.dish,
      selectedRestaurant?.name,
      ...(reviewData.tags || []),
      ...inferredFacets.dishTypes,
      ...mergedCuisines,
      ...inferredFacets.attributes,
      reviewData.personalNote,
      reviewData.negativeNote
    ).filter((token) => token && token.trim().length > 0);

    const menuItemUpdates: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (inferredFacets.dishTypes.length) {
      menuItemUpdates['facets.dishTypes'] = arrayUnion(...inferredFacets.dishTypes);
    }

    if (mergedCuisines.length) {
      menuItemUpdates['facets.cuisines'] = arrayUnion(...mergedCuisines);
    }

    if (inferredFacets.attributes.length) {
      menuItemUpdates['facets.attributes'] = arrayUnion(...inferredFacets.attributes);
    }

    if (searchTokens.length) {
      menuItemUpdates.searchTokens = arrayUnion(...searchTokens);
    }

    try {
      await updateDoc(menuItemRef, menuItemUpdates);
    } catch (error) {
      console.warn('Failed to update menu item facets', { menuItemId, error });

    }

    // Step 3: Create review document with proper linking
    console.log('dY", Saving review with links - restaurantId:', restaurantId, 'menuItemId:', menuItemId);
    const {
      restaurantCuisines: _ignoredRestaurantCuisines,
      cuisines: _ignoredCuisines,
      visitCaption,
      visitMedia,
      ...reviewDataRest
    } = reviewData as any;
    const normalizedVisitCaption =
      typeof visitCaption === 'string' && visitCaption.trim().length
        ? visitCaption.trim()
        : undefined;
    const normalizedVisitMedia = Array.isArray(visitMedia)
      ? visitMedia.filter((url) => typeof url === 'string' && url.trim().length)
      : undefined;

    const nowMs = Date.now();
    const reviewDocumentPayload: Record<string, any> = {
      ...reviewDataRest,
      ...(normalizedVisitCaption ? { visitCaption: normalizedVisitCaption } : {}),
      ...(normalizedVisitMedia && normalizedVisitMedia.length ? { visitMedia: normalizedVisitMedia } : {}),
      explicit: reviewData.explicit ?? null,
      sentiment: reviewData.sentiment ?? null,
      explicitTags: Array.isArray(reviewData.explicitTags) ? reviewData.explicitTags : [],
      derivedTags: Array.isArray(reviewData.derivedTags) ? reviewData.derivedTags : [],
      tags: Array.isArray(reviewData.tags) ? reviewData.tags : [],
      restaurantId,
      menuItemId,
      // Add dishName to satisfy Firestore rules which require dishName (string)
      dishName: (reviewDataRest as any).dish || (reviewDataRest as any).dishName || 'Unknown Dish',
      userId: currentUser.uid,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdAtMs: nowMs,
      updatedAt: serverTimestamp(),
      visibility: 'public',
      triedTimes: 1,
      visitedTimes: 1,
      rewardReason: "First review bonus",
      pointsEarned: 20,
      verification: { state: 'unverified' },
      isDeleted: false
    };

    if (cuisinesForReview && cuisinesForReview.length) {
      reviewDocumentPayload.restaurantCuisines = cuisinesForReview;
      reviewDocumentPayload.cuisines = cuisinesForReview;
    }

    // Remove any undefined values to prevent Firestore validation errors
    Object.keys(reviewDocumentPayload).forEach(key => {
      if (reviewDocumentPayload[key] === undefined) {
        delete reviewDocumentPayload[key];
      }
    });

    const docRef = await addDoc(collection(db, 'reviews'), reviewDocumentPayload);
    
    console.log('✅ Review saved successfully with ID:', docRef.id);
    console.log('✅ Linked to restaurant:', restaurantId, 'and menu item:', menuItemId);
    
    // Step 3.5: If this menu item has no cover image yet and this review has photos,
    // set the dish's cover image to the first user photo.
    try {
      const menuDoc = await getDoc(menuItemRef);
      const hasCover = menuDoc.exists() && typeof (menuDoc.data() as any)?.coverImage === 'string' && (menuDoc.data() as any).coverImage;
      // Attempt to read images from either new media.photos[] or legacy images[] on the payload
      const uploadedPhotos: string[] = (() => {
        const mediaPhotos = Array.isArray((reviewDocumentPayload as any)?.media?.photos)
          ? (reviewDocumentPayload as any).media.photos
          : [];
        const legacyImages = Array.isArray((reviewDocumentPayload as any)?.images)
          ? (reviewDocumentPayload as any).images
          : [];
        return mediaPhotos.length > 0 ? mediaPhotos : legacyImages;
      })();
      if (!hasCover && uploadedPhotos.length > 0) {
        await updateDoc(menuItemRef, {
          coverImage: uploadedPhotos[0],
          updatedAt: serverTimestamp(),
        });
        console.log('🖼️ Set menu item cover image from first user photo');
      }
    } catch (err) {
      console.warn('⚠️ Failed to set menu item cover image (non-critical):', err);
    }
    
    // Step 4: Update user stats after saving review
    try {
      const currentStats = await getUserProfile();
      if (currentStats.success && currentStats.profile) {
        const newTotalPoints = (currentStats.profile.stats?.pointsEarned || 0) + 20;
        const newTotalReviews = (currentStats.profile.stats?.totalReviews || 0) + 1;
        
        await updateUserStats({
          pointsEarned: newTotalPoints,
          totalReviews: newTotalReviews
        });
        
        console.log('✅ User stats updated:', { pointsEarned: newTotalPoints, totalReviews: newTotalReviews });
      }
    } catch (error) {
      console.warn('⚠️ Failed to update user stats (non-critical):', error);
    }
    
    // Step 5: Recalculate and update restaurant quality score
    try {
      console.log('🔄 Recalculating restaurant quality score...');
      
      // Fetch all reviews for this restaurant
      const restaurantReviewsQuery = query(
        collection(db, 'reviews'), 
        where('restaurantId', '==', restaurantId)
      );
      const restaurantReviewsSnapshot = await getDocs(restaurantReviewsQuery);
      const restaurantReviews = restaurantReviewsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as FirebaseReview))
        .filter((review) => review.isDeleted !== true);

      const menuItemIds = Array.from(
        new Set(
          restaurantReviews
            .map((review) => review.menuItemId)
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        )
      );

      const categoryMap = new Map<string, string>();
      await Promise.all(
        menuItemIds.map(async (id) => {
          const category = await getMenuItemCategory(id);
          if (category) {
            categoryMap.set(id, category);
          }
        })
      );

      const reviewsWithCategory: ReviewWithCategory[] = restaurantReviews.map((review) => ({
        ...review,
        category: review.menuItemId ? categoryMap.get(review.menuItemId) ?? 'custom' : 'custom'
      }));

      const newQualityScore = calculateRestaurantQualityScore(reviewsWithCategory);
      
      // Update the restaurant document with the new quality score
      const restaurantUpdatePayload: Record<string, any> = {
        qualityScore: newQualityScore,
        updatedAt: serverTimestamp()
      };

      if (cuisinesForRestaurantDoc && cuisinesForRestaurantDoc.length) {
        restaurantUpdatePayload.cuisines = cuisinesForRestaurantDoc;
      }

      // Calculate and update modal price level from user reviews
      const modalPriceLevel = calculateModalPriceLevel(restaurantReviews);
      if (modalPriceLevel !== null) {
        restaurantUpdatePayload.priceLevel = modalPriceLevel;
      }

      await updateDoc(restaurantDocRef, restaurantUpdatePayload);
      console.log('✅ Restaurant quality score updated:', newQualityScore);
    } catch (error) {
      console.warn('⚠️ Failed to update restaurant quality score (non-critical):', error);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Error saving review:', error);
    throw error;
  }
};

// Convert File objects to upload and get URLs
export const processAndUploadImages = async (imageFiles: File[]): Promise<string[]> => {
  if (imageFiles.length === 0) return [];
  
  try {
    const photoUrls = await uploadMultiplePhotos(imageFiles);
    return photoUrls;
  } catch (error) {
    console.error('Error processing images:', error);
    throw error;
  }
};

// Firebase review interface (what comes from Firestore)
export interface FirebaseReview {
  id: string;
  visitId?: string; // NEW: Shared visit ID
  userId?: string; // Author's user ID
  restaurantId?: string | null; // Firebase restaurant ID for linking
  menuItemId?: string | null; // Firebase menu item ID for linking
  restaurant: string;
  location: string;
  dish: string;
  rating: number;
  personalNote: string;
  visitCaption?: string;
  visitMedia?: string[]; // NEW: Unassigned/"vibes" photos from the visit
  negativeNote: string;
  personalNotes?: PersonalNote[];
  serverRating?: 'bad' | 'okay' | 'good' | null;
  price?: string | null;
  restaurantPriceLevel?: '$' | '$$' | '$$$' | '$$$$' | null;
  explicit?: ExplicitSelection | null;
  sentiment?: SentimentSelection | null;
  explicitTags?: string[];
  derivedTags?: string[];
  tags: string[];
  restaurantCuisines?: string[];
  cuisines?: string[];
  images: string[];
  isPublic: boolean;
  timestamp: any; // Firestore timestamp
  createdAt: any; // Firestore Timestamp or ISO string (legacy)
  createdAtMs?: number; // Optimistic fallback for ordering
  triedTimes: number;
  visitedTimes: number;
  rewardReason: string;
  pointsEarned: number;
}

// Extended review interface with category for quality scoring
export interface ReviewWithCategory extends FirebaseReview {
  category?: string;
}

// NEW: Interface for user's visited restaurants
export interface UserVisitedRestaurant {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  cuisine: string;
  visitCount: number;
  lastVisit: string;
  totalReviews: number;
  averageRating: number;
}

// NEW: Get restaurants the user has visited
export const getUserVisitedRestaurants = async (): Promise<UserVisitedRestaurant[]> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.log('No authenticated user found for visited restaurants');
      return [];
    }

    console.log('🗺️ Fetching user visited restaurants...');

    // Get all user's reviews
    const userReviews = await fetchUserReviews(200); // Get more reviews for complete data
    
    if (userReviews.length === 0) {
      console.log('👤 User has no reviews yet');
      return [];
    }

    // Group reviews by restaurant
    const restaurantGroups = new Map<string, FirebaseReview[]>();
    
    userReviews.forEach(review => {
      const restaurantKey = review.restaurantId || review.restaurant;
      if (!restaurantGroups.has(restaurantKey)) {
        restaurantGroups.set(restaurantKey, []);
      }
      restaurantGroups.get(restaurantKey)!.push(review);
    });

    console.log(`🏪 User has visited ${restaurantGroups.size} unique restaurants`);

    // Convert to UserVisitedRestaurant format
    const visitedRestaurants: UserVisitedRestaurant[] = [];

    for (const [restaurantKey, reviews] of restaurantGroups) {
      const firstReview = reviews[0];
      let restaurantData: any = null;

      // Try to get restaurant data from Firebase if we have an ID
      if (firstReview.restaurantId) {
        try {
          const restaurantDoc = await getDoc(doc(db, 'restaurants', firstReview.restaurantId));
          if (restaurantDoc.exists()) {
            restaurantData = { id: restaurantDoc.id, ...restaurantDoc.data() };
          }
        } catch (error) {
          console.warn(`⚠️ Could not fetch restaurant data for ID ${firstReview.restaurantId}:`, error);
        }
      }

      // Calculate stats from user's reviews at this restaurant
      const visitCount = reviews.length;
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / visitCount;
      const lastVisitReview = reviews.sort((a, b) =>
        new Date(safeToISOString(b.createdAt)).getTime() - new Date(safeToISOString(a.createdAt)).getTime()
      )[0];
      const lastVisit = safeToISOString(lastVisitReview.createdAt);

      // Create visited restaurant object
      const visitedRestaurant: UserVisitedRestaurant = {
        id: firstReview.restaurantId || `manual_${restaurantKey}`,
        name: restaurantData?.name || firstReview.restaurant,
        location: {
          lat: parseFloat(restaurantData?.coordinates?.lat) || 27.3364, // Default to Sarasota center
          lng: parseFloat(restaurantData?.coordinates?.lng) || -82.5307
        },
        cuisine: restaurantData?.cuisine || 'Restaurant',
        visitCount,
        lastVisit,
        totalReviews: visitCount,
        averageRating: Math.round(averageRating * 10) / 10 // Round to 1 decimal
      };

      visitedRestaurants.push(visitedRestaurant);
    }

    // Sort by last visit date (most recent first)
    visitedRestaurants.sort((a, b) => 
      new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
    );

    console.log(`✅ Processed ${visitedRestaurants.length} visited restaurants for user journey map`);
    return visitedRestaurants;

  } catch (error) {
    console.error('❌ Error fetching user visited restaurants:', error);
    return [];
  }
};

// NEW: Get user's reviews for a specific restaurant
export const getUserRestaurantReviews = async (restaurantId: string): Promise<FirebaseReview[]> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.log('No authenticated user found for restaurant reviews');
      return [];
    }

    console.log(`🍽️ Fetching user reviews for restaurant: ${restaurantId}`);

    // Query user's reviews for this specific restaurant
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('userId', '==', currentUser.uid),
      where('restaurantId', '==', restaurantId),
      orderBy('createdAt', 'desc')
    );

    const reviewsSnapshot = await getDocs(reviewsQuery);
    const reviews: FirebaseReview[] = [];

    reviewsSnapshot.forEach((doc) => {
      const data = doc.data();
      reviews.push({
        id: doc.id,
        ...data
      } as FirebaseReview);
    });

    console.log(`✅ Found ${reviews.length} user reviews for restaurant ${restaurantId}`);
    return reviews;

  } catch (error) {
    console.error(`❌ Error fetching user restaurant reviews for ${restaurantId}:`, error);
    
    // Fallback: try to get reviews by restaurant name if ID query fails
    try {
      console.log('🔄 Trying fallback query by restaurant name...');
      
      const userReviews = await fetchUserReviews(100);
      const restaurantReviews = userReviews.filter(review => 
        review.restaurantId === restaurantId || review.restaurant.includes(restaurantId)
      );
      
      console.log(`✅ Fallback found ${restaurantReviews.length} reviews`);
      return restaurantReviews;
      
    } catch (fallbackError) {
      console.error('❌ Fallback query also failed:', fallbackError);
      return [];
    }
  }
};

// Calculate restaurant quality score from reviews
export const calculateRestaurantQualityScore = (reviews: ReviewWithCategory[]): number | null => {
  if (!reviews.length) {
    return null;
  }

  const ratings = reviews
    .map((review) => review.rating)
    .filter((rating) => typeof rating === 'number' && Number.isFinite(rating));

  if (!ratings.length) {
    return null;
  }

  const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  const variance = ratings.reduce((sum, rating) => sum + Math.pow(rating - mean, 2), 0) / ratings.length;
  const standardDeviation = Math.sqrt(variance);

  const filteredReviews = reviews.filter((review) => Math.abs(review.rating - mean) <= 2 * standardDeviation);

  if (filteredReviews.length < Math.min(5, reviews.length * 0.5)) {
    filteredReviews.splice(0, filteredReviews.length, ...reviews);
  }

  let totalWeight = 0;
  let weightedSum = 0;

  filteredReviews.forEach((review) => {
    const categoryKey = review.category?.toLowerCase() || 'custom';
    const weight = CATEGORY_WEIGHTS[categoryKey] ?? 0.8;

    totalWeight += weight;
    weightedSum += review.rating * weight;
  });

  const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : mean;
  const consistencyPenalty = Math.min(0.2, variance / 10);
  const adjustedAverage = weightedAverage * (1 - consistencyPenalty);

  if (!Number.isFinite(adjustedAverage)) {
    return null;
  }

  const qualityPercentage = Math.round((adjustedAverage / 10) * 100);
  return Math.max(0, Math.min(100, qualityPercentage));
};

/**
 * Calculate modal (most common) price level from user reviews
 * @param reviews Array of reviews with restaurantPriceLevel
 * @returns Number 1-4 representing modal price, or null if no data
 */
export const calculateModalPriceLevel = (reviews: any[]): number | null => {
  // Filter reviews that have price data
  const pricesWithData = reviews
    .map(r => r.restaurantPriceLevel)
    .filter(p => p && typeof p === 'string');

  if (pricesWithData.length === 0) return null;

  // Convert strings to numbers: '$' -> 1, '$$' -> 2, '$$$' -> 3, '$$$$' -> 4
  const priceNumbers = pricesWithData.map(p => p.length);

  // Count frequency of each price level
  const frequencyMap: Record<number, number> = {};
  priceNumbers.forEach(price => {
    frequencyMap[price] = (frequencyMap[price] || 0) + 1;
  });

  // Find modal (most frequent) price level
  let modalPrice = null;
  let maxFrequency = 0;

  Object.entries(frequencyMap).forEach(([price, frequency]) => {
    if (frequency > maxFrequency) {
      maxFrequency = frequency;
      modalPrice = parseInt(price);
    }
  });

  return modalPrice;
};

// In-memory cache for restaurant docs to avoid repeated reads per session
const restaurantDocCache = new Map<string, { name: string; qualityScore?: number }>();

// Normalize Firestore boolean-ish fields (true/"true") and provide a unified client-side guard
const asTrue = (v: any): boolean => v === true || v === 'true';
const safeReview = (r: any): boolean => r && asTrue(r?.isDeleted) !== true && r?.visibility !== 'private';

// Helper function to fetch restaurant data by ID (name + optional precomputed qualityScore)
const getRestaurantById = async (restaurantId: string | null | undefined): Promise<{ name: string; qualityScore?: number } | null> => {
  if (!restaurantId) {
    return null;
  }

  try {
    if (restaurantDocCache.has(restaurantId)) {
      return restaurantDocCache.get(restaurantId)!;
    }

    const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
    if (restaurantDoc.exists()) {
      const data = restaurantDoc.data();
      const payload = {
        name: data.name || 'Unknown Restaurant',
        qualityScore: typeof data.qualityScore === 'number' ? data.qualityScore : undefined
      } as { name: string; qualityScore?: number };
      restaurantDocCache.set(restaurantId, payload);
      return payload;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch restaurant data:', restaurantId, error);
    return null;
  }
};

// Helper function to get restaurant quality score for feed posts
const getRestaurantQualityScore = async (restaurantId: string | null | undefined): Promise<number | null> => {
  if (!restaurantId) {
    return null;
  }

  try {
    // Fetch all reviews for this restaurant
    const reviewsQuery = query(
      collection(db, 'reviews'), 
      where('restaurantId', '==', restaurantId)
    );
    const reviewsSnapshot = await getDocs(reviewsQuery);
    const restaurantReviews = reviewsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as FirebaseReview))
      .filter((review) => review.isDeleted !== true);

    const menuItemIds = Array.from(
      new Set(
        restaurantReviews
          .map((review) => review.menuItemId)
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      )
    );

    const categoryMap = new Map<string, string>();
    await Promise.all(
      menuItemIds.map(async (id) => {
        const category = await getMenuItemCategory(id);
        if (category) {
          categoryMap.set(id, category);
        }
      })
    );

    const reviewsWithCategory: ReviewWithCategory[] = restaurantReviews.map((review) => ({
      ...review,
      category: review.menuItemId ? categoryMap.get(review.menuItemId) ?? 'custom' : 'custom'
    }));

    return calculateRestaurantQualityScore(reviewsWithCategory);
  } catch (error) {
    console.error('Error fetching restaurant reviews for quality score:', error);
    return null;
  }
};

// Fetch reviews from Firestore
export const fetchReviews = async (limitCount = 20): Promise<FirebaseReview[]> => {
  try {
    const reviewsRef = collection(db, 'reviews');
    // Fetch more than needed and filter client-side to exclude malformed docs
    const q = query(
      reviewsRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount * 3) // Fetch 3x to account for filtering
    );

    const querySnapshot = await getDocs(q);
    const raw = querySnapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Filter out malformed documents
    const validDocs = raw.filter((doc: any) => {
      // Exclude docs that look like Firebase metadata
      if (doc._methodName || !doc.dish && !doc.dishName || !doc.userId) {
        return false;
      }
      return true;
    });

    const droppedDeleted = validDocs.filter((r: any) => asTrue(r?.isDeleted) === true).length;
    const droppedPrivate = validDocs.filter((r: any) => r?.visibility === 'private').length;
    const items = validDocs.filter((r) => safeReview(r)).slice(0, limitCount); // Take requested count after filtering

    const sample = items.slice(0, 3).map((r: any) => ({ id: r.id, isDeleted: r.isDeleted, visibility: r.visibility, dishName: r.dish || r.dishName }));
    console.log(`Initial fetch snapshot: total=${raw.length}, valid=${validDocs.length}, dropped(deleted=${droppedDeleted}, private=${droppedPrivate}), emitted=${items.length}, sample=`, sample);

    const reviews: FirebaseReview[] = items.map((data: any) => {
      const mappedData = {
        ...data,
        images: data.media?.photos && Array.isArray(data.media.photos) && data.media.photos.length > 0
          ? data.media.photos.map((photoPath: string) => photoPath)
          : data.images || []
      };

      return {
        id: data.id,
        ...mappedData,
        restaurantId: data.restaurantId || null,
        menuItemId: data.menuItemId || null,
        dish: data.dish || data.dishName || 'Unknown Dish',
        restaurant: data.restaurant || data.restaurantName || 'Unknown Restaurant'
      } as FirebaseReview;
    });

    console.log(`Fetched reviews from Firestore (post-filter): ${reviews.length}`);
    return reviews;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    throw new Error('Failed to fetch reviews');
  }
};

// Fetch current user's reviews from Firestore
export const fetchUserReviews = async (limitCount = 50): Promise<FirebaseReview[]> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.log('No authenticated user found, returning empty reviews array');
      return [];
    }

    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const reviews: FirebaseReview[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.isDeleted === true) {
        return;
      }

      // Map new media structure to old images array for backward compatibility
      const mappedData = {
        ...data,
        images: data.media?.photos && Array.isArray(data.media.photos) && data.media.photos.length > 0
          ? data.media.photos.map((photoPath: string) => {
              // Convert storage path to download URL if needed
              if (photoPath.startsWith('gs://')) {
                return photoPath; // Already a storage path, will be converted later
              }
              return photoPath; // Assume it's already a download URL
            })
          : data.images || [] // Fallback to old images field if it exists
      };

      reviews.push({
        id: doc.id,
        ...mappedData,
        restaurantId: data.restaurantId || null, // Explicitly map restaurantId (after spread to override)
        menuItemId: data.menuItemId || null, // Explicitly map menuItemId (after spread to override)
        dish: data.dish || data.dishName || 'Unknown Dish', // Map dishName to dish (after spread to override)
        restaurant: data.restaurant || data.restaurantName || 'Unknown Restaurant' // Map restaurantName to restaurant (after spread to override)
      } as FirebaseReview);
    });

    if (reviews.length === 0) {
      console.log('No reviews found for current user - this is normal for new users');
    } else {
      console.log('Successfully fetched ' + reviews.length + ' user reviews from Firestore');
    }
    return reviews;
  } catch (error: any) {
    console.error('Error fetching user reviews:', error);
    
    // Handle specific Firebase error types
    if (error?.code === 'permission-denied') {
      console.warn('Permission denied when fetching user reviews. User may not have proper access.');
      return [];
    }
    
    if (error?.code === 'unavailable') {
      console.warn('Firestore service unavailable. Returning empty array.');
      return [];
    }
    
    if (error?.code === 'failed-precondition') {
      console.warn('Firestore query failed precondition (may need index). Returning empty array.');
      return [];
    }
    
    // Handle network and connection errors
    if (error?.message?.includes('network') || error?.message?.includes('offline')) {
      console.warn('Network/offline error when fetching reviews. Returning empty array.');
      return [];
    }
    
    // Handle quota exceeded errors
    if (error?.code === 'resource-exhausted') {
      console.warn('Firestore quota exceeded. Returning empty array.');
      return [];
    }
    
    // Handle invalid user authentication
    if (error?.code === 'unauthenticated') {
      console.warn('User authentication invalid. Returning empty array.');
      return [];
    }
    
    // For any other errors, log and return empty array instead of throwing
    // This ensures new users or users with no reviews don't break the app
    console.warn('Unknown error fetching user reviews, returning empty array:', error?.message || error);
    return [];
  }
};

// Feed post author interface - UPDATED with id field for follow system
interface FeedPostAuthor {
  id: string; // NEW: User ID for follow functionality
  name: string;
  username: string;
  image: string;
  isVerified: boolean;
}

export type FeedMediaItemKind = 'dish' | 'visit';

export interface FeedMediaItem {
  id: string;
  imageUrl: string;
  kind: FeedMediaItemKind;
  reviewId?: string;
  dishName?: string;
  rating?: number;
}

export interface VisitDish {
  id: string;            // review doc ID (same as carouselItem.id)
  name: string;          // dish name
  rating: number;        // per-dish rating
  dishCategory?: string; // appetizer/entree/dessert/etc.
  wizardOrder: number;   // original index in the reviews array
  dishId?: string;       // NEW: menuItemId for navigation
  restaurantId?: string; // NEW: restaurant ID for context
}

// Cache for user profiles to avoid redundant fetches
const userProfileCache = new Map<string, FeedPostAuthor>();

// Group reviews by visitId or individual reviews
const groupReviewsByVisit = (reviews: FirebaseReview[]) => {
  const visitGroups = new Map<string, FirebaseReview[]>();
  const individualReviews: FirebaseReview[] = [];

  reviews.forEach(review => {
    if (review.visitId) {
      if (!visitGroups.has(review.visitId)) {
        visitGroups.set(review.visitId, []);
      }
      visitGroups.get(review.visitId)!.push(review);
    } else {
      individualReviews.push(review);
    }
  });

  return { visitGroups, individualReviews };
};

// Convert a group of reviews (visit) to a carousel feed post
export const convertVisitToCarouselFeedPost = async (reviews: FirebaseReview[]) => {
  if (reviews.length === 0) return null;

  // Sort reviews by rating (highest first) for main image selection
  const sortedReviews = [...reviews].sort((a, b) => b.rating - a.rating);
  const mainReview = sortedReviews[0]; // Highest rated dish as main

  // Derive visit-level caption and tags from the group
  const visitCaption =
    reviews
      .map((r) => (r as any).visitCaption)
      .find((value) => typeof value === 'string' && value.trim().length) || undefined;
  const visitTags = Array.isArray(mainReview.tags) && mainReview.tags.length
    ? mainReview.tags
    : undefined;

  // Fetch lightweight restaurant data (use precomputed qualityScore if present)
  const restaurantData = await getRestaurantById(mainReview.restaurantId);
  
  // Get author info from main review - UPDATED with id field
  let author: FeedPostAuthor = {
    id: mainReview.userId || "anonymous", // NEW: Use actual userId as fallback
    name: mainReview.userId || "Anonymous User",
    username: mainReview.userId || "anonymous",
    image: getAvatarUrl({ username: mainReview.userId || "anonymous" }),
    isVerified: false
  };

  if (mainReview.userId) {
    try {
      if (userProfileCache.has(mainReview.userId)) {
        author = userProfileCache.get(mainReview.userId)!;
      } else {
        const userProfileResult = await getUserProfile(mainReview.userId);
        if (userProfileResult.success && userProfileResult.profile) {
          const profile = userProfileResult.profile;
          author = {
            id: mainReview.userId, // NEW: Include actual userId
            name: profile.displayName || profile.username,
            username: profile.username,
            image: getAvatarUrl(profile),
            isVerified: profile.isVerified || false
          };
          userProfileCache.set(mainReview.userId, author);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user profile for visit:', mainReview.visitId, error);
    }
  }

  // Calculate average rating for the visit
  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  const visitAverageRating = parseFloat(averageRating.toFixed(1));

  // Extract tags from main review for the carousel post summary
  const { tasteChips: mainTasteChips, audienceTags: mainAudienceTags } = extractReviewTags(mainReview);

  // Build visitDishes array with proper sorting
  const visitDishes: VisitDish[] = reviews
    .map((review, wizardOrder) => ({
      id: review.id,
      name: review.dish,
      rating: review.rating,
      dishCategory: (review as any).dishCategory,
      wizardOrder,
      dishId: review.menuItemId,           // NEW: menuItemId for navigation
      restaurantId: mainReview.restaurantId // NEW: restaurant ID for context
    }))
    // Sort by rating DESC, then wizardOrder ASC
    .sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating; // Higher rating first
      }
      return a.wizardOrder - b.wizardOrder; // Preserve wizard order as tiebreaker
    });

  // Create carousel data for all dishes in the visit (preserve original order from wizard)
  const carouselItems = reviews.map(review => {
    const { tasteChips, audienceTags } = extractReviewTags(review);
    const imgs = getReviewImages(review);
    return {
      id: review.id,
      dishId: review.menuItemId,
      dish: {
        name: review.dish,
        image: imgs && imgs.length > 0 ? imgs[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish)}`,
        rating: review.rating,
        visitCount: review.visitedTimes
      },
      review: {
        date: safeToISOString(review.createdAt),
        createdAt: review.createdAt,
        createdAtMs: review.createdAtMs,
        caption: (review as any).caption || undefined,
        visitCaption: (review as any).visitCaption || undefined,
        tasteChips: tasteChips.length > 0 ? tasteChips : undefined,
        audienceTags: audienceTags.length > 0 ? audienceTags : undefined
      },
      tags: review.tags,
      price: review.price,
      personalNotes: review.personalNotes || []
    };
  });

  // Build richer media items: explicit visit-level images first, then per-dish images
  const visitMediaItems: FeedMediaItem[] = [];
  const visitMediaUrls = new Set<string>();

  // Step 1: Collect explicit visit-level media from visitMedia field
  reviews.forEach((review) => {
    if (Array.isArray(review.visitMedia)) {
      review.visitMedia.forEach((url) => {
        if (typeof url === 'string' && url.trim().length && !visitMediaUrls.has(url)) {
          visitMediaUrls.add(url);
          visitMediaItems.push({
            id: `visit-${visitMediaItems.length}`,
            imageUrl: url,
            kind: 'visit',
            // No reviewId needed for pure visit images
          });
        }
      });
    }
  });

  // Step 2: Build dish media items in original review order (preserve wizard order)
  const dishMediaItems: FeedMediaItem[] = [];
  reviews.forEach((review) => {
    const imgs = getReviewImages(review);
    if (!imgs.length) return;
    // Ensure the first image is valid (getReviewImages already filters, but be defensive)
    const firstImage = imgs[0];
    if (typeof firstImage === 'string' && firstImage.trim().length > 0) {
      dishMediaItems.push({
        id: `dish-${review.id}`,
        imageUrl: firstImage,
        kind: 'dish',
        reviewId: review.id,
        dishName: review.dish,
        rating: review.rating,
      });
    }
  });

  // Step 3: Fallback when no visitMedia photos exist
  if (visitMediaItems.length === 0) {
    const fallbackSource = reviews.find((r) => getReviewImages(r).length > 0) || mainReview;
    const fallbackImages = getReviewImages(fallbackSource);
    if (fallbackImages.length > 0) {
      const fallbackUrl = fallbackImages[0];
      // Ensure fallback URL is valid before adding
      if (typeof fallbackUrl === 'string' && fallbackUrl.trim().length > 0) {
        visitMediaItems.push({
          id: `visit-fallback-${fallbackSource.id}`,
          imageUrl: fallbackUrl,
          kind: 'visit',
          reviewId: fallbackSource.id,
          dishName: fallbackSource.dish,
          rating: fallbackSource.rating,
        });
      }
    }
  }

  // Step 4: Combine in proper order: visit items first, then dish items
  // Final safety filter: ensure no entries with falsy/empty imageUrl sneak through
  const mediaItems: FeedMediaItem[] = [
    ...visitMediaItems,
    ...dishMediaItems,
  ].filter((item) => typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0);

  return {
    id: mainReview.visitId || mainReview.id,
    visitId: mainReview.visitId,
    userId: mainReview.userId,
    restaurantId: mainReview.restaurantId,
    dishId: mainReview.menuItemId,
    isCarousel: true, // Flag to indicate this is a carousel post
    carouselItems, // Array of all dishes in the visit
    visitCaption,
    visitTags,
    visitAverageRating, // NEW: Average rating for the entire visit
    visitDishes, // NEW: Structured list of dishes with ratings
    mediaItems,
    author, // NOW includes author.id for follow functionality
    restaurant: {
      name: restaurantData?.name || mainReview.restaurant || 'Unknown Restaurant',
      isVerified: Math.random() > 0.7,
      qualityScore: restaurantData?.qualityScore
    },
    dish: {
      name: reviews.length > 1 ? `${reviews.length} dishes` : mainReview.dish,
      image: (() => { const imgs = getReviewImages(mainReview); return imgs && imgs.length > 0 ? imgs[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(mainReview.dish)}`; })(),
      rating: visitAverageRating,
      visitCount: mainReview.visitedTimes
    },
    review: {
      date: safeToISOString(mainReview.createdAt),
      createdAt: mainReview.createdAt,
      createdAtMs: mainReview.createdAtMs,
      caption: (mainReview as any).caption || undefined,
      visitCaption: (mainReview as any).visitCaption || undefined,
      tasteChips: mainTasteChips.length > 0 ? mainTasteChips : undefined,
      audienceTags: mainAudienceTags.length > 0 ? mainAudienceTags : undefined
    },
    engagement: {
      likes: 0,
      comments: 0
    },
    location: mainReview.location,
    tags: mainReview.tags,
    price: mainReview.price
  };
};

// Helper function to safely convert Firestore Timestamp or Date to ISO string
const safeToISOString = (dateValue: any): string => {
  if (!dateValue) {
    return new Date().toISOString();
  }

  // Handle Firestore Timestamp objects FIRST
  if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    try {
      return dateValue.toDate().toISOString();
    } catch (error) {
      console.warn('Failed to convert Firestore Timestamp:', error);
      return new Date().toISOString();
    }
  }

  // Handle plain timestamp-like object: { seconds, nanoseconds }
  if (
    typeof dateValue === 'object' &&
    dateValue !== null &&
    typeof dateValue.seconds === 'number' &&
    typeof dateValue.nanoseconds === 'number'
  ) {
    try {
      const ms = dateValue.seconds * 1000 + Math.floor(dateValue.nanoseconds / 1e6);
      return new Date(ms).toISOString();
    } catch (error) {
      console.warn('Failed to convert plain timestamp object:', dateValue, error);
      return new Date().toISOString();
    }
  }

  // Handle Date object
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }

  // Handle numeric milliseconds
  if (typeof dateValue === 'number') {
    try {
      return new Date(dateValue).toISOString();
    } catch (error) {
      console.warn('Failed to parse numeric ms date:', dateValue, error);
      return new Date().toISOString();
    }
  }

  // Handle ISO string
  if (typeof dateValue === 'string') {
    try {
      return new Date(dateValue).toISOString();
    } catch (error) {
      console.warn('Failed to parse date string:', dateValue, error);
      return new Date().toISOString();
    }
  }

  // Last resort fallback
  console.warn('Unknown date format, using current time:', dateValue);
  return new Date().toISOString();
};

// Helper function to extract taste chips and audience tags from review data
const extractReviewTags = (review: any): { tasteChips: string[]; audienceTags: string[] } => {
  const tasteChips: string[] = [];
  const audienceTags: string[] = [];

  // Extract taste attributes if they exist
  if (review.taste) {
    // Value
    if (review.taste.value?.level) {
      const valueMap: Record<string, string> = {
        'overpriced': 'Overpriced',
        'fair': 'Fair value',
        'bargain': 'Bargain'
      };
      const label = valueMap[review.taste.value.level];
      if (label) tasteChips.push(label);
    }

    // Freshness
    if (review.taste.freshness?.level) {
      const freshnessMap: Record<string, string> = {
        'not_fresh': 'Not fresh',
        'just_right': 'Fresh',
        'very_fresh': 'Very fresh'
      };
      const label = freshnessMap[review.taste.freshness.level];
      if (label) tasteChips.push(label);
    }

    // Saltiness (optional)
    if (review.taste.saltiness?.level) {
      const saltinessMap: Record<string, string> = {
        'needs_more_salt': 'Needs more salt',
        'balanced': 'Balanced',
        'too_salty': 'Too salty'
      };
      const label = saltinessMap[review.taste.saltiness.level];
      if (label) tasteChips.push(label);
    }
  }

  // Extract audience tags if they exist
  if (review.outcome?.audience && Array.isArray(review.outcome.audience)) {
    const audienceMap: Record<string, string> = {
      'spicy_lovers': 'Spicy lovers',
      'date_night': 'Date night',
      'family': 'Family meal',
      'quick_bite': 'Quick bite',
      'solo': 'Solo treat',
      'group': 'Group hang'
    };

    review.outcome.audience.forEach((tag: string) => {
      const label = audienceMap[tag];
      if (label) audienceTags.push(label);
    });
  }

  return { tasteChips, audienceTags };
};

// Helper: get review images from either legacy images[] or new media.photos[]
const getReviewImages = (review: any): string[] => {
  try {
    const photos = Array.isArray(review?.media?.photos) ? review.media.photos : [];
    const images = Array.isArray(review?.images) ? review.images : [];

    // Prefer photos, but ensure all returned URLs are valid non-empty strings
    const candidateUrls = photos.length > 0 ? photos : images;
    return candidateUrls.filter((url): url is string =>
      typeof url === 'string' && url.trim().length > 0
    );
  } catch {
    const fallbackUrls = Array.isArray(review?.images) ? review.images : [];
    return fallbackUrls.filter((url): url is string =>
      typeof url === 'string' && url.trim().length > 0
    );
  }
};

// Convert single review to feed post (for non-visit reviews) - UPDATED with author.id
export const convertReviewToFeedPost = async (review: FirebaseReview) => {
  // Debug logging for restaurantId and dish info
  console.log('📍 Converting review to feed post:', {
    reviewId: review.id,
    restaurantId: review.restaurantId,
    restaurantName: review.restaurant || (review as any).restaurantName || 'N/A',
    dishName: review.dish || (review as any).dishName || 'N/A',
    createdAt: review.createdAt,
    hasTimestamp: !!review.timestamp
  });

  // Fetch lightweight restaurant data (use precomputed qualityScore if present)
  const restaurantData = await getRestaurantById(review.restaurantId);

  // Extract taste and audience tags from review data
  const { tasteChips, audienceTags } = extractReviewTags(review);
  
  let author: FeedPostAuthor = {
    id: review.userId || "anonymous", // NEW: Use actual userId as fallback
    name: review.userId || "Anonymous User",
    username: review.userId || "anonymous",
    image: getAvatarUrl({ username: review.userId || "anonymous" }),
    isVerified: false
  };

  if (review.userId) {
    try {
      if (userProfileCache.has(review.userId)) {
        author = userProfileCache.get(review.userId)!;
      } else {
        const userProfileResult = await getUserProfile(review.userId);
        console.log('🔍 getUserProfile result:', userProfileResult); // ADD THIS DEBUG
        console.log('🔍 Profile data:', userProfileResult.profile); // ADD THIS DEBUG
        
        if (userProfileResult.success && userProfileResult.profile) {
          const profile = userProfileResult.profile;
          console.log('🔍 Using profile username:', profile.username); // ADD THIS DEBUG
          
          author = {
            id: review.userId, // NEW: Include actual userId
            name: profile.displayName || profile.username,
            username: profile.username,
            image: getAvatarUrl(profile),
            isVerified: profile.isVerified || false
          };
          userProfileCache.set(review.userId, author);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user profile for review:', review.id, error);
    }
  }
  
  const feedPost = {
    id: review.id,
    visitId: review.visitId,
    userId: review.userId,
    restaurantId: review.restaurantId,
    dishId: review.menuItemId,
    isCarousel: false, // Single dish post
    visitAverageRating: review.rating, // NEW: For single-dish, average = that dish's rating
    mediaItems: (() => {
      const imgs = getReviewImages(review);
      if (!imgs.length) return undefined;
      const item: FeedMediaItem = {
        id: `dish-${review.id}`,
        imageUrl: imgs[0],
        kind: 'dish',
        reviewId: review.id,
        dishName: review.dish || (review as any).dishName,
        rating: review.rating,
      };
      return [item];
    })(),
    author, // NOW includes author.id for follow functionality
    restaurant: {
      name: restaurantData?.name || review.restaurant || (review as any).restaurantName || 'Unknown Restaurant',
      isVerified: Math.random() > 0.7,
      qualityScore: restaurantData?.qualityScore
    },
    dish: {
      name: review.dish || (review as any).dishName || 'Unknown Dish',
      image: (() => { const imgs = getReviewImages(review); return imgs && imgs.length > 0 ? imgs[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish || (review as any).dishName || 'food')}`; })(),
      rating: review.rating,
      visitCount: review.visitedTimes,
      dishCategory: (review as any).dishCategory
    },
    review: {
      date: safeToISOString(review.createdAt),
      createdAt: review.createdAt,
      createdAtMs: review.createdAtMs,
      caption: (review as any).caption || undefined,
      visitCaption: (review as any).visitCaption || undefined,
      tasteChips: tasteChips.length > 0 ? tasteChips : undefined,
      audienceTags: audienceTags.length > 0 ? audienceTags : undefined,
      verification: (review as any).verification
    },
    engagement: {
      likes: 0,
      comments: 0
    },
    location: review.location,
    tags: review.tags,
    price: review.price,
    personalNotes: review.personalNotes || []
  };

  console.log('✅ [convertReviewToFeedPost] Created feed post:', {
    reviewId: review.id,
    restaurantId: feedPost.restaurantId,
    restaurantName: feedPost.restaurant.name,
    dishId: feedPost.dishId,
    dishName: feedPost.dish.name
  });

  return feedPost;
};

// Convert current user's review to feed post format (optimized for profile page) - UPDATED with author.id
export const convertUserReviewToFeedPost = async (review: FirebaseReview) => {
  const userProfileResult = await getUserProfile();

  // Fetch restaurant data
  const restaurantData = await getRestaurantById(review.restaurantId);

  // Extract taste and audience tags from review data
  const { tasteChips, audienceTags } = extractReviewTags(review);

  let author: FeedPostAuthor = {
    id: review.userId || "you", // NEW: Use actual userId or fallback
    name: "You",
    username: "you",
    image: getAvatarUrl({ username: "you" }),
    isVerified: false
  };

  if (userProfileResult.success && userProfileResult.profile) {
    const profile = userProfileResult.profile;
    author = {
      id: review.userId || getCurrentUser()?.uid || "you", // NEW: Include userId
      name: profile.displayName || profile.username,
      username: profile.username,
      image: getAvatarUrl(profile),
      isVerified: profile.isVerified || false
    };
  }

  return {
    id: review.id,
    visitId: review.visitId,
    userId: review.userId,
    restaurantId: review.restaurantId,
    dishId: review.menuItemId,
    isCarousel: false, // Profile page shows individual reviews
    mediaItems: (() => {
      const imgs = getReviewImages(review);
      if (!imgs.length) return undefined;
      const item: FeedMediaItem = {
        id: `dish-${review.id}`,
        imageUrl: imgs[0],
        kind: 'dish',
        reviewId: review.id,
        dishName: review.dish || (review as any).dishName,
        rating: review.rating,
      };
      return [item];
    })(),
    author, // NOW includes author.id for follow functionality
    restaurant: {
      name: restaurantData?.name || review.restaurant || (review as any).restaurantName || 'Unknown Restaurant',
      isVerified: false,
      qualityScore: 85
    },
    dish: {
      name: review.dish || (review as any).dishName || 'Unknown Dish',
      image: (() => { const imgs = getReviewImages(review); return imgs && imgs.length > 0 ? imgs[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish || (review as any).dishName || 'food')}`; })(),
      rating: review.rating,
      visitCount: review.visitedTimes
    },
    review: {
      date: safeToISOString(review.createdAt),
      createdAt: review.createdAt,
      createdAtMs: review.createdAtMs,
      caption: (review as any).caption || undefined,
      visitCaption: (review as any).visitCaption || undefined,
      tasteChips: tasteChips.length > 0 ? tasteChips : undefined,
      audienceTags: audienceTags.length > 0 ? audienceTags : undefined,
      verification: (review as any).verification
    },
    engagement: {
      likes: 0,
      comments: 0
    },
    location: review.location,
    tags: review.tags,
    price: review.price,
    personalNotes: review.personalNotes || []
  };
};

// Convert user's visits to carousel feed posts (for profile page)
export const convertUserVisitsToCarouselFeedPosts = async (reviews: FirebaseReview[]) => {
  try {
    console.log(`Converting ${reviews.length} user reviews to carousel feed posts...`);
    
    const { visitGroups, individualReviews } = groupReviewsByVisit(reviews);
    const feedPosts = [];

    // Convert visit groups to carousel posts
    for (const [visitId, visitReviews] of visitGroups) {
      const carouselPost = await convertVisitToCarouselFeedPost(visitReviews);
      if (carouselPost) {
        // For user's own posts, set engagement to 0 and update author
        carouselPost.engagement = { likes: 0, comments: 0 };
        const currentUser = getCurrentUser();
        carouselPost.author = {
          id: currentUser?.uid || "you", // NEW: Include actual user ID
          name: "You",
          username: "you",
          image: carouselPost.author.image,
          isVerified: false
        };
        feedPosts.push(carouselPost);
      }
    }

    // Convert individual reviews to single posts
    for (const review of individualReviews) {
      const singlePost = await convertUserReviewToFeedPost(review);
      feedPosts.push(singlePost);
    }

    // Sort by creation date (newest first)
    feedPosts.sort((a, b) => new Date(b.review.date).getTime() - new Date(a.review.date).getTime());

    console.log(`✅ Converted to ${feedPosts.length} feed posts (${visitGroups.size} visits + ${individualReviews.length} individual)`);
    return feedPosts;
  } catch (error) {
    console.error('Error converting user reviews to carousel feed posts:', error);
    throw error;
  }
};

// Batch convert user reviews to feed posts (for profile page)
export const convertUserReviewsToFeedPosts = async (reviews: FirebaseReview[]) => {
  return await convertUserVisitsToCarouselFeedPosts(reviews);
};

// Convert all reviews to carousel feed posts (for general feed)
export const convertReviewsToFeedPosts = async (reviews: FirebaseReview[]) => {
  try {
    const tStart = performance.now?.() ?? Date.now();
    console.log('Converting reviews to feed posts. Total reviews:', reviews.length, 'tStart=', tStart);

    const { visitGroups, individualReviews } = groupReviewsByVisit(reviews);
    const feedPosts = [];

    // Convert visit groups to carousel posts
    for (const [visitId, visitReviews] of visitGroups) {
      const carouselPost = await convertVisitToCarouselFeedPost(visitReviews);
      if (carouselPost) {
        feedPosts.push(carouselPost);
      }
    }

    // Convert individual reviews to single posts
    for (const review of individualReviews) {
      console.log('Processing review:', review.id, 'isDeleted:', review.isDeleted, 'hasRestaurant:', !!review.restaurantId, 'hasUser:', !!review.userId);
      const singlePost = await convertReviewToFeedPost(review);
      feedPosts.push(singlePost);
    }

    // Sort by creation date (newest first)
    feedPosts.sort((a, b) => new Date(b.review.date).getTime() - new Date(a.review.date).getTime());

    const missingQuality = feedPosts.reduce((acc, p: any) => acc + (p?.restaurant?.qualityScore === undefined ? 1 : 0), 0);
    const tEnd = performance.now?.() ?? Date.now();
    console.log(`Converted to feed posts: ${feedPosts.length} (missing qualityScore but kept: ${missingQuality}) durationMs=${tEnd - tStart}`);
    return feedPosts;
  } catch (error) {
    console.error('Error converting reviews to carousel feed posts:', error);
    // Fallback to individual posts
      return reviews.map(review => {
        const { tasteChips, audienceTags } = extractReviewTags(review);
        return {
          id: review.id,
          visitId: review.visitId,
          userId: review.userId,
          restaurantId: review.restaurantId,
          dishId: review.menuItemId,
          isCarousel: false,
          mediaItems: (() => {
            const imgs = getReviewImages(review);
            if (!imgs.length) return undefined;
            const item: FeedMediaItem = {
              id: `dish-${review.id}`,
              imageUrl: imgs[0],
              kind: 'dish',
              reviewId: review.id,
              dishName: review.dish,
              rating: review.rating,
            };
            return [item];
          })(),
          author: {
            id: review.userId || "anonymous", // NEW: Include userId in fallback
            name: review.userId || "Anonymous User",
          username: review.userId || "anonymous",
          image: getAvatarUrl({ username: review.userId || "anonymous" }),
          isVerified: false
        },
        restaurant: {
          name: review.restaurant,
          isVerified: false,
          qualityScore: 75
        },
        dish: {
          name: review.dish,
          image: (() => { const imgs = getReviewImages(review); return imgs && imgs.length > 0 ? imgs[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish)}`; })(),
          rating: review.rating,
          visitCount: review.visitedTimes
        },
        review: {
          date: safeToISOString(review.createdAt),
          caption: (review as any).caption || undefined,
          visitCaption: (review as any).visitCaption || undefined,
          tasteChips: tasteChips.length > 0 ? tasteChips : undefined,
          audienceTags: audienceTags.length > 0 ? audienceTags : undefined,
          verification: (review as any).verification
        },
        engagement: {
          likes: Math.floor(Math.random() * 100) + 10,
          comments: Math.floor(Math.random() * 30) + 1
        },
        location: review.location,
        tags: review.tags,
        price: review.price
      };
    });
  }
};

// Real-time listener for the home feed (public, not deleted), newest first
export function listenHomeFeed(onChange: (items: FirebaseReview[]) => void) {
  // Fetch more than needed (100) and filter client-side to exclude malformed docs
  // This avoids needing a composite index for where + multiple orderBy
  const qRef = query(
    collection(db, 'reviews'),
    orderBy('createdAt', 'desc'),
    limit(100) // Fetch extra to account for filtering
  );

  const unsub = onSnapshot(qRef, { includeMetadataChanges: false }, (snap) => {
    const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Filter out malformed documents (those with _methodName, missing dishName, etc.)
    const validDocs = raw.filter((doc: any) => {
      // Exclude docs that look like Firebase metadata
      if (doc._methodName || !doc.dish && !doc.dishName || !doc.userId) {
        return false;
      }
      return true;
    });

    const deletedCount = validDocs.filter((it: any) => asTrue(it?.isDeleted) === true).length;
    const privateCount = validDocs.filter((it: any) => it?.visibility === 'private').length;
    const items = validDocs.filter((it) => safeReview(it)).slice(0, 50) as FirebaseReview[]; // Take top 50 after filtering
    const sample = items.slice(0, 3).map((r: any) => ({ id: r.id, isDeleted: r.isDeleted, visibility: r.visibility, dishName: r.dish || r.dishName }));
    console.log(`Live feed snapshot: total=${raw.length}, valid=${validDocs.length}, dropped(deleted=${deletedCount}, private=${privateCount}), emitted=${items.length}, sample=`, sample);
    onChange(items);
  });

  return unsub;
}

// Personal Notes Management
export interface PersonalNote {
  id: string;
  text: string;
  timestamp: Date;
}

// Add personal note to a review
export const addPersonalNote = async (reviewId: string, noteText: string): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User must be authenticated');

    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) throw new Error('Review not found');
    
    const reviewData = reviewDoc.data();
    if (reviewData.userId !== currentUser.uid) throw new Error('Not authorized to edit this review');

    const existingNotes = reviewData.personalNotes || [];
    const newNote: PersonalNote = {
      id: Date.now().toString(),
      text: noteText.trim(),
      timestamp: new Date()
    };

    await updateDoc(reviewRef, {
      personalNotes: [...existingNotes, newNote],
      updatedAt: serverTimestamp()
    });

    console.log('✅ Personal note added successfully');
  } catch (error) {
    console.error('❌ Error adding personal note:', error);
    throw error;
  }
};

// Update existing personal note
export const updatePersonalNote = async (reviewId: string, noteId: string, newText: string): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User must be authenticated');

    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) throw new Error('Review not found');
    
    const reviewData = reviewDoc.data();
    if (reviewData.userId !== currentUser.uid) throw new Error('Not authorized to edit this review');

    const existingNotes = reviewData.personalNotes || [];
    const updatedNotes = existingNotes.map((note: PersonalNote) => 
      note.id === noteId 
        ? { ...note, text: newText.trim(), timestamp: new Date() }
        : note
    );

    await updateDoc(reviewRef, {
      personalNotes: updatedNotes,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Personal note updated successfully');
  } catch (error) {
    console.error('❌ Error updating personal note:', error);
    throw error;
  }
};

// Delete personal note
export const deletePersonalNote = async (reviewId: string, noteId: string): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('User must be authenticated');

    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) throw new Error('Review not found');
    
    const reviewData = reviewDoc.data();
    if (reviewData.userId !== currentUser.uid) throw new Error('Not authorized to edit this review');

    const existingNotes = reviewData.personalNotes || [];
    const filteredNotes = existingNotes.filter((note: PersonalNote) => note.id !== noteId);

    await updateDoc(reviewRef, {
      personalNotes: filteredNotes,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Personal note deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting personal note:', error);
    throw error;
  }
};

export const deleteReview = async (reviewInput: string | { id?: string | null; reviewId?: string | null }): Promise<void> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be authenticated');
    }

    const reviewId = normalizeReviewId(reviewInput);
    const reviewRef = reviewDoc(reviewId);

    console.log('[deleteReview]', reviewRef.path, reviewId);

    const reviewSnapshot = await getDoc(reviewRef);

    if (!reviewSnapshot.exists()) {
      throw new Error('Review not found');
    }

    const reviewData = reviewSnapshot.data() as (FirebaseReview & { pointsEarned?: number });

    if (reviewData.userId !== currentUser.uid) {
      throw new Error('Not authorized to delete this review');
    }

    // Check if this review is part of a multi-dish visit
    const visitId = reviewData.visitId;
    let reviewsToDelete: Array<{ id: string; data: FirebaseReview & { pointsEarned?: number } }> = [];

    if (visitId) {
      // This is a multi-dish visit - find all reviews with the same visitId
      console.log('[deleteReview] Multi-dish visit detected, finding all reviews with visitId:', visitId);

      const visitReviewsQuery = query(
        collection(db, 'reviews'),
        where('visitId', '==', visitId),
        where('userId', '==', currentUser.uid)
      );

      const visitReviewsSnapshot = await getDocs(visitReviewsQuery);

      visitReviewsSnapshot.forEach((doc) => {
        const data = doc.data() as (FirebaseReview & { pointsEarned?: number });
        reviewsToDelete.push({ id: doc.id, data });
      });

      console.log(`[deleteReview] Found ${reviewsToDelete.length} reviews to delete for visitId: ${visitId}`);
    } else {
      // Single review, not part of a visit
      reviewsToDelete = [{ id: reviewId, data: reviewData }];
    }

    // Delete all reviews
    const deletePromises = reviewsToDelete.map(({ id }) =>
      updateDoc(reviewDoc(id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );

    await Promise.all(deletePromises);

    // Update user stats - subtract points and review count for ALL deleted reviews
    try {
      const currentStats = await getUserProfile();
      if (currentStats.success && currentStats.profile) {
        const totalPointsToSubtract = reviewsToDelete.reduce((sum, { data }) => sum + (data.pointsEarned || 20), 0);
        const totalReviewsDeleted = reviewsToDelete.length;

        const newTotalPoints = Math.max(0, (currentStats.profile.stats?.pointsEarned || 0) - totalPointsToSubtract);
        const newTotalReviews = Math.max(0, (currentStats.profile.stats?.totalReviews || 0) - totalReviewsDeleted);

        await updateUserStats({
          pointsEarned: newTotalPoints,
          totalReviews: newTotalReviews
        });

        console.log(`[deleteReview] User stats updated after deleting ${totalReviewsDeleted} review(s):`, {
          pointsEarned: newTotalPoints,
          totalReviews: newTotalReviews,
          pointsSubtracted: totalPointsToSubtract
        });
      }
    } catch (error) {
      console.warn('Failed to update user stats after deletion (non-critical):', error);
    }

    console.log(`[deleteReview] Successfully soft deleted ${reviewsToDelete.length} review(s)`);
  } catch (error) {
    console.error('Error deleting review:', error);
    throw error;
  }
};
