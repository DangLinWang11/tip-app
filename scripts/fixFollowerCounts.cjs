/*
  fixFollowerCounts.cjs

  CommonJS Admin SDK script to diagnose and repair follower/following counts.

  Problem:
    - Client code writes follows to top-level 'follows' collection
    - Cloud Function expects follows in users/{userId}/followers/{followerId} subcollections
    - Result: Cloud Function never triggers, counts never update

  Modes:
    (none)          Diagnostic only - show current state, no changes
    --fix-counts    Fix counts on user document (quick fix)
    --migrate       Migrate to subcollections (complete fix)
    --dry-run       Show planned changes, no writes (default)
    --commit        Apply changes to database

  Options:
    --username <name>      Look up user by username instead of userId
    --check-follow <name>  Check if user is following specific username
    --batch <n>            Max ops per batch (default 400)

  Usage:
    # Diagnostic only (read-only)
    node scripts/fixFollowerCounts.cjs <userId>
    node scripts/fixFollowerCounts.cjs --username br12_e

    # Fix counts only (quick fix)
    node scripts/fixFollowerCounts.cjs <userId> --fix-counts --commit

    # Migrate to subcollections (complete fix)
    node scripts/fixFollowerCounts.cjs <userId> --migrate --commit
*/

const admin = require('firebase-admin');

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function parseArgs(argv) {
  const out = {
    mode: 'diagnostic', // diagnostic, fix-counts, migrate
    commit: false,
    userId: null,
    username: null,
    checkFollow: null,
    batchSize: 400,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.commit = false;
    else if (a === '--commit') out.commit = true;
    else if (a === '--fix-counts') out.mode = 'fix-counts';
    else if (a === '--migrate') out.mode = 'migrate';
    else if (a === '--username' && argv[i + 1]) out.username = String(argv[++i]);
    else if (a === '--check-follow' && argv[i + 1]) out.checkFollow = String(argv[++i]);
    else if (a === '--batch' && argv[i + 1]) out.batchSize = Math.max(1, Math.min(500, Number(argv[++i]) || 400));
    else if (!a.startsWith('--') && !out.userId) out.userId = a;
  }

  return out;
}

function initAdmin() {
  if (!admin.apps.length) admin.initializeApp();
}

function log(msg, color = null) {
  if (color && COLORS[color]) {
    console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
  } else {
    console.log(msg);
  }
}

function logSection(title) {
  log('', 'reset');
  log('─'.repeat(60), 'gray');
  log(title, 'bright');
  log('─'.repeat(60), 'gray');
}

function logHeader(title) {
  log('', 'reset');
  log('═'.repeat(60), 'cyan');
  log(title, 'bright');
  log('═'.repeat(60), 'cyan');
}

// Look up user by username
async function getUserByUsername(db, username) {
  try {
    const usersRef = db.collection('users');
    const q = usersRef.where('username', '==', username).limit(1);
    const snap = await q.get();

    if (snap.empty) {
      return null;
    }

    const doc = snap.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('Error looking up user by username:', error);
    return null;
  }
}

// Get user by ID
async function getUserById(db, userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

// Get stored counts from user document
async function getStoredCounts(db, userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { followers: 0, following: 0 };
    }

    const data = userDoc.data();
    return {
      followers: Number(data.followerCount || 0),
      following: Number(data.followingCount || 0)
    };
  } catch (error) {
    console.error('Error getting stored counts:', error);
    return { followers: 0, following: 0 };
  }
}

// Get actual counts from follows collection
async function getActualCounts(db, userId) {
  try {
    const followsRef = db.collection('follows');

    // Count followers (where followingId == userId)
    const followersQ = followsRef.where('followingId', '==', userId);
    const followersSnap = await followersQ.get();

    // Count following (where followerId == userId)
    const followingQ = followsRef.where('followerId', '==', userId);
    const followingSnap = await followingQ.get();

    return {
      followers: followersSnap.size,
      following: followingSnap.size
    };
  } catch (error) {
    console.error('Error getting actual counts:', error);
    return { followers: 0, following: 0 };
  }
}

