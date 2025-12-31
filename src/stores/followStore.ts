import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FollowState {
  // State - Set of user IDs that the current user is following
  followingIds: Set<string>;
  lastFetched: number | null;

  // Actions
  setFollowingIds: (ids: Set<string>) => void;
  addFollowing: (userId: string) => void;
  removeFollowing: (userId: string) => void;
  clearFollowing: () => void;
  updateLastFetched: () => void;

  // Helpers
  isFollowing: (userId: string) => boolean;
  isStale: () => boolean;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const useFollowStore = create<FollowState>()(
  persist(
    (set, get) => ({
      // Initial state
      followingIds: new Set(),
      lastFetched: null,

      // Actions
      setFollowingIds: (ids) => set({ followingIds: ids }),

      addFollowing: (userId) => set((state) => {
        const newSet = new Set(state.followingIds);
        newSet.add(userId);
        return { followingIds: newSet };
      }),

      removeFollowing: (userId) => set((state) => {
        const newSet = new Set(state.followingIds);
        newSet.delete(userId);
        return { followingIds: newSet };
      }),

      clearFollowing: () => set({ followingIds: new Set(), lastFetched: null }),

      updateLastFetched: () => set({ lastFetched: Date.now() }),

      // Helpers
      isFollowing: (userId) => {
        const { followingIds } = get();
        return followingIds.has(userId);
      },

      isStale: () => {
        const { lastFetched } = get();
        if (!lastFetched) return true;
        return Date.now() - lastFetched > CACHE_TTL_MS;
      }
    }),
    {
      name: 'tip-follow-storage',
      partialize: (state) => ({
        // Convert Set to Array for JSON serialization
        followingIds: Array.from(state.followingIds),
        lastFetched: state.lastFetched,
      }),
      // Custom merge function to convert Array back to Set on hydration
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        followingIds: new Set(persistedState.followingIds || []),
      }),
    }
  )
);
