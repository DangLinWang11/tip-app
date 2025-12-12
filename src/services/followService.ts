import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
  getDoc,
  orderBy,
  limit,
  getCountFromServer
} from 'firebase/firestore';
import { db, getCurrentUser } from '../lib/firebase';

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  followingUsername: string;
  timestamp: Date;
}

export interface FollowCounts {
  following: number;
  followers: number;
}

// Check if current user is following a specific user
export const isFollowing = async (targetUserId: string): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;

    const followsRef = collection(db, 'follows');
    const q = query(
      followsRef,
      where('followerId', '==', currentUser.uid),
      where('followingId', '==', targetUserId)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
};

// Follow a user
export const followUser = async (targetUserId: string, targetUsername: string): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.uid === targetUserId) return false;

    // Check if already following
    const alreadyFollowing = await isFollowing(targetUserId);
    if (alreadyFollowing) return false;

    // Add follow relationship
    const followsRef = collection(db, 'follows');
    await addDoc(followsRef, {
      followerId: currentUser.uid,
      followingId: targetUserId,
      followingUsername: targetUsername,
      timestamp: new Date()
    });

    return true;
  } catch (error) {
    console.error('Error following user:', error);
    return false;
  }
};

// Unfollow a user
export const unfollowUser = async (targetUserId: string): Promise<boolean> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;

    // Find and delete follow relationship
    const followsRef = collection(db, 'follows');
    const q = query(
      followsRef,
      where('followerId', '==', currentUser.uid),
      where('followingId', '==', targetUserId)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return false;

    // Delete the follow document
    await deleteDoc(snapshot.docs[0].ref);

    return true;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return false;
  }
};

// Get users that current user is following
export const getFollowing = async (userId?: string): Promise<Follow[]> => {
  try {
    const targetUserId = userId || getCurrentUser()?.uid;
    if (!targetUserId) return [];

    const followsRef = collection(db, 'follows');
    // Simple single-field where query to avoid composite index requirements.
    const q = query(
      followsRef,
      where('followerId', '==', targetUserId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate()
    } as Follow));
  } catch (error) {
    console.error('Error getting following list:', error);
    return [];
  }
};

// Get users following the current user
export const getFollowers = async (userId?: string): Promise<Follow[]> => {
  try {
    const targetUserId = userId || getCurrentUser()?.uid;
    if (!targetUserId) return [];

    const followsRef = collection(db, 'follows');
    const q = query(
      followsRef,
      where('followingId', '==', targetUserId),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate()
    } as Follow));
  } catch (error) {
    console.error('Error getting followers list:', error);
    return [];
  }
};

// Get follow counts for a user
export const getFollowCounts = async (userId: string): Promise<FollowCounts> => {
  try {
    // Followers = count of follows where followingId == userId
    const followersQ = query(collection(db, 'follows'), where('followingId', '==', userId));
    const followersSnap = await getCountFromServer(followersQ);

    // Following = count of follows where followerId == userId
    const followingQ = query(collection(db, 'follows'), where('followerId', '==', userId));
    const followingSnap = await getCountFromServer(followingQ);

    return {
      followers: Number(followersSnap.data().count || 0),
      following: Number(followingSnap.data().count || 0)
    };
  } catch (error) {
    console.error('Error getting follow counts:', error);
    return { following: 0, followers: 0 };
  }
};

// Get reviews from users that current user is following (for Recent Activity feed)
export const getFollowingActivity = async (limitCount: number = 20): Promise<any[]> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    // Get list of users current user is following
    const following = await getFollowing();
    const followingIds = following.map(f => f.followingId);
    
    if (followingIds.length === 0) return [];

    // Get recent reviews from followed users
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('userId', 'in', followingIds.slice(0, 10)), // Firestore limit of 10 for 'in' queries
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate()
    }));
  } catch (error) {
    console.error('Error getting following activity:', error);
    return [];
  }
};