// Get list of followers
async function getFollowers(db, userId) {
  try {
    const followsRef = db.collection('follows');
    const q = followsRef.where('followingId', '==', userId);
    const snap = await q.get();

    return snap.docs.map(doc => ({
      id: doc.id,
      followerId: doc.data().followerId,
      followingId: doc.data().followingId,
      followingUsername: doc.data().followingUsername,
      timestamp: doc.data().timestamp
    }));
  } catch (error) {
    console.error('Error getting followers:', error);
    return [];
  }
}

// Get list of following
async function getFollowing(db, userId) {
  try {
    const followsRef = db.collection('follows');
    const q = followsRef.where('followerId', '==', userId);
    const snap = await q.get();

    return snap.docs.map(doc => ({
      id: doc.id,
      followerId: doc.data().followerId,
      followingId: doc.data().followingId,
      followingUsername: doc.data().followingUsername,
      timestamp: doc.data().timestamp
    }));
  } catch (error) {
    console.error('Error getting following:', error);
    return [];
  }
}

// Check if user is following a specific username
async function checkFollowRelationship(db, userId, targetUsername) {
  try {
    // First, look up target user by username
    const targetUser = await getUserByUsername(db, targetUsername);
    if (!targetUser) {
      return { exists: false, reason: 'target user not found' };
    }

    // Check if follow relationship exists
    const followsRef = db.collection('follows');
    const q = followsRef
      .where('followerId', '==', userId)
      .where('followingId', '==', targetUser.id)
      .limit(1);

    const snap = await q.get();

    return {
      exists: !snap.empty,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      targetDisplayName: targetUser.displayName
    };
  } catch (error) {
    console.error('Error checking follow relationship:', error);
    return { exists: false, reason: 'error' };
  }
}

// Check for subcollection data
async function checkSubcollections(db, userId) {
  try {
    const followersSnap = await db.collection('users').doc(userId).collection('followers').limit(1).get();
    const followingSnap = await db.collection('users').doc(userId).collection('following').limit(1).get();

    return {
      hasFollowers: !followersSnap.empty,
      hasFollowing: !followingSnap.empty,
      followersCount: followersSnap.size,
      followingCount: followingSnap.size
    };
  } catch (error) {
    console.error('Error checking subcollections:', error);
    return {
      hasFollowers: false,
      hasFollowing: false,
      followersCount: 0,
      followingCount: 0
    };
  }
}

// Gather all diagnostic information
async function getDiagnostics(db, userId, checkFollowUsername) {
  const user = await getUserById(db, userId);
  if (!user) {
    return null;
  }

  const [storedCounts, actualCounts, followers, following, subcollections] = await Promise.all([
    getStoredCounts(db, userId),
    getActualCounts(db, userId),
    getFollowers(db, userId),
    getFollowing(db, userId),
    checkSubcollections(db, userId)
  ]);

  let followCheck = null;
  if (checkFollowUsername) {
    followCheck = await checkFollowRelationship(db, userId, checkFollowUsername);
  }

  return {
    user,
    storedCounts,
    actualCounts,
    followers,
    following,
    subcollections,
    followCheck
  };
}

