import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FirebaseReview } from '../services/reviewService';

interface ReviewState {
  // State
  reviews: FirebaseReview[];
  feedPosts: any[];
  renderedFeedPosts: any[]; // NEW: Memoized, ready-to-render feed posts
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  scrollPosition: number; // NEW: Saved scroll position for restoration

  // Actions
  setReviews: (reviews: FirebaseReview[]) => void;
  setFeedPosts: (posts: any[]) => void;
  setRenderedFeed: (posts: any[]) => void; // NEW: Set the rendered feed posts
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateLastFetched: () => void;
  clearCache: () => void;
  addReview: (review: FirebaseReview) => void;
  setScrollPosition: (position: number) => void; // NEW: Save scroll position

  // Helpers
  isStale: () => boolean;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      // Initial state
      reviews: [],
      feedPosts: [],
      renderedFeedPosts: [], // NEW: Memoized rendered posts
      loading: false,
      error: null,
      lastFetched: null,
      scrollPosition: 0, // NEW: Scroll position for restoration

      // Actions
      setReviews: (reviews) => set({ reviews }),

      setFeedPosts: (posts) => set({ feedPosts: posts }),

      // NEW: Set the rendered feed posts (already processed, ready to display)
      setRenderedFeed: (posts) => set({ renderedFeedPosts: posts }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      updateLastFetched: () => set({ lastFetched: Date.now() }),

      // NEW: Save scroll position for restoration on "Back"
      setScrollPosition: (position) => set({ scrollPosition: position }),

      clearCache: () => set({
        reviews: [],
        feedPosts: [],
        renderedFeedPosts: [], // NEW: Clear rendered feed on cache clear
        lastFetched: null,
        scrollPosition: 0, // NEW: Reset scroll position
        error: null
      }),

      addReview: (review) => set((state) => ({
        reviews: [review, ...state.reviews],
      })),

      // Helpers
      isStale: () => {
        const { lastFetched } = get();
        if (!lastFetched) return true;
        return Date.now() - lastFetched > CACHE_TTL_MS;
      }
    }),
    {
      name: 'tip-review-storage',
      // Persist feed data to prevent reload on navigation
      partialize: (state) => ({
        reviews: state.reviews,
        feedPosts: state.feedPosts,
        renderedFeedPosts: state.renderedFeedPosts,
        lastFetched: state.lastFetched,
        scrollPosition: state.scrollPosition,
      }),
    }
  )
);

// Helper to serialize Firestore Timestamps for storage
function serializeTimestamp(timestamp: any): any {
  if (!timestamp) return null;

  // Already serialized
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return timestamp;
  }

  // Firestore Timestamp with toDate method
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    try {
      return timestamp.toDate().toISOString();
    } catch {
      return Date.now();
    }
  }

  // Plain timestamp object: { seconds, nanoseconds }
  if (typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
    const ms = timestamp.seconds * 1000 + Math.floor(timestamp.nanoseconds / 1e6);
    return new Date(ms).toISOString();
  }

  // Date object
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  return timestamp;
}
