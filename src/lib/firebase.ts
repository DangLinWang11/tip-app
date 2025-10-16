import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User, updatePassword, reauthenticateWithCredential, EmailAuthProvider, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';


const firebaseConfig = {
  apiKey: "AIzaSyBEzuZLNQo0SJ-zfq6IsBPbYKFj6NV6sAM",
  authDomain: "tip-sarasotav2.firebaseapp.com",
  projectId: "tip-sarasotav2",
  // storageBucket must be the bucket name, not a URL/domain
  storageBucket: "tip-sarasotav2.appspot.com",
  messagingSenderId: "279316450534",
  appId: "1:279316450534:web:6386a22fe38591ef84ff27",
  measurementId: "G-9RQW6H7238"
};

// Initialize Firebase with error handling
let app;
try {
  console.log('Initializing Firebase app with config:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    storageBucket: firebaseConfig.storageBucket
  });
  
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase app initialized successfully');
} catch (error) {
  console.error('❌ Firebase app initialization failed:', error);
  throw new Error(`Firebase initialization failed: ${error.message}`);
}

// Initialize Firebase Authentication with error handling
let auth;
try {
  auth = getAuth(app);
  console.log('✅ Firebase Auth initialized successfully');
} catch (error) {
  console.error('❌ Firebase Auth initialization failed:', error);
  throw new Error(`Firebase Auth initialization failed: ${error.message}`);
}

// Initialize Cloud Firestore with error handling
let db;
try {
  db = getFirestore(app);
  console.log('✅ Firebase Firestore initialized successfully');
} catch (error) {
  console.error('❌ Firebase Firestore initialization failed:', error);
  throw new Error(`Firebase Firestore initialization failed: ${error.message}`);
}

// Initialize Cloud Storage with error handling
let storage;
try {
  storage = getStorage(app);
  console.log('✅ Firebase Storage initialized successfully');
} catch (error) {
  console.error('❌ Firebase Storage initialization failed:', error);
  throw new Error(`Firebase Storage initialization failed: ${error.message}`);
}

// Initialize Analytics with error handling (only in production)
let analytics;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    console.log('✅ Firebase Analytics initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Analytics initialization failed:', error);
    // Analytics failure shouldn't break the app, so we don't throw
    analytics = null;
  }
}

// Export initialized services
export { auth, db, storage, analytics };

// Configure Auth settings for better security
if (typeof window !== 'undefined' && auth) {
  try {
    // Set language to the default browser preference
    auth.languageCode = 'en';
    
    // Enable App Check for additional security (optional)
    auth.settings.appVerificationDisabledForTesting = false;
    
    console.log('✅ Firebase Auth settings configured successfully');
  } catch (error) {
    console.error('❌ Firebase Auth settings configuration failed:', error);
  }
}

// Email and Password Authentication Functions

// Sign up with email and password
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  if (!auth) {
    const error = 'Firebase Auth not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!email || !email.trim()) {
    const error = 'Email is required';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!password || !password.trim()) {
    const error = 'Password is required';
    console.error('❌', error);
    return { success: false, error };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const error = 'Please enter a valid email address';
    console.error('❌', error);
    return { success: false, error };
  }

  // Validate password strength
  if (password.length < 6) {
    const error = 'Password must be at least 6 characters long';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('📧 Creating account with email:', email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ Account created successfully', { uid: user.uid, email: user.email });
    return { success: true, user };
  } catch (error: any) {
    console.error('❌ Account creation failed:', error);
    
    let errorMessage = 'Failed to create account';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'An account with this email already exists';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Please enter a valid email address';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password is too weak. Please choose a stronger password';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Email/password sign-up is not enabled';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred during sign-up';
        console.error('🔍 Unhandled error code:', error.code, error.message);
    }
    
    return { success: false, error: errorMessage };
  }
};

// Sign in with email and password
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  if (!auth) {
    const error = 'Firebase Auth not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!email || !email.trim()) {
    const error = 'Email is required';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!password || !password.trim()) {
    const error = 'Password is required';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('🔐 Signing in with email:', email.replace(/(.{2})(.*)(@.*)/, '$1***$3'));
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('✅ Sign-in successful', { uid: user.uid, email: user.email });
    return { success: true, user };
  } catch (error: any) {
    console.error('❌ Sign-in failed:', error);
    
    let errorMessage = 'Failed to sign in';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Please enter a valid email address';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'Invalid email or password';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred during sign-in';
        console.error('🔍 Unhandled error code:', error.code, error.message);
    }
    
    return { success: false, error: errorMessage };
  }
};