// Print diagnostic report
function printDiagnosticReport(diagnostics, checkFollowUsername) {
  const { user, storedCounts, actualCounts, followers, following, subcollections, followCheck } = diagnostics;

  logHeader('FOLLOWER SYSTEM DIAGNOSTIC REPORT');
  log(`User: ${user.username || 'N/A'} (${user.displayName || 'N/A'})`, 'cyan');
  log(`User ID: ${user.id}`, 'gray');
  log(`Date: ${new Date().toISOString()}`, 'gray');

  logSection('CURRENT STATE (from user document)');
  log(`Stored follower count:   ${storedCounts.followers}`);
  log(`Stored following count:  ${storedCounts.following}`);

  logSection('ACTUAL STATE (from \'follows\' collection)');
  const followerDiff = actualCounts.followers - storedCounts.followers;
  const followingDiff = actualCounts.following - storedCounts.following;

  if (followerDiff !== 0) {
    log(`Actual follower count:   ${actualCounts.followers}  ⚠️  MISMATCH! (${followerDiff > 0 ? '+' : ''}${followerDiff})`, 'red');
  } else {
    log(`Actual follower count:   ${actualCounts.followers}  ✓ OK`, 'green');
  }

  if (followingDiff !== 0) {
    log(`Actual following count:  ${actualCounts.following}  ⚠️  MISMATCH! (${followingDiff > 0 ? '+' : ''}${followingDiff})`, 'red');
  } else {
    log(`Actual following count:  ${actualCounts.following}  ✓ OK`, 'green');
  }

  logSection(`FOLLOWERS (${followers.length} users following ${user.username})`);
  if (followers.length > 0) {
    followers.forEach((f, i) => {
      const ts = f.timestamp ? new Date(f.timestamp.toDate()).toLocaleString() : 'N/A';
      log(`${i + 1}. ${f.followerId} - followed on ${ts}`, 'gray');
    });
  } else {
    log('No followers found', 'gray');
  }

  logSection(`FOLLOWING (${following.length} users ${user.username} is following)`);
  if (following.length > 0) {
    following.forEach((f, i) => {
      const ts = f.timestamp ? new Date(f.timestamp.toDate()).toLocaleString() : 'N/A';
      const username = f.followingUsername || 'unknown';
      log(`${i + 1}. ${f.followingId} (${username}) - followed on ${ts}`, 'gray');
    });
  } else {
    log('No following found', 'gray');
  }

  if (checkFollowUsername && followCheck) {
    logSection(`SPECIFIC FOLLOW CHECK: "${checkFollowUsername}"`);
    if (followCheck.exists) {
      log(`✓ User ${user.username} IS following ${checkFollowUsername} (${followCheck.targetUserId})`, 'green');
    } else {
      log(`✗ User ${user.username} is NOT following ${checkFollowUsername}`, 'red');
      if (followCheck.reason) {
        log(`  Reason: ${followCheck.reason}`, 'gray');
      }
    }
  }

  logSection('SUBCOLLECTION CHECK');
  log(`Subcollection followers: ${subcollections.followersCount} documents`);
  log(`Subcollection following: ${subcollections.followingCount} documents`);
  if (!subcollections.hasFollowers && !subcollections.hasFollowing) {
    log('⚠️  WARNING: Cloud Function expects subcollections but they\'re empty!', 'yellow');
  }

  logHeader('RECOMMENDED ACTIONS');
  if (followerDiff !== 0 || followingDiff !== 0) {
    log('Discrepancy detected! Choose one of the following:', 'yellow');
    log('', 'reset');
    log('1. Run with --fix-counts --commit for quick fix', 'cyan');
    log('   This will:', 'gray');
    log(`   - Update followerCount to ${actualCounts.followers}`, 'gray');
    log(`   - Update followingCount to ${actualCounts.following}`, 'gray');
    log('   - But Cloud Function will still not trigger in future', 'gray');
    log('', 'reset');
    log('2. Run with --migrate --commit for complete fix', 'cyan');
    log('   This will:', 'gray');
    log('   - Create proper subcollections for all follow relationships', 'gray');
    log('   - Trigger Cloud Function to update counts automatically', 'gray');
    log('   - Ensure future follows work correctly', 'gray');
  } else {
    log('✓ Counts are in sync! No action needed.', 'green');
  }

  logHeader('DRY-RUN MODE: No changes made');
  log('Use --commit flag to apply changes', 'gray');
}

