/*
  fixAllFollowerCounts.cjs

  Batch migration script to fix follower counts for ALL users in the system.

  Problem:
    - Client code writes follows to top-level 'follows' collection
    - Cloud Function expects follows in users/{userId}/followers/{followerId} subcollections
    - This script migrates ALL users to the correct structure

  Modes:
    --dry-run    Show what would be migrated, no changes (DEFAULT)
    --commit     Actually perform the migration

  Options:
    --batch <n>  Max ops per Firestore batch (default 400)
    --limit <n>  Only process first N users (for testing)

  Usage:
    # Dry-run (safe, shows what would happen)
    node scripts/fixAllFollowerCounts.cjs

    # Actually migrate all users
    node scripts/fixAllFollowerCounts.cjs --commit

    # Test with first 10 users
    node scripts/fixAllFollowerCounts.cjs --commit --limit 10
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
    commit: false,
    batchSize: 400,
    userLimit: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.commit = false;
    else if (a === '--commit') out.commit = true;
    else if (a === '--batch' && argv[i + 1]) out.batchSize = Math.max(1, Math.min(500, Number(argv[++i]) || 400));
    else if (a === '--limit' && argv[i + 1]) out.userLimit = Math.max(1, Number(argv[++i]));
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

function logHeader(title) {
  log('', 'reset');
  log('═'.repeat(70), 'cyan');
  log(title, 'bright');
  log('═'.repeat(70), 'cyan');
}

function logSection(title) {
  log('', 'reset');
  log('─'.repeat(70), 'gray');
  log(title, 'bright');
  log('─'.repeat(70), 'gray');
}

// Get all users from Firestore
async function getAllUsers(db, limit) {
  try {
    let query = db.collection('users');
    if (limit) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
}

// Get followers for a user from top-level follows collection
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
    console.error(`Error getting followers for ${userId}:`, error);
    return [];
  }
}

// Get following for a user from top-level follows collection
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
    console.error(`Error getting following for ${userId}:`, error);
    return [];
  }
}

// Migrate a single user to subcollections
async function migrateUser(db, user, followers, following, commit, batchSize) {
  try {
    const totalOps = followers.length + following.length;

    if (totalOps === 0) {
      return {
        success: true,
        skipped: true,
        docsCreated: 0,
        reason: 'no follows to migrate'
      };
    }

    if (!commit) {
      // Dry-run mode
      return {
        success: true,
        dryRun: true,
        docsCreated: totalOps,
        followers: followers.length,
        following: following.length
      };
    }

    let batch = db.batch();
    let batchOps = 0;
    let totalCreated = 0;

    const flush = async () => {
      if (batchOps === 0) return;
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    };

    // Create follower subcollection documents
    for (const follower of followers) {
      const followerRef = db.collection('users').doc(user.id).collection('followers').doc(follower.followerId);
      batch.set(followerRef, {
        followerId: follower.followerId,
        timestamp: follower.timestamp || admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true }); // Use merge to avoid overwriting if already exists
      batchOps++;
      totalCreated++;

      if (batchOps >= batchSize) {
        await flush();
      }
    }

    // Create following subcollection documents
    for (const follow of following) {
      const followingRef = db.collection('users').doc(user.id).collection('following').doc(follow.followingId);
      batch.set(followingRef, {
        followingId: follow.followingId,
        followingUsername: follow.followingUsername,
        timestamp: follow.timestamp || admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true }); // Use merge to avoid overwriting if already exists
      batchOps++;
      totalCreated++;

      if (batchOps >= batchSize) {
        await flush();
      }
    }

    await flush();

    return {
      success: true,
      docsCreated: totalCreated,
      followers: followers.length,
      following: following.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  const args = parseArgs(process.argv);

  initAdmin();
  const db = admin.firestore();

  logHeader('BATCH FOLLOWER MIGRATION SCRIPT');
  log(`Mode: ${args.commit ? 'COMMIT (making changes)' : 'DRY-RUN (no changes)'}`, args.commit ? 'green' : 'yellow');
  log(`Batch size: ${args.batchSize}`, 'gray');
  if (args.userLimit) {
    log(`User limit: ${args.userLimit} users`, 'yellow');
  }

  // Get all users
  log('', 'reset');
  log('Fetching users...', 'cyan');
  const users = await getAllUsers(db, args.userLimit);

  if (users.length === 0) {
    log('No users found!', 'red');
    process.exit(1);
  }

  log(`Found ${users.length} users to process`, 'green');

  // Statistics
  let processed = 0;
  let successful = 0;
  let skipped = 0;
  let failed = 0;
  let totalDocsCreated = 0;
  const failedUsers = [];

  logSection('PROCESSING USERS');

  for (const user of users) {
    processed++;
    const username = user.username || 'unknown';
    const displayName = user.displayName || 'N/A';

    log(`Processing user ${processed}/${users.length}: ${username} (${user.id})`, 'cyan');

    try {
      // Get followers and following for this user
      const [followers, following] = await Promise.all([
        getFollowers(db, user.id),
        getFollowing(db, user.id)
      ]);

      const totalFollows = followers.length + following.length;

      if (totalFollows === 0) {
        log(`  ↳ No follows to migrate`, 'gray');
        skipped++;
        continue;
      }

      log(`  ↳ Followers: ${followers.length}, Following: ${following.length}`, 'gray');

      // Migrate this user
      const result = await migrateUser(db, user, followers, following, args.commit, args.batchSize);

      if (result.skipped) {
        log(`  ↳ Skipped: ${result.reason}`, 'yellow');
        skipped++;
      } else if (result.dryRun) {
        log(`  ↳ [DRY-RUN] Would create ${result.docsCreated} subcollection documents`, 'yellow');
        successful++;
        totalDocsCreated += result.docsCreated;
      } else if (result.success) {
        log(`  ↳ ✓ Created ${result.docsCreated} subcollection documents`, 'green');
        successful++;
        totalDocsCreated += result.docsCreated;
      } else {
        log(`  ↳ ✗ Failed: ${result.error}`, 'red');
        failed++;
        failedUsers.push({ id: user.id, username, error: result.error });
      }
    } catch (error) {
      log(`  ↳ ✗ Error: ${error.message}`, 'red');
      failed++;
      failedUsers.push({ id: user.id, username, error: error.message });
    }

    // Progress update every 10 users
    if (processed % 10 === 0 && processed < users.length) {
      log(`  Progress: ${processed}/${users.length} users processed...`, 'gray');
    }
  }

  // Final summary
  logHeader('MIGRATION SUMMARY');
  log(`Total users processed:        ${processed}`, 'bright');
  log(`Successful migrations:        ${successful}`, 'green');
  log(`Skipped (no follows):         ${skipped}`, 'gray');
  log(`Failed migrations:            ${failed}`, failed > 0 ? 'red' : 'gray');
  log(`Total docs created:           ${totalDocsCreated}`, 'cyan');

  if (failedUsers.length > 0) {
    logSection('FAILED USERS');
    failedUsers.forEach((user, i) => {
      log(`${i + 1}. ${user.username} (${user.id})`, 'red');
      log(`   Error: ${user.error}`, 'gray');
    });
  }

  if (!args.commit) {
    log('', 'reset');
    log('⚠️  DRY-RUN MODE: No changes were made', 'yellow');
    log('Use --commit flag to actually perform the migration', 'gray');
  } else {
    log('', 'reset');
    log('✓ Migration complete!', 'green');
    log('Note: Cloud Function will update counts automatically for new follows', 'gray');
  }

  log('', 'reset');
  log('Done!', 'green');
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