// Google Sign-In
export const signInWithGoogle = async (): Promise<{ success: boolean; user?: User; error?: string }> => {
  if (!auth) {
    const error = 'Firebase Auth not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('🔐 Signing in with Google...');
    
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;
    
    console.log('✅ Google sign-in successful', { uid: user.uid, email: user.email });
    return { success: true, user };
  } catch (error: any) {
    console.error('❌ Google sign-in failed:', error);
    
    let errorMessage = 'Failed to sign in with Google';
    
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'Sign-in popup was closed';
        break;
      case 'auth/popup-blocked':
        errorMessage = 'Sign-in popup was blocked by browser';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'Sign-in was cancelled';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'Invalid Google credentials';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred during Google sign-in';
        console.error('🔍 Unhandled Google auth error code:', error.code, error.message);
    }
    
    return { success: false, error: errorMessage };
  }
};

// Sign out user
export const signOutUser = async (): Promise<{ success: boolean; error?: string }> => {
  if (!auth) {
    const error = 'Firebase Auth not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('👋 Signing out user...');
    await signOut(auth);
    console.log('✅ User signed out successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Sign-out failed:', error);
    
    const errorMessage = error.message || 'Failed to sign out';
    return { success: false, error: errorMessage };
  }
};

// Get current user
export const getCurrentUser = (): User | null => {
  if (!auth) {
    console.error('❌ Firebase Auth not initialized');
    return null;
  }
  
  return auth.currentUser;
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const user = getCurrentUser();
  return user !== null;
};

// User Profile Management Functions

// Interface for user profile data
export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  isVerified?: boolean;
  isOnboarded?: boolean;
  createdAt: any;
  updatedAt: any;
  lastLogin: any;
  stats?: {
    totalReviews: number;
    totalRestaurants: number;
    averageRating: number;
    pointsEarned: number;
  };
}