// Fix counts only (update user document)
async function fixCountsOnly(db, userId, actualCounts, commit) {
  try {
    logHeader('FIX COUNTS MODE');

    if (!commit) {
      log('[DRY-RUN] Would update user document:', 'yellow');
      log(`  followerCount: ${actualCounts.followers}`, 'gray');
      log(`  followingCount: ${actualCounts.following}`, 'gray');
      log(`  updatedAt: <server timestamp>`, 'gray');
      return { success: true, dryRun: true };
    }

    log('Updating user document...', 'cyan');
    await db.collection('users').doc(userId).update({
      followerCount: actualCounts.followers,
      followingCount: actualCounts.following,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    log('✓ User document updated successfully', 'green');
    return { success: true, dryRun: false };
  } catch (error) {
    log(`✗ Error updating user document: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// Migrate to subcollections (complete fix)
async function migrateToSubcollections(db, userId, followers, following, commit, batchSize) {
  try {
    logHeader('MIGRATE TO SUBCOLLECTIONS MODE');

    const totalOps = followers.length + following.length;
    log(`Total operations: ${totalOps}`, 'cyan');
    log(`Batch size: ${batchSize}`, 'gray');

    if (!commit) {
      log('[DRY-RUN] Would create the following subcollection documents:', 'yellow');
      log('', 'reset');
      log('Followers:', 'cyan');
      followers.forEach((f, i) => {
        log(`  ${i + 1}. users/${userId}/followers/${f.followerId}`, 'gray');
      });
      log('', 'reset');
      log('Following:', 'cyan');
      following.forEach((f, i) => {
        log(`  ${i + 1}. users/${userId}/following/${f.followingId}`, 'gray');
      });
      return { success: true, dryRun: true };
    }

    let batch = db.batch();
    let batchOps = 0;
    let totalCreated = 0;

    const flush = async () => {
      if (batchOps === 0) return;
      await batch.commit();
      log(`✓ Batch committed (${batchOps} ops)`, 'green');
      batch = db.batch();
      batchOps = 0;
    };

    // Create follower subcollection documents
    log('Creating follower subcollection documents...', 'cyan');
    for (const follower of followers) {
      const followerRef = db.collection('users').doc(userId).collection('followers').doc(follower.followerId);
      batch.set(followerRef, {
        followerId: follower.followerId,
        timestamp: follower.timestamp || admin.firestore.FieldValue.serverTimestamp()
      });
      batchOps++;
      totalCreated++;

      if (batchOps >= batchSize) {
        await flush();
      }
    }

    // Create following subcollection documents
    log('Creating following subcollection documents...', 'cyan');
    for (const follow of following) {
      const followingRef = db.collection('users').doc(userId).collection('following').doc(follow.followingId);
      batch.set(followingRef, {
        followingId: follow.followingId,
        followingUsername: follow.followingUsername,
        timestamp: follow.timestamp || admin.firestore.FieldValue.serverTimestamp()
      });
      batchOps++;
      totalCreated++;

      if (batchOps >= batchSize) {
        await flush();
      }
    }

    await flush();

    log(`✓ Migration complete! Created ${totalCreated} subcollection documents`, 'green');
    log('  Note: Cloud Function will update counts automatically', 'gray');

    return { success: true, dryRun: false, totalCreated };
  } catch (error) {
    log(`✗ Error during migration: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  const args = parseArgs(process.argv);

  // Validate arguments
  if (!args.userId && !args.username) {
    console.error('Error: Must specify userId or --username <name>');
    console.error('Usage: node scripts/fixFollowerCounts.cjs <userId>');
    console.error('   or: node scripts/fixFollowerCounts.cjs --username <name>');
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();

  // Resolve user
  let user;
  if (args.username) {
    log(`Looking up user by username: ${args.username}`, 'cyan');
    user = await getUserByUsername(db, args.username);
    if (!user) {
      log(`Error: User not found with username "${args.username}"`, 'red');
      process.exit(1);
    }
    args.userId = user.id;
  } else {
    user = await getUserById(db, args.userId);
    if (!user) {
      log(`Error: User not found with ID "${args.userId}"`, 'red');
      process.exit(1);
    }
  }

  // Gather diagnostics
  log('Gathering diagnostic information...', 'cyan');
  const diagnostics = await getDiagnostics(db, args.userId, args.checkFollow);

  if (!diagnostics) {
    log('Error: Could not gather diagnostics', 'red');
    process.exit(1);
  }

  // Print report
  printDiagnosticReport(diagnostics, args.checkFollow);

  // Execute repair if requested
  if (args.mode === 'fix-counts') {
    log('', 'reset');
    const result = await fixCountsOnly(db, args.userId, diagnostics.actualCounts, args.commit);
    if (!result.success) {
      process.exit(1);
    }
  } else if (args.mode === 'migrate') {
    log('', 'reset');
    const result = await migrateToSubcollections(
      db,
      args.userId,
      diagnostics.followers,
      diagnostics.following,
      args.commit,
      args.batchSize
    );
    if (!result.success) {
      process.exit(1);
    }
  }

  log('', 'reset');
  log('Done!', 'green');
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
