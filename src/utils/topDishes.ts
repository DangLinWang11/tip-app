import type { FirebaseReview } from '../services/reviewService';

export interface TopDish {
  dishId?: string;
  dishName: string;
  restaurantName?: string;
  averageRating: number;
  latestReviewDate: number;
  representativeReviewId: string;
}

const toMs = (value: any): number => {
  if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return value.seconds * 1000 + Math.floor(value.nanoseconds / 1e6);
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  return 0;
};

const normalizeDishName = (name?: string | null): string => {
  if (!name) return '';
  return name.trim().toLowerCase();
};

const buildFallbackKey = (review: FirebaseReview, dishName: string): string => {
  const restaurantKey = review.restaurantId || review.restaurant || 'unknown-restaurant';
  const dishKey = normalizeDishName(dishName) || 'unknown-dish';
  return `${restaurantKey}::${dishKey}`;
};

export const getTopDishes = (reviews: FirebaseReview[], limit: number): TopDish[] => {
  const buckets = new Map<string, {
    dishId?: string;
    dishName: string;
    restaurantName?: string;
    sumRating: number;
    count: number;
    latestReviewDate: number;
    representativeReviewId: string;
  }>();

  for (const review of reviews) {
    if ((review as any).isDeleted === true) continue;

    const rating = review.rating;
    if (typeof rating !== 'number' || !Number.isFinite(rating)) continue;

    const dishName = (review as any).dishName || review.dish || 'Unknown Dish';
    const restaurantName = review.restaurant || (review as any).restaurantName || undefined;
    const dishId = review.menuItemId || (review as any).dishId || undefined;
    const key = review.menuItemId || (review as any).dishId || buildFallbackKey(review, dishName);
    if (!key) continue;

    const createdAtMs = toMs(review.createdAt ?? review.timestamp);

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        dishId,
        dishName,
        restaurantName,
        sumRating: rating,
        count: 1,
        latestReviewDate: createdAtMs,
        representativeReviewId: review.id
      });
      continue;
    }

    existing.sumRating += rating;
    existing.count += 1;
    if (createdAtMs >= existing.latestReviewDate) {
      existing.latestReviewDate = createdAtMs;
      existing.representativeReviewId = review.id;
      existing.dishId = dishId || existing.dishId;
      existing.dishName = dishName || existing.dishName;
      existing.restaurantName = restaurantName || existing.restaurantName;
    }
  }

  const results: TopDish[] = Array.from(buckets.values()).map((bucket) => ({
    dishId: bucket.dishId,
    dishName: bucket.dishName,
    restaurantName: bucket.restaurantName,
    averageRating: bucket.count > 0 ? bucket.sumRating / bucket.count : 0,
    latestReviewDate: bucket.latestReviewDate,
    representativeReviewId: bucket.representativeReviewId
  }));

  results.sort((a, b) => {
    if (b.averageRating !== a.averageRating) {
      return b.averageRating - a.averageRating;
    }
    return b.latestReviewDate - a.latestReviewDate;
  });

  return results.slice(0, Math.max(0, limit));
};
