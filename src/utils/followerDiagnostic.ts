/**
 * Browser-based follower diagnostic utility
 * Run this in the browser console while logged in to diagnose follower issues
 *
 * Usage:
 * 1. Import this file in your app
 * 2. In browser console: window.diagnoseFollowers('spicyfoodie', 'br12_e')
 */

import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

interface DiagnosticResult {
  username: string;
  userId: string;
  storedFollowerCount: number;
  storedFollowingCount: number;
  actualFollowers: Array<{ id: string; followerId: string; timestamp: any }>;
  actualFollowing: Array<{ id: string; followingId: string; followingUsername: string; timestamp: any }>;
  isFollowingTarget: boolean;
  targetUsername: string;
  discrepancies: string[];
}

/**
 * Diagnose follower counts and relationships for a user
 * @param username - Username to diagnose
 * @param checkFollowingUsername - Optional username to check if user is following
 */
export async function diagnoseFollowers(
  username: string,
  checkFollowingUsername?: string
): Promise<DiagnosticResult> {
  console.log('🔍 Starting follower diagnostic for:', username);

  try {
    // Step 1: Get user by username
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('username', '==', username));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      throw new Error(`User not found: ${username}`);
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();

    console.log('✅ Found user:', { userId, username: userData.username });

    // Step 2: Get stored counts from user document
    const storedFollowerCount = Number(userData.followerCount || 0);
    const storedFollowingCount = Number(userData.followingCount || 0);

    console.log('📊 Stored counts:', {
      followerCount: storedFollowerCount,
      followingCount: storedFollowingCount
    });

    // Step 3: Get actual followers from 'follows' collection
    const followsRef = collection(db, 'follows');
    const followersQuery = query(followsRef, where('followingId', '==', userId));
    const followersSnapshot = await getDocs(followersQuery);

    const actualFollowers = followersSnapshot.docs.map(doc => ({
      id: doc.id,
      followerId: doc.data().followerId,
      timestamp: doc.data().timestamp
    }));

    console.log(`👥 Actual followers (${actualFollowers.length}):`, actualFollowers);

    // Step 4: Get actual following from 'follows' collection
    const followingQuery = query(followsRef, where('followerId', '==', userId));
    const followingSnapshot = await getDocs(followingQuery);

    const actualFollowing = followingSnapshot.docs.map(doc => ({
      id: doc.id,
      followingId: doc.data().followingId,
      followingUsername: doc.data().followingUsername,
      timestamp: doc.data().timestamp
    }));

    console.log(`🔗 Actual following (${actualFollowing.length}):`, actualFollowing);

    // Step 5: Check if following specific user
    let isFollowingTarget = false;
    let targetUsername = checkFollowingUsername || '';

    if (checkFollowingUsername) {
      isFollowingTarget = actualFollowing.some(
        f => f.followingUsername === checkFollowingUsername
      );
      console.log(`🎯 Is following ${checkFollowingUsername}:`, isFollowingTarget);
    }

    // Step 6: Check for subcollections (should be empty if migration hasn't run)
    const followerSubcollectionRef = collection(db, `users/${userId}/followers`);
    const followerSubSnapshot = await getDocs(followerSubcollectionRef);

    const followingSubcollectionRef = collection(db, `users/${userId}/following`);
    const followingSubSnapshot = await getDocs(followingSubcollectionRef);

    console.log('📁 Subcollections:', {
      followersSubcollection: followerSubSnapshot.size,
      followingSubcollection: followingSubSnapshot.size
    });

    // Step 7: Identify discrepancies
    const discrepancies: string[] = [];

    if (storedFollowerCount !== actualFollowers.length) {
      discrepancies.push(
        `Follower count mismatch: stored=${storedFollowerCount}, actual=${actualFollowers.length}`
      );
    }

    if (storedFollowingCount !== actualFollowing.length) {
      discrepancies.push(
        `Following count mismatch: stored=${storedFollowingCount}, actual=${actualFollowing.length}`
      );
    }

    if (followerSubSnapshot.size === 0 && actualFollowers.length > 0) {
      discrepancies.push(
        'Followers exist in top-level collection but not in subcollection (Cloud Function not triggered)'
      );
    }

    if (followingSubSnapshot.size === 0 && actualFollowing.length > 0) {
      discrepancies.push(
        'Following exists in top-level collection but not in subcollection (Cloud Function not triggered)'
      );
    }

    // Step 8: Build result
    const result: DiagnosticResult = {
      username,
      userId,
      storedFollowerCount,
      storedFollowingCount,
      actualFollowers,
      actualFollowing,
      isFollowingTarget,
      targetUsername,
      discrepancies
    };

    // Step 9: Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(70));
    console.log(`User: ${username} (${userId})`);
    console.log(`\nStored Counts:`);
    console.log(`  Followers: ${storedFollowerCount}`);
    console.log(`  Following: ${storedFollowingCount}`);
    console.log(`\nActual Counts (from 'follows' collection):`);
    console.log(`  Followers: ${actualFollowers.length}`);
    console.log(`  Following: ${actualFollowing.length}`);

    if (checkFollowingUsername) {
      console.log(`\nFollow Check:`);
      console.log(`  Is following ${checkFollowingUsername}: ${isFollowingTarget ? '✅ YES' : '❌ NO'}`);
    }

    if (discrepancies.length > 0) {
      console.log(`\n⚠️  DISCREPANCIES FOUND:`);
      discrepancies.forEach((d, i) => {
        console.log(`  ${i + 1}. ${d}`);
      });
    } else {
      console.log(`\n✅ No discrepancies found!`);
    }

    console.log(`\nSubcollection Status:`);
    console.log(`  users/${userId}/followers: ${followerSubSnapshot.size} docs`);
    console.log(`  users/${userId}/following: ${followingSubSnapshot.size} docs`);

    if (actualFollowers.length > 0) {
      console.log(`\nFollowers:`);
      actualFollowers.forEach((f, i) => {
        console.log(`  ${i + 1}. followerId: ${f.followerId}`);
      });
    }

    if (actualFollowing.length > 0) {
      console.log(`\nFollowing:`);
      actualFollowing.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.followingUsername} (${f.followingId})`);
      });
    }

    console.log('='.repeat(70) + '\n');

    return result;

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    throw error;
  }
}

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).diagnoseFollowers = diagnoseFollowers;
}
