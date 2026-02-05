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

export interface FollowWithProfile {
  id: string;
  userId: string;
  username: string;
  actualName?: string;
  avatar?: string;
  bio?: string;
  isFollowing?: boolean;
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

    // Update cached counters on both users for profile counts
    try {
      const followerRef = doc(db, 'users', currentUser.uid);
      const followingRef = doc(db, 'users', targetUserId);
      await Promise.all([
        updateDoc(followerRef, { followingCount: increment(1) }),
        updateDoc(followingRef, { followerCount: increment(1) })
      ]);
    } catch (countError) {
      console.error('Error updating follow counts:', countError);
    }

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

    // Update cached counters on both users for profile counts
    try {
      const followerRef = doc(db, 'users', currentUser.uid);
      const followingRef = doc(db, 'users', targetUserId);
      await Promise.all([
        updateDoc(followerRef, { followingCount: increment(-1) }),
        updateDoc(followingRef, { followerCount: increment(-1) })
      ]);
    } catch (countError) {
      console.error('Error updating follow counts:', countError);
    }

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
    // Read follower/following counts directly from user document (O(1) read)
    // These counts are maintained by the updateFollowerCounters Cloud Function
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return {
        followers: Number(userData.followerCount || 0),
        following: Number(userData.followingCount || 0)
      };
    }

    return { following: 0, followers: 0 };
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

// Get followers with their profile data
export const getFollowersWithProfiles = async (userId?: string): Promise<FollowWithProfile[]> => {
  try {
    const targetUserId = userId || getCurrentUser()?.uid;
    if (!targetUserId) return [];

    // Get the followers list
    const followers = await getFollowers(targetUserId);
    console.log('[getFollowersWithProfiles] Found follower relationships:', followers.length);
    if (followers.length === 0) return [];

    // Fetch profile data for each follower
    const currentUser = getCurrentUser();
    const profilePromises = followers.map(async (follow) => {
      const userRef = doc(db, 'users', follow.followerId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        // Check if current user is following this person
        let isFollowingUser = false;
        if (currentUser && currentUser.uid !== follow.followerId) {
          const followsRef = collection(db, 'follows');
          const q = query(
            followsRef,
            where('followerId', '==', currentUser.uid),
            where('followingId', '==', follow.followerId)
          );
          const followSnap = await getDocs(q);
          isFollowingUser = !followSnap.empty;
        }

        return {
          id: follow.id,
          userId: follow.followerId,
          username: userData.username || '',
          actualName: userData.actualName || userData.displayName || '',
          avatar: userData.avatar || '',
          bio: userData.bio || '',
          isFollowing: isFollowingUser
        } as FollowWithProfile;
      }

      // User profile doesn't exist - log it and return a placeholder profile
      console.warn('[getFollowersWithProfiles] User profile not found for userId:', follow.followerId);

      // Return a minimal profile with available data
      return {
        id: follow.id,
        userId: follow.followerId,
        username: 'Deleted User',
        actualName: '',
        avatar: '',
        bio: '',
        isFollowing: false,
        profileMissing: true
      } as FollowWithProfile & { profileMissing?: boolean };
    });

    const profiles = await Promise.all(profilePromises);
    // Filter out null values but keep missing profiles
    return profiles.filter((p): p is FollowWithProfile => p !== null);
  } catch (error) {
    console.error('Error getting followers with profiles:', error);
    return [];
  }
};

// Get following with their profile data
export const getFollowingWithProfiles = async (userId?: string): Promise<FollowWithProfile[]> => {
  try {
    const targetUserId = userId || getCurrentUser()?.uid;
    if (!targetUserId) return [];

    // Get the following list
    const following = await getFollowing(targetUserId);
    console.log('[getFollowingWithProfiles] Found following relationships:', following.length);
    if (following.length === 0) return [];

    // Fetch profile data for each followed user
    const currentUser = getCurrentUser();
    const profilePromises = following.map(async (follow) => {
      const userRef = doc(db, 'users', follow.followingId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        return {
          id: follow.id,
          userId: follow.followingId,
          username: userData.username || follow.followingUsername || '',
          actualName: userData.actualName || userData.displayName || '',
          avatar: userData.avatar || '',
          bio: userData.bio || '',
          isFollowing: true // We are viewing "following" list, so we follow them
        } as FollowWithProfile;
      }

      // User profile doesn't exist - log it and return a placeholder profile
      console.warn('[getFollowingWithProfiles] User profile not found for userId:', follow.followingId, 'username:', follow.followingUsername);

      // Return a minimal profile with available data from the follow relationship
      return {
        id: follow.id,
        userId: follow.followingId,
        username: follow.followingUsername || 'Deleted User',
        actualName: '',
        avatar: '',
        bio: '',
        isFollowing: true,
        profileMissing: true
      } as FollowWithProfile & { profileMissing?: boolean };
    });

    const profiles = await Promise.all(profilePromises);
    // Filter out null values but keep missing profiles
    return profiles.filter((p): p is FollowWithProfile => p !== null);
  } catch (error) {
    console.error('Error getting following with profiles:', error);
    return [];
  }
};
