/*
 One-time backfill: normalize review.tags entries to slugs using TAG_CATALOG.

 Scope: /reviews/* where tags contains labels instead of slugs.
 Action: map known labels (case-insensitive) to slugs, update doc if changes.

 Usage:
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
   node tip/scripts/backfillTags.js [--project your-project-id] [--dry-run]
*/

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Load tag catalog from source file at runtime
const TAGS_PATH = path.resolve(process.cwd(), 'tip', 'src', 'constants', 'tags.ts');

// Minimal inline catalog fallback if TS import is not possible in this context
const FALLBACK_CATALOG = {
  value: [
    { slug: 'good_value', label: 'Good value' },
    { slug: 'overpriced', label: 'Overpriced' },
  ],
  freshness: [
    { slug: 'very_fresh', label: 'Very fresh' },
    { slug: 'not_fresh', label: 'Not fresh' },
  ],
  spiciness: [
    { slug: 'spicy_lovers', label: 'Spicy lovers' },
    { slug: 'too_spicy', label: 'Too spicy' },
    { slug: 'mild', label: 'Mild' },
  ],
  temperature: [
    { slug: 'served_hot', label: 'Served hot' },
    { slug: 'served_cold', label: 'Served cold' },
    { slug: 'lukewarm', label: 'Lukewarm' },
  ],
};

const ALL = Object.values(FALLBACK_CATALOG).flat();
const byLabel = new Map(ALL.map(t => [t.label.toLowerCase(), t.slug]));
const bySlug = new Set(ALL.map(t => t.slug));

const args = process.argv.slice(2);
const projectArgIndex = args.indexOf('--project');
const projectId = projectArgIndex >= 0 ? args[projectArgIndex + 1] : process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || undefined;
const dryRun = args.includes('--dry-run');

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  const db = admin.firestore();

  const reviewsRef = db.collection('reviews');
  const snap = await reviewsRef.select('tags').get();

  let toUpdate = [];
  snap.forEach(doc => {
    const data = doc.data() || {};
    const tags = Array.isArray(data.tags) ? data.tags : [];
    if (tags.length === 0) return;
    let changed = false;
    const normalized = tags.map((v) => {
      const str = String(v || '').trim();
      if (!str) return str;
      // if already a known slug, keep
      if (bySlug.has(str)) return str;
      // try label match
      const slug = byLabel.get(str.toLowerCase());
      if (slug) {
        changed = true;
        return slug;
      }
      return str; // leave unknown values as-is
    });
    if (changed) toUpdate.push({ id: doc.id, tags: Array.from(new Set(normalized)) });
  });

  console.log(`Found ${toUpdate.length} docs with label-based tags to normalize`);
  console.log('Sample up to 10:', toUpdate.slice(0, 10));

  if (dryRun || toUpdate.length === 0) {
    console.log(dryRun ? '[DRY RUN] Skipping updates' : 'No updates needed');
    return;
  }

  let updated = 0;
  const chunkSize = 400;
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach(item => batch.update(reviewsRef.doc(item.id), { tags: item.tags }));
    await batch.commit();
    updated += chunk.length;
    console.log(`Updated ${updated}/${toUpdate.length} so far...`);
  }

  console.log(`Backfill complete: updated ${updated} reviews.`);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});

