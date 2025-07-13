import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, getUserProfile, getCurrentUser } from '../lib/firebase';
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

// Save review to Firestore
export const saveReview = async (reviewData: ReviewData): Promise<string> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be authenticated to save reviews');
    }

    // Create review document with auto-generated ID and timestamp
    const docRef = await addDoc(collection(db, 'reviews'), {
      ...reviewData,
      userId: currentUser.uid, // Link review to authenticated user
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
      triedTimes: 1,
      visitedTimes: 1,
      rewardReason: "First review bonus",
      pointsEarned: 200
    });
    
    console.log('Review saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving review:', error);
    throw new Error('Failed to save review');
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
      throw new Error('User must be authenticated to fetch reviews');
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
    
    console.log(`Fetched ${reviews.length} user reviews from Firestore`);
    return reviews;
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    throw new Error('Failed to fetch user reviews');
  }
};

// Feed post author interface
interface FeedPostAuthor {
  name: string;
  username: string;
  image: string;
  isVerified: boolean;
}

// Cache for user profiles to avoid redundant fetches
const userProfileCache = new Map<string, FeedPostAuthor>();

// Convert Firebase review to feed post format with real user data
export const convertReviewToFeedPost = async (review: FirebaseReview) => {
  let author: FeedPostAuthor = {
    name: "Anonymous User",
    username: "anonymous",
    image: getAvatarUrl({ username: "anonymous" }),
    isVerified: false
  };

  // Fetch real user profile if userId exists
  if (review.userId) {
    try {
      // Check cache first
      if (userProfileCache.has(review.userId)) {
        author = userProfileCache.get(review.userId)!;
      } else {
        // Fetch user profile from Firebase
        const userProfileResult = await getUserProfile(review.userId);
        if (userProfileResult.success && userProfileResult.profile) {
          const profile = userProfileResult.profile;
          author = {
            name: profile.displayName || profile.username,
            username: profile.username,
            image: getAvatarUrl(profile),
            isVerified: profile.isVerified || false
          };
          
          // Cache the result
          userProfileCache.set(review.userId, author);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user profile for review:', review.id, error);
      // Keep default anonymous author
    }
  }
  
  return {
    id: review.id,
    userId: review.userId,
    restaurantId: review.restaurantId,
    dishId: review.menuItemId,
    author,
    restaurant: {
      name: review.restaurant,
      isVerified: Math.random() > 0.7, // Some restaurants are verified
      qualityScore: Math.floor(Math.random() * 40) + 60 // 60-100
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
  };
};

// Convert current user's review to feed post format (optimized for profile page)
export const convertUserReviewToFeedPost = async (review: FirebaseReview) => {
  // For current user's reviews, we already have their profile data
  const currentUser = getCurrentUser();
  const userProfileResult = await getUserProfile();
  
  let author: FeedPostAuthor = {
    name: "You",
    username: "you",
    image: getAvatarUrl({ username: "you" }),
    isVerified: false
  };

  if (userProfileResult.success && userProfileResult.profile) {
    const profile = userProfileResult.profile;
    author = {
      name: profile.displayName || profile.username,
      username: profile.username,
      image: getAvatarUrl(profile),
      isVerified: profile.isVerified || false
    };
  }
  
  return {
    id: review.id,
    userId: review.userId,
    restaurantId: review.restaurantId,
    dishId: review.menuItemId,
    author,
    restaurant: {
      name: review.restaurant,
      isVerified: false, // Could be determined by restaurant data
      qualityScore: 85 // Default good score for user's own reviews
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
      likes: 0, // Start with 0 for user's own reviews
      comments: 0 // Start with 0 for user's own reviews
    },
    location: review.location,
    tags: review.tags,
    price: review.price
  };
};

// Batch convert user reviews to feed posts (for profile page)
export const convertUserReviewsToFeedPosts = async (reviews: FirebaseReview[]) => {
  try {
    console.log(`Converting ${reviews.length} user reviews to feed posts...`);
    const feedPosts = await Promise.all(
      reviews.map(review => convertUserReviewToFeedPost(review))
    );
    console.log(`✅ Converted ${feedPosts.length} user reviews to feed posts`);
    return feedPosts;
  } catch (error) {
    console.error('Error converting user reviews to feed posts:', error);
    throw error;
  }
};

// Batch convert reviews to feed posts with user data (for general feed)
export const convertReviewsToFeedPosts = async (reviews: FirebaseReview[]) => {
  try {
    console.log(`Converting ${reviews.length} reviews to feed posts...`);
    const feedPosts = await Promise.all(
      reviews.map(review => convertReviewToFeedPost(review))
    );
    console.log(`✅ Converted ${feedPosts.length} reviews to feed posts`);
    return feedPosts;
  } catch (error) {
    console.error('Error converting reviews to feed posts:', error);
    // Fallback to synchronous conversion without user data
    return reviews.map(review => ({
      id: review.id,
      userId: review.userId,
      restaurantId: review.restaurantId,
      dishId: review.menuItemId,
      author: {
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