import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';

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
    // Create review document with auto-generated ID and timestamp
    const docRef = await addDoc(collection(db, 'reviews'), {
      ...reviewData,
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

// Convert Firebase review to feed post format
export const convertReviewToFeedPost = (review: FirebaseReview) => {
  // Generate a mock author for now - later can be tied to user authentication
  const mockAuthors = [
    {
      name: "Alex Johnson",
      image: "https://randomuser.me/api/portraits/women/65.jpg",
      isVerified: true
    },
    {
      name: "Sarah Chen",
      image: "https://randomuser.me/api/portraits/women/32.jpg",
      isVerified: false
    },
    {
      name: "Mike Rodriguez",
      image: "https://randomuser.me/api/portraits/men/85.jpg",
      isVerified: true  
    },
    {
      name: "Emma Wilson",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
      isVerified: false
    }
  ];
  
  const randomAuthor = mockAuthors[Math.floor(Math.random() * mockAuthors.length)];
  
  return {
    id: review.id,
    author: randomAuthor,
    restaurant: {
      name: review.restaurant,
      isVerified: Math.random() > 0.5,
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
    }
  };
};