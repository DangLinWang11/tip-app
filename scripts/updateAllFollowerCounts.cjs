/*
  updateAllFollowerCounts.cjs

  Script to update follower/following counts on user documents from subcollections.

  This script:
  1. Queries ALL users from 'users' collection
  2. For each user:
     - Counts documents in users/{userId}/followers subcollection
     - Counts documents in users/{userId}/following subcollection
     - Updates the user document's followerCount and followingCount with these counts
  3. Shows progress with usernames and counts
  4. Uses Firestore batch writes for efficiency (max 500 ops per batch)
  5. Shows summary at the end

  Modes:
    --dry-run    Show what would be updated, no changes (DEFAULT)
    --commit     Actually perform the updates

  Options:
    --batch <n>  Max ops per Firestore batch (default 400)
    --limit <n>  Only process first N users (for testing)

  Usage:
    # Dry-run (safe, shows what would happen)
    node scripts/updateAllFollowerCounts.cjs

    # Actually update all users
    node scripts/updateAllFollowerCounts.cjs --commit

    # Test with first 10 users
    node scripts/updateAllFollowerCounts.cjs --commit --limit 10
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

// Get follower/following counts from subcollections
async function getSubcollectionCounts(db, userId) {
  try {
    const [followersSnap, followingSnap] = await Promise.all([
      db.collection('users').doc(userId).collection('followers').get(),
      db.collection('users').doc(userId).collection('following').get()
    ]);

    return {
      followers: followersSnap.size,
      following: followingSnap.size
    };
  } catch (error) {
    console.error(`Error getting subcollection counts for ${userId}:`, error);
    return { followers: 0, following: 0 };
  }
}

// Update a single user's counts
async function updateUserCounts(db, user, actualCounts, commit, batch, batchOps) {
  try {
    const storedFollowers = Number(user.followerCount || 0);
    const storedFollowing = Number(user.followingCount || 0);

    const followersMatch = storedFollowers === actualCounts.followers;
    const followingMatch = storedFollowing === actualCounts.following;

    if (followersMatch && followingMatch) {
      return {
        success: true,
        skipped: true,
        reason: 'counts already correct'
      };
    }

    if (!commit) {
      // Dry-run mode
      return {
        success: true,
        dryRun: true,
        updated: true,
        oldCounts: { followers: storedFollowers, following: storedFollowing },
        newCounts: actualCounts
      };
    }

    // Update user document with new counts
    const userRef = db.collection('users').doc(user.id);
    batch.update(userRef, {
      followerCount: actualCounts.followers,
      followingCount: actualCounts.following,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      updated: true,
      oldCounts: { followers: storedFollowers, following: storedFollowing },
      newCounts: actualCounts,
      batchOpsIncremented: true
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

  logHeader('UPDATE FOLLOWER COUNTS SCRIPT');
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
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const failedUsers = [];

  let batch = db.batch();
  let batchOps = 0;

  const flush = async () => {
    if (!args.commit || batchOps === 0) return;
    await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  logSection('PROCESSING USERS');

  for (const user of users) {
    processed++;
    const username = user.username || 'unknown';
    const displayName = user.displayName || 'N/A';

    log(`Processing user ${processed}/${users.length}: ${username} (${user.id})`, 'cyan');

    try {
      // Get actual counts from subcollections
      const actualCounts = await getSubcollectionCounts(db, user.id);

      log(`  ↳ Subcollections - Followers: ${actualCounts.followers}, Following: ${actualCounts.following}`, 'gray');

      // Update user counts
      const result = await updateUserCounts(db, user, actualCounts, args.commit, batch, batchOps);

      if (result.skipped) {
        log(`  ↳ Skipped: ${result.reason}`, 'gray');
        skipped++;
      } else if (result.dryRun) {
        log(`  ↳ [DRY-RUN] Would update: ${result.oldCounts.followers}→${result.newCounts.followers} followers, ${result.oldCounts.following}→${result.newCounts.following} following`, 'yellow');
        updated++;
      } else if (result.success && result.updated) {
        log(`  ↳ ✓ Updated: ${result.oldCounts.followers}→${result.newCounts.followers} followers, ${result.oldCounts.following}→${result.newCounts.following} following`, 'green');
        updated++;
        if (result.batchOpsIncremented) {
          batchOps++;
        }

        // Flush batch if needed
        if (batchOps >= args.batchSize) {
          await flush();
        }
      } else if (!result.success) {
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

  // Flush remaining batch operations
  await flush();

  // Final summary
  logHeader('UPDATE SUMMARY');
  log(`Total users processed:        ${processed}`, 'bright');
  log(`Users updated:                ${updated}`, 'green');
  log(`Users skipped (already OK):   ${skipped}`, 'gray');
  log(`Failed updates:               ${failed}`, failed > 0 ? 'red' : 'gray');

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
    log('Use --commit flag to actually perform the updates', 'gray');
  } else {
    log('', 'reset');
    log('✓ Update complete!', 'green');
    log('User follower/following counts have been synchronized with subcollections', 'gray');
  }

  log('', 'reset');
  log('Done!', 'green');
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