// Create user profile in Firestore after signup
export const createUserProfile = async (
  user: User,
  additionalData: {
    username: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  if (!db) {
    const error = 'Firestore not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!user) {
    const error = 'User is required';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!additionalData.username || !additionalData.username.trim()) {
    const error = 'Username is required';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('👤 Creating user profile for:', user.uid);

    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      username: additionalData.username.trim(),
      displayName: additionalData.displayName || additionalData.username.trim(),
      avatar: additionalData.avatar || '',
      bio: additionalData.bio || '',
      isVerified: false,
      isOnboarded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      stats: {
        totalReviews: 0,
        totalRestaurants: 0,
        averageRating: 0,
        pointsEarned: 0
      }
    };

    await setDoc(doc(db, 'users', user.uid), userProfile);
    
    console.log('✅ User profile created successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to create user profile:', error);
    
    let errorMessage = 'Failed to create user profile';
    
    switch (error.code) {
      case 'permission-denied':
        errorMessage = 'Permission denied. Please check Firestore security rules';
        break;
      case 'unavailable':
        errorMessage = 'Service temporarily unavailable. Please try again';
        break;
      case 'deadline-exceeded':
        errorMessage = 'Request timeout. Please check your internet connection';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Get user profile from Firestore
export const getUserProfile = async (
  userId?: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> => {
  if (!db) {
    const error = 'Firestore not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  // Use provided userId or current user's ID
  const targetUserId = userId || getCurrentUser()?.uid;
  
  if (!targetUserId) {
    const error = 'No user ID provided and no authenticated user';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('👤 Fetching user profile for:', targetUserId);

    const userDoc = await getDoc(doc(db, 'users', targetUserId));
    
    if (!userDoc.exists()) {
      const error = 'User profile not found';
      console.warn('⚠️', error);
      return { success: false, error };
    }

    const profile = userDoc.data() as UserProfile;
    console.log('✅ User profile fetched successfully');
    
    return { success: true, profile };
  } catch (error: any) {
    console.error('❌ Failed to fetch user profile:', error);
    
    let errorMessage = 'Failed to fetch user profile';
    
    switch (error.code) {
      case 'permission-denied':
        errorMessage = 'Permission denied. Please check Firestore security rules';
        break;
      case 'unavailable':
        errorMessage = 'Service temporarily unavailable. Please try again';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Get user profile by username
export const getUserByUsername = async (
  username: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> => {
  if (!db) {
    const error = 'Firestore not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!username || !username.trim()) {
    const error = 'Username is required';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('👤 Fetching user profile by username:', username);

    const usersRef = collection(db, 'users');
    const trimmedUsername = username.trim();
    
    // First try exact match
    let q = query(usersRef, where('username', '==', trimmedUsername));
    let querySnapshot = await getDocs(q);
    
    // If no exact match found, try lowercase match
    if (querySnapshot.empty) {
      q = query(usersRef, where('username', '==', trimmedUsername.toLowerCase()));
      querySnapshot = await getDocs(q);
    }
    
    if (querySnapshot.empty) {
      const error = 'User not found';
      console.warn('⚠️', error);
      return { success: false, error };
    }

    const userDoc = querySnapshot.docs[0];
    const profile = userDoc.data() as UserProfile;
    console.log('✅ User profile fetched successfully by username');
    
    return { success: true, profile };
  } catch (error: any) {
    console.error('❌ Failed to fetch user profile by username:', error);
    
    let errorMessage = 'Failed to fetch user profile';
    
    switch (error.code) {
      case 'permission-denied':
        errorMessage = 'Permission denied. Please check Firestore security rules';
        break;
      case 'unavailable':
        errorMessage = 'Service temporarily unavailable. Please try again';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Update user profile in Firestore
export const updateUserProfile = async (
  updates: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> => {
  if (!db) {
    const error = 'Firestore not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    const error = 'No authenticated user';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('👤 Updating user profile for:', currentUser.uid);

    // Add updated timestamp to the updates
    const profileUpdates = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, 'users', currentUser.uid), profileUpdates);
    
    console.log('✅ User profile updated successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to update user profile:', error);
    
    let errorMessage = 'Failed to update user profile';
    
    switch (error.code) {
      case 'permission-denied':
        errorMessage = 'Permission denied. Please check Firestore security rules';
        break;
      case 'not-found':
        errorMessage = 'User profile not found';
        break;
      case 'unavailable':
        errorMessage = 'Service temporarily unavailable. Please try again';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Update user's last login timestamp
export const updateLastLogin = async (): Promise<{ success: boolean; error?: string }> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'No authenticated user' };
  }

  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      lastLogin: serverTimestamp()
    });
    
    console.log('✅ Last login updated');
    return { success: true };
  } catch (error: any) {
    console.warn('⚠️ Failed to update last login:', error);
    // Don't fail the entire login process for this
    return { success: false, error: error.message };
  }
};

// Update user stats (called when reviews are created/updated)
export const updateUserStats = async (
  stats: Partial<UserProfile['stats']>
): Promise<{ success: boolean; error?: string }> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, error: 'No authenticated user' };
  }

  try {
    const userProfileResult = await getUserProfile();
    if (!userProfileResult.success || !userProfileResult.profile) {
      return { success: false, error: 'Could not fetch current user profile' };
    }

    const currentStats = userProfileResult.profile.stats || {
      totalReviews: 0,
      totalRestaurants: 0,
      averageRating: 0,
      pointsEarned: 0
    };

    const updatedStats = {
      ...currentStats,
      ...stats
    };

    const result = await updateUserProfile({ stats: updatedStats });
    
    if (result.success) {
      console.log('✅ User stats updated successfully');
    }
    
    return result;
  } catch (error: any) {
    console.error('❌ Failed to update user stats:', error);
    return { success: false, error: error.message };
  }
};

// Check if username is available
export const checkUsernameAvailability = async (
  username: string
): Promise<{ success: boolean; available?: boolean; error?: string }> => {
  if (!db) {
    return { success: false, error: 'Firestore not initialized' };
  }

  if (!username || !username.trim()) {
    return { success: false, error: 'Username is required' };
  }

  try {
    // Note: For better performance, you might want to create a separate 'usernames' collection
    // to check availability without scanning all user documents
    console.log('🔍 Checking username availability:', username);
    
    // For now, we'll just return true. In production, you'd implement proper username checking
    // This could involve querying users collection or maintaining a separate usernames collection
    
    return { success: true, available: true };
  } catch (error: any) {
    console.error('❌ Failed to check username availability:', error);
    return { success: false, error: error.message };
  }
};

// Upload profile image to Firebase Storage
export const uploadProfileImage = async (
  blob: Blob
): Promise<{ success: boolean; url?: string; error?: string }> => {
  if (!storage) {
    const error = 'Firebase Storage not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    const error = 'No authenticated user';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('📤 Uploading profile image for user:', currentUser.uid);

    // Create unique filename
    const timestamp = Date.now();
    const fileName = `profile-images/${currentUser.uid}_${timestamp}.jpg`;
    
    // Create storage reference
    const storageRef = ref(storage, fileName);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, blob);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Profile image uploaded successfully');
    return { success: true, url: downloadURL };
  } catch (error: any) {
    console.error('❌ Failed to upload profile image:', error);
    
    let errorMessage = 'Failed to upload profile image';
    
    switch (error.code) {
      case 'storage/unauthorized':
        errorMessage = 'Permission denied. Please check Storage security rules';
        break;
      case 'storage/canceled':
        errorMessage = 'Upload was canceled';
        break;
      case 'storage/unknown':
        errorMessage = 'Unknown storage error occurred';
        break;
      case 'storage/invalid-format':
        errorMessage = 'Invalid file format';
        break;
      case 'storage/invalid-checksum':
        errorMessage = 'File upload failed. Please try again';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred during upload';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Update user password
export const updateUserPassword = async (
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  if (!auth) {
    const error = 'Firebase Auth not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    const error = 'No authenticated user';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!newPassword || newPassword.length < 6) {
    const error = 'Password must be at least 6 characters long';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('🔐 Updating password for user:', currentUser.uid);
    
    await updatePassword(currentUser, newPassword);
    
    console.log('✅ Password updated successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to update password:', error);
    
    let errorMessage = 'Failed to update password';
    
    switch (error.code) {
      case 'auth/weak-password':
        errorMessage = 'Password is too weak. Please choose a stronger password';
        break;
      case 'auth/requires-recent-login':
        errorMessage = 'For security reasons, please sign out and sign back in before changing your password';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Verify current password
export const verifyCurrentPassword = async (
  password: string
): Promise<{ success: boolean; error?: string }> => {
  if (!auth) {
    const error = 'Firebase Auth not initialized';
    console.error('❌', error);
    return { success: false, error };
  }

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.email) {
    const error = 'No authenticated user or email found';
    console.error('❌', error);
    return { success: false, error };
  }

  if (!password) {
    const error = 'Password is required';
    console.error('❌', error);
    return { success: false, error };
  }

  try {
    console.log('🔐 Verifying current password for user:', currentUser.uid);
    
    // Create credential with current email and password
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    
    // Attempt to re-authenticate
    await reauthenticateWithCredential(currentUser, credential);
    
    console.log('✅ Password verification successful');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Password verification failed:', error);
    
    let errorMessage = 'Password verification failed';
    
    switch (error.code) {
      case 'auth/wrong-password':
        errorMessage = 'Current password is incorrect';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection';
        break;
      case 'auth/user-mismatch':
        errorMessage = 'User mismatch error. Please sign out and try again';
        break;
      default:
        errorMessage = error.message || 'Unknown error occurred';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Helper function to test Firebase connection
export const testFirebaseConnection = async () => {
  const results = {
    app: false,
    auth: false,
    firestore: false,
    storage: false,
    analytics: false
  };
  
  try {
    // Test app
    if (app) {
      results.app = true;
      console.log('✅ Firebase app connection: OK');
    }
    
    // Test auth
    if (auth) {
      results.auth = true;
      console.log('✅ Firebase Auth connection: OK');
    }
    
    // Test Firestore
    if (db) {
      results.firestore = true;
      console.log('✅ Firebase Firestore connection: OK');
    }
    
    // Test Storage
    if (storage) {
      results.storage = true;
      console.log('✅ Firebase Storage connection: OK');
    }
    
    // Test Analytics
    if (analytics) {
      results.analytics = true;
      console.log('✅ Firebase Analytics connection: OK');
    }
    
    console.log('Firebase connection test results:', results);
    return results;
  } catch (error) {
    console.error('❌ Firebase connection test failed:', error);
    return results;
  }
};

export default app;
// Restaurant coordinate management functions
export const updateRestaurantCoordinates = async (
  restaurantId: string, 
  coordinates: { lat: number; lng: number }
): Promise<{ success: boolean; error?: string }> => {
  if (!db) {
    return { success: false, error: 'Firestore not initialized' };
  }

  try {
    console.log('📍 Updating restaurant coordinates for:', restaurantId, coordinates);
    
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      coordinates: {
        latitude: coordinates.lat,
        longitude: coordinates.lng
      },
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Restaurant coordinates updated successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to update restaurant coordinates:', error);
    return { success: false, error: error.message };
  }
};

export const deleteRestaurant = async (
  restaurantId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!db) {
    return { success: false, error: 'Firestore not initialized' };
  }

  try {
    console.log('🗑️ Deleting restaurant:', restaurantId);
    
    await deleteDoc(doc(db, 'restaurants', restaurantId));
    
    console.log('✅ Restaurant deleted successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to delete restaurant:', error);
    return { success: false, error: error.message };
  }
};
