import { Timestamp, addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, where, limit } from 'firebase/firestore';
import { db, getCurrentUser } from '../lib/firebase';

export interface OwnedRestaurant {
  id: string;
  name: string;
  coverImage?: string;
}

export interface ReviewKpis {
  reviewCount: number;
  uniqueReviewers: number;
  reviewCountPrev: number;
  trendSeries: { date: string; count: number }[];
}

export interface TagCountsMap { [slug: string]: number }

export interface TopDishRow {
  dishId?: string | null;
  dishName: string;
  posts: number;
  avgRating?: number | null;
  topTags: string[];
}

export interface RecentPhotoItem { reviewId: string; url: string }

export async function getOwnedRestaurants(uid: string): Promise<OwnedRestaurant[]> {
  // Primary: new schema uses array field `ownerIds`
  const q1 = query(collection(db, 'restaurants'), where('ownerIds', 'array-contains', uid));
  // Fallback: older docs may use single `ownerUid`
  const q2 = query(collection(db, 'restaurants'), where('ownerUid', '==', uid));

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const map = new Map<string, OwnedRestaurant>();
  snap1.docs.forEach(d => {
    const data = d.data() as any;
    map.set(d.id, { id: d.id, name: data.name, coverImage: data.coverImage });
  });
  snap2.docs.forEach(d => {
    const data = d.data() as any;
    if (!map.has(d.id)) map.set(d.id, { id: d.id, name: data.name, coverImage: data.coverImage });
  });

  const list = Array.from(map.values());
  if (import.meta.env.DEV) {
    // Helpful debug in development to verify ownership resolution
    console.log('[OwnerPortal] getOwnedRestaurants resolved', { uid, count: list.length, ids: list.map(r => r.id) });
  }
  return list;
}

export async function getUserClaims(uid: string) {
  const q = query(
    collection(db, 'owner_claims'),
    where('requesterUid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

export async function submitOwnerClaim(input: { restaurantId: string; notes?: string; contactEmail?: string; supportingLink?: string; }) {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const payload = {
    restaurantId: input.restaurantId,
    requesterUid: user.uid,
    contactEmail: input.contactEmail || null,
    notes: input.notes || null,
    supportingLink: input.supportingLink || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return addDoc(collection(db, 'owner_claims'), payload);
}

export async function fetchRestaurantKpis(restaurantId: string, days = 30): Promise<{ kpis: ReviewKpis; tagCounts: TagCountsMap; topDishes: TopDishRow[]; photos: RecentPhotoItem[] }> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

  const reviewsRef = collection(db, 'reviews');

  // Current window
  const qCurrent = query(
    reviewsRef,
    where('restaurantId', '==', restaurantId),
    where('isDeleted', '==', false),
    where('createdAt', '>=', Timestamp.fromDate(start)),
    orderBy('createdAt', 'desc')
  );
  const snapCurrent = await getDocs(qCurrent);

  // Previous window
  const qPrev = query(
    reviewsRef,
    where('restaurantId', '==', restaurantId),
    where('isDeleted', '==', false),
    where('createdAt', '>=', Timestamp.fromDate(prevStart)),
    where('createdAt', '<', Timestamp.fromDate(start))
  );
  const snapPrev = await getDocs(qPrev);

  // Aggregate current window
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const seriesMap = new Map<string, number>();
  const reviewers = new Set<string>();
  const tagCounts: TagCountsMap = {};
  const dishes = new Map<string, { dishName: string; count: number; sumRating: number; tags: Record<string, number> }>();

  snapCurrent.forEach(docSnap => {
    const r = docSnap.data() as any;
    const createdAt = (r.createdAt && (r.createdAt as any).toDate) ? (r.createdAt as any).toDate() : new Date();
    const key = dayKey(createdAt);
    seriesMap.set(key, (seriesMap.get(key) || 0) + 1);
    if (r.userId) reviewers.add(r.userId);
    if (Array.isArray(r.tags)) r.tags.forEach((t: string) => tagCounts[t] = (tagCounts[t] || 0) + 1);
    const dishName = r.dish || r.dishName || 'Unknown Dish';
    const bucketKey = String(r.menuItemId || dishName);
    const bucket = dishes.get(bucketKey) || { dishName, count: 0, sumRating: 0, tags: {} };
    bucket.count += 1;
    bucket.sumRating += typeof r.rating === 'number' ? r.rating : 0;
    if (Array.isArray(r.tags)) r.tags.forEach((t: string) => bucket.tags[t] = (bucket.tags[t] || 0) + 1);
    dishes.set(bucketKey, bucket);
  });

  const trendSeries: { date: string; count: number }[] = Array.from(seriesMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  const kpis: ReviewKpis = {
    reviewCount: snapCurrent.size,
    uniqueReviewers: reviewers.size,
    reviewCountPrev: snapPrev.size,
    trendSeries,
  };

  // Top dishes
  const topDishes: TopDishRow[] = Array.from(dishes.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(d => ({
      dishName: d.dishName,
      posts: d.count,
      avgRating: d.count > 0 ? Number((d.sumRating / d.count).toFixed(2)) : null,
      topTags: Object.entries(d.tags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)
    }));

  // Recent photos
  const qPhotos = query(
    reviewsRef,
    where('restaurantId', '==', restaurantId),
    where('isDeleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snapPhotos = await getDocs(qPhotos);
  const photos: RecentPhotoItem[] = [];
  snapPhotos.forEach(d => {
    const r = d.data() as any;
    const images: string[] = r.media?.photos && Array.isArray(r.media.photos) && r.media.photos.length > 0
      ? r.media.photos
      : (Array.isArray(r.images) ? r.images : []);
    if (images.length > 0) {
      images.slice(0, 3).forEach(u => photos.push({ reviewId: d.id, url: u }));
    }
  });

  return { kpis, tagCounts, topDishes, photos: photos.slice(0, 12) };
}

export async function upsertRestaurantStatsCache(restaurantId: string, data: any) {
  await setDoc(doc(db, 'restaurant_stats', restaurantId), {
    ...data,
    lastUpdated: serverTimestamp(),
  }, { merge: true });
}

export function isStale(lastUpdated?: Timestamp | null) {
  try {
    if (!lastUpdated || !('toMillis' in (lastUpdated as any))) return true;
    const ms = (lastUpdated as any).toMillis();
    return (Date.now() - ms) > 6 * 60 * 60 * 1000; // 6h
  } catch { return true; }
}

export async function getOrUpdateStatsCache(restaurantId: string, compute: () => Promise<any>, force = false) {
  const ref = doc(db, 'restaurant_stats', restaurantId);
  const snap = await getDoc(ref);
  const cached = snap.exists() ? snap.data() as any : null;
  if (!force && cached && !isStale(cached.lastUpdated)) {
    return cached;
  }
  const data = await compute();
  await upsertRestaurantStatsCache(restaurantId, data);
  return data;
}
