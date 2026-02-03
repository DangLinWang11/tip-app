import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserProfile } from '../lib/firebase';

export interface UserProfile {
  uid: string;
  username: string;
  email?: string;
  actualName?: string;
  displayName?: string;
  photoURL?: string;
  bio?: string;
  homeCountry?: string;
  homeCountryName?: string;
  stats?: {
    totalRestaurants?: number;
    totalDishes?: number;
    averageRating?: number;
    pointsEarned?: number;
  };
  createdAt?: any;
  updatedAt?: any;
}

interface UserState {
  // State - cache of user profiles by uid
  profiles: Record<string, UserProfile>;
  loading: Record<string, boolean>;
  lastFetched: Record<string, number>;

  // Actions
  setProfile: (uid: string, profile: UserProfile) => void;
  getProfileCached: (uid: string) => Promise<UserProfile | null>;
  clearCache: () => void;

  // Helpers
  isProfileStale: (uid: string) => boolean;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Initial state
      profiles: {},
      loading: {},
      lastFetched: {},

      // Actions
      setProfile: (uid, profile) => set((state) => ({
        profiles: { ...state.profiles, [uid]: profile },
        lastFetched: { ...state.lastFetched, [uid]: Date.now() },
      })),

      getProfileCached: async (uid: string) => {
        const state = get();
        
        // Check if we have a cached profile that's not stale
        const cachedProfile = state.profiles[uid];
        const isStale = state.isProfileStale(uid);
        
        if (cachedProfile && !isStale) {
          console.log('[UserStore] Using cached profile for', uid);
          return cachedProfile;
        }

        // Check if already fetching
        if (state.loading[uid]) {
          console.log('[UserStore] Already fetching profile for', uid);
          // Wait a bit and return cached if available
          await new Promise(resolve => setTimeout(resolve, 100));
          return state.profiles[uid] || null;
        }

        // Mark as loading
        set((state) => ({
          loading: { ...state.loading, [uid]: true }
        }));

        try {
          console.log('[UserStore] Fetching fresh profile for', uid);
          const result = await getUserProfile(uid);
          
          if (result.success && result.profile) {
            const profile: UserProfile = {
              uid,
              username: result.profile.username,
              email: result.profile.email,
              displayName: result.profile.displayName,
              photoURL: result.profile.photoURL,
              bio: result.profile.bio,
              homeCountry: result.profile.homeCountry,
              homeCountryName: result.profile.homeCountryName,
              stats: result.profile.stats,
              createdAt: result.profile.createdAt,
              updatedAt: result.profile.updatedAt,
            };
            
            // Update cache
            set((state) => ({
              profiles: { ...state.profiles, [uid]: profile },
              lastFetched: { ...state.lastFetched, [uid]: Date.now() },
              loading: { ...state.loading, [uid]: false }
            }));
            
            return profile;
          }
          
          // Failed to fetch
          set((state) => ({
            loading: { ...state.loading, [uid]: false }
          }));
          
          return null;
        } catch (error) {
          console.error('[UserStore] Failed to fetch profile for', uid, error);
          set((state) => ({
            loading: { ...state.loading, [uid]: false }
          }));
          return null;
        }
      },

      clearCache: () => set({
        profiles: {},
        loading: {},
        lastFetched: {},
      }),

      // Helpers
      isProfileStale: (uid: string) => {
        const { lastFetched } = get();
        const fetchedAt = lastFetched[uid];
        if (!fetchedAt) return true;
        return Date.now() - fetchedAt > CACHE_TTL_MS;
      }
    }),
    {
      name: 'tip-user-storage',
      partialize: (state) => ({
        profiles: state.profiles,
        lastFetched: state.lastFetched,
        // Don't persist loading states
      }),
    }
  )
);
