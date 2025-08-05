import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getUserProfile, getCurrentUser, updateUserStats } from '../lib/firebase';
import { getAvatarUrl } from '../utils/avatarUtils';

// Photo upload service
export const uploadPhoto = async (file: File): Promise<string> => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `reviews/${timestamp}_${randomString}.${fileExtension}`;
    
    // Create storage reference
    const storageRef = ref(storage, fileName);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw new Error('Failed to upload photo');
  }
};

// Upload multiple photos
export const uploadMultiplePhotos = async (files: File[]): Promise<string[]> => {
  try {
    const uploadPromises = files.map(file => uploadPhoto(file));
    const photoUrls = await Promise.all(uploadPromises);
    return photoUrls;
  } catch (error) {
    console.error('Error uploading multiple photos:', error);
    throw new Error('Failed to upload photos');
  }
};

// Review data interface
export interface ReviewData {
  restaurantId?: string | null; // Firebase restaurant ID for linking
  visitId?: string; // NEW: Shared ID for multi-dish visits
  menuItemId?: string | null; // Firebase menu item ID for linking
  restaurant: string;
  location: string;
  dish: string;
  rating: number;
  personalNote: string;
  negativeNote: string;
  serverRating?: 'bad' | 'okay' | 'good' | null;
  price?: string | null;
  tags: string[];
  images: string[];
  isPublic: boolean;
}

// Create restaurant if it doesn't exist in Firebase
const createRestaurantIfNeeded = async (restaurant: any): Promise<string> => {
  // If it's already a Firebase restaurant, return its ID
  if (restaurant.id && !restaurant.id.startsWith('manual_')) {
    console.log('Using existing restaurant ID:', restaurant.id);
    return restaurant.id;
  }
  
  // Create new restaurant document
  try {
    console.log('Creating new restaurant:', restaurant.name);
    const newRestaurant = {
      name: restaurant.name,
      cuisine: restaurant.cuisine || 'User Added',
      address: restaurant.address || 'Address not provided', 
      phone: restaurant.phone || '',
      coordinates: restaurant.coordinates || { latitude: 0, longitude: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'restaurants'), newRestaurant);
    console.log('✅ Created new restaurant with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating restaurant:', error);
    throw new Error('Failed to create restaurant');
  }
};

// Create menu item if it doesn't exist in Firebase
const createMenuItemIfNeeded = async (dishName: string, restaurantId: string, selectedMenuItem: any): Promise<string> => {
  // If it's already a Firebase menu item, return its ID
  if (selectedMenuItem?.id && !selectedMenuItem.id.startsWith('manual_')) {
    console.log('Using existing menu item ID:', selectedMenuItem.id);
    return selectedMenuItem.id;
  }
  
  // Create new menu item document
  try {
    console.log('Creating new menu item:', dishName, 'for restaurant:', restaurantId);
    const newMenuItem = {
      name: dishName,
      category: selectedMenuItem?.category || 'Custom',
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
    const menuItemId = await createMenuItemIfNeeded(reviewData.dish, restaurantId, selectedMenuItem);

    // Step 3: Create review document with proper linking
    console.log('🔄 Saving review with links - restaurantId:', restaurantId, 'menuItemId:', menuItemId);
    const docRef = await addDoc(collection(db, 'reviews'), {
      ...reviewData,
      restaurantId: restaurantId, // Link to actual restaurant document
      menuItemId: menuItemId,     // Link to actual menu item document
      userId: currentUser.uid,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      triedTimes: 1,
      visitedTimes: 1,
      rewardReason: "First review bonus",
      pointsEarned: 200
    });
    
    console.log('✅ Review saved successfully with ID:', docRef.id);
    console.log('✅ Linked to restaurant:', restaurantId, 'and menu item:', menuItemId);
    
    // Step 4: Update user stats after saving review
    try {
      const currentStats = await getUserProfile();
      if (currentStats.success && currentStats.profile) {
        const newTotalPoints = (currentStats.profile.stats?.pointsEarned || 0) + 200;
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
  negativeNote: string;
  serverRating?: 'bad' | 'okay' | 'good' | null;
  price?: string | null;
  tags: string[];
  images: string[];
  isPublic: boolean;
  timestamp: any; // Firestore timestamp
  createdAt: string;
  triedTimes: number;
  visitedTimes: number;
  rewardReason: string;
  pointsEarned: number;
}

// Fetch reviews from Firestore
export const fetchReviews = async (limitCount = 20): Promise<FirebaseReview[]> => {
  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(reviewsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    
    const querySnapshot = await getDocs(q);
    const reviews: FirebaseReview[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reviews.push({
        id: doc.id,
        ...data
      } as FirebaseReview);
    });
    
    console.log(`Fetched ${reviews.length} reviews from Firestore`);
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
      orderBy('timestamp', 'desc'), 
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const reviews: FirebaseReview[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reviews.push({
        id: doc.id,
        ...data
      } as FirebaseReview);
    });
    
    if (reviews.length === 0) {
      console.log('No reviews found for current user - this is normal for new users');
    } else {
      console.log(`Successfully fetched ${reviews.length} user reviews from Firestore`);
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
  
  // Get author info from main review - UPDATED with id field
  let author: FeedPostAuthor = {
    id: "anonymous", // NEW: Default anonymous ID
    name: "Anonymous User",
    username: "anonymous",
    image: getAvatarUrl({ username: "anonymous" }),
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

  // Create carousel data for all dishes in the visit
  const carouselItems = sortedReviews.map(review => ({
    id: review.id,
    dishId: review.menuItemId,
    dish: {
      name: review.dish,
      image: review.images.length > 0 ? review.images[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish)}`,
      rating: review.rating,
      visitCount: review.visitedTimes
    },
    review: {
      positive: review.personalNote,
      negative: review.negativeNote,
      date: new Date(review.createdAt).toLocaleDateString()
    },
    tags: review.tags,
    price: review.price
  }));

  return {
    id: mainReview.visitId || mainReview.id,
    visitId: mainReview.visitId,
    userId: mainReview.userId,
    restaurantId: mainReview.restaurantId,
    dishId: mainReview.menuItemId,
    isCarousel: true, // Flag to indicate this is a carousel post
    carouselItems, // Array of all dishes in the visit
    author, // NOW includes author.id for follow functionality
    restaurant: {
      name: mainReview.restaurant,
      isVerified: Math.random() > 0.7,
      qualityScore: Math.floor(Math.random() * 40) + 60
    },
    dish: {
      name: reviews.length > 1 ? `${reviews.length} dishes` : mainReview.dish,
      image: mainReview.images.length > 0 ? mainReview.images[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(mainReview.dish)}`,
      rating: parseFloat(averageRating.toFixed(1)),
      visitCount: mainReview.visitedTimes
    },
    review: {
      positive: mainReview.personalNote,
      negative: mainReview.negativeNote,
      date: new Date(mainReview.createdAt).toLocaleDateString()
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

// Convert single review to feed post (for non-visit reviews) - UPDATED with author.id
export const convertReviewToFeedPost = async (review: FirebaseReview) => {
  let author: FeedPostAuthor = {
    id: "anonymous", // NEW: Default anonymous ID
    name: "Anonymous User",
    username: "anonymous",
    image: getAvatarUrl({ username: "anonymous" }),
    isVerified: false
  };

  if (review.userId) {
    try {
      if (userProfileCache.has(review.userId)) {
        author = userProfileCache.get(review.userId)!;
      } else {
        const userProfileResult = await getUserProfile(review.userId);
        if (userProfileResult.success && userProfileResult.profile) {
          const profile = userProfileResult.profile;
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
  
  return {
    id: review.id,
    visitId: review.visitId,
    userId: review.userId,
    restaurantId: review.restaurantId,
    dishId: review.menuItemId,
    isCarousel: false, // Single dish post
    author, // NOW includes author.id for follow functionality
    restaurant: {
      name: review.restaurant,
      isVerified: Math.random() > 0.7,
      qualityScore: Math.floor(Math.random() * 40) + 60
    },
    dish: {
      name: review.dish,
      image: review.images.length > 0 ? review.images[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish)}`,
      rating: review.rating,
      visitCount: review.visitedTimes
    },
    review: {
      positive: review.personalNote,
      negative: review.negativeNote,
      date: new Date(review.createdAt).toLocaleDateString()
    },
    engagement: {
      likes: 0,
      comments: 0
    },
    location: review.location,
    tags: review.tags,
    price: review.price
  };
};

// Convert current user's review to feed post format (optimized for profile page) - UPDATED with author.id
export const convertUserReviewToFeedPost = async (review: FirebaseReview) => {
  const userProfileResult = await getUserProfile();
  
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
    author, // NOW includes author.id for follow functionality
    restaurant: {
      name: review.restaurant,
      isVerified: false,
      qualityScore: 85
    },
    dish: {
      name: review.dish,
      image: review.images.length > 0 ? review.images[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish)}`,
      rating: review.rating,
      visitCount: review.visitedTimes
    },
    review: {
      positive: review.personalNote,
      negative: review.negativeNote,
      date: new Date(review.createdAt).toLocaleDateString()
    },
    engagement: {
      likes: 0,
      comments: 0
    },
    location: review.location,
    tags: review.tags,
    price: review.price
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
    console.log(`Converting ${reviews.length} reviews to carousel feed posts...`);
    
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
      const singlePost = await convertReviewToFeedPost(review);
      feedPosts.push(singlePost);
    }

    // Sort by creation date (newest first)
    feedPosts.sort((a, b) => new Date(b.review.date).getTime() - new Date(a.review.date).getTime());

    console.log(`✅ Converted to ${feedPosts.length} feed posts (${visitGroups.size} visits + ${individualReviews.length} individual)`);
    return feedPosts;
  } catch (error) {
    console.error('Error converting reviews to carousel feed posts:', error);
    // Fallback to individual posts
    return reviews.map(review => ({
      id: review.id,
      visitId: review.visitId,
      userId: review.userId,
      restaurantId: review.restaurantId,
      dishId: review.menuItemId,
      isCarousel: false,
      author: {
        id: review.userId || "anonymous", // NEW: Include userId in fallback
        name: "Anonymous User",
        username: "anonymous",
        image: getAvatarUrl({ username: "anonymous" }),
        isVerified: false
      },
      restaurant: {
        name: review.restaurant,
        isVerified: false,
        qualityScore: 75
      },
      dish: {
        name: review.dish,
        image: review.images.length > 0 ? review.images[0] : `https://source.unsplash.com/500x500/?food,${encodeURIComponent(review.dish)}`,
        rating: review.rating,
        visitCount: review.visitedTimes
      },
      review: {
        positive: review.personalNote,
        negative: review.negativeNote,
        date: new Date(review.createdAt).toLocaleDateString()
      },
      engagement: {
        likes: Math.floor(Math.random() * 100) + 10,
        comments: Math.floor(Math.random() * 30) + 1
      },
      location: review.location,
      tags: review.tags,
      price: review.price
    }));
  }
};