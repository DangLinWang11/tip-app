import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { PlusIcon, Star, ChevronRight, Store } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import HamburgerMenu from '../components/HamburgerMenu';
import FeedPost from '../components/FeedPost';
import { VirtualizedFeed } from '../components/VirtualizedFeed';
import { fetchReviewsWithCache, fetchReviewsPaginated, convertReviewsToFeedPosts, fetchUserReviews, FirebaseReview, listenHomeFeed } from '../services/reviewService';
import { auth, getUserProfile, getCurrentUser } from '../lib/firebase';
import { getFollowing } from '../services/followService';
import { useReviewStore } from '../stores/reviewStore';
import { useFollowStore } from '../stores/followStore';
import { getTierFromPoints } from '../badges/badgeTiers';
import FloatingUserStatsBox from '../components/FloatingUserStatsBox';
import { useAutoStartTour, useTour } from '../tour/TourProvider';
import { getHomeFeaturedHidden } from '../tour/tourStorage';

const Home: React.FC = () => {
  const mountStart = performance.now?.() ?? Date.now();
  console.log(
    '[Home][render-start]',
    'ts=',
    new Date().toISOString(),
    'perfMs=',
    mountStart
  );

  const navigate = useNavigate();
  const location = useLocation();
  const { activeTourId, isOpen: isTourOpen } = useTour();
  const isHomeTourActive = isTourOpen && activeTourId === 'home';

  // STABILITY: Use specific Zustand selectors to prevent unnecessary re-renders
  const firebaseReviews = useReviewStore(state => state.reviews);
  const feedPosts = useReviewStore(state => state.feedPosts);
  const renderedFeedPosts = useReviewStore(state => state.renderedFeedPosts); // NEW: Memoized rendered posts
  const loading = useReviewStore(state => state.loading);
  const error = useReviewStore(state => state.error);
  const isStale = useReviewStore(state => state.isStale);
  const scrollPosition = useReviewStore(state => state.scrollPosition); // NEW: Saved scroll position
  const setFirebaseReviews = useReviewStore(state => state.setReviews);
  const setFeedPosts = useReviewStore(state => state.setFeedPosts);
  const setRenderedFeed = useReviewStore(state => state.setRenderedFeed); // NEW: Action to set rendered posts
  const setLoading = useReviewStore(state => state.setLoading);
  const setError = useReviewStore(state => state.setError);
  const updateLastFetched = useReviewStore(state => state.updateLastFetched);
  const clearCache = useReviewStore(state => state.clearCache);
  const setScrollPosition = useReviewStore(state => state.setScrollPosition); // NEW: Action to save scroll

  // Follow state from Zustand (persisted)
  const followingIds = useFollowStore(state => state.followingIds);
  const setFollowingIds = useFollowStore(state => state.setFollowingIds);
  const addFollowing = useFollowStore(state => state.addFollowing);
  const removeFollowing = useFollowStore(state => state.removeFollowing);
  const clearFollowing = useFollowStore(state => state.clearFollowing);
  const updateFollowFetched = useFollowStore(state => state.updateLastFetched);
  const isFollowStale = useFollowStore(state => state.isStale);

  // Local state (not in Zustand)
  const [userReviews, setUserReviews] = useState<FirebaseReview[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [authUser, setAuthUser] = useState(() => getCurrentUser());

  // NEW: Non-blocking hydration state
  const [isHydrated, setIsHydrated] = useState(false);
  const [feedReady, setFeedReady] = useState(false);

  // Pull-to-refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const canPull = useRef(false);
  const virtualScrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);
  const PULL_TRIGGER = 140; // pixels required to trigger refresh (harder to trigger)

  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const radius = 16; // progress ring radius (SVG units)
  const circumference = 2 * Math.PI * radius;
  const pullProgress = Math.max(0, Math.min(1, pullY / PULL_TRIGGER));

  // NEW: Non-blocking hydration effect - wait for store to hydrate from localStorage
  useEffect(() => {
    const checkHydration = async () => {
      const tHydrationStart = performance.now?.() ?? Date.now();
      console.log('[Home][hydration] Checking store hydration...', {
        ts: new Date().toISOString(),
      });

      // Zustand persist provides hasHydrated via the store's persist property
      // Wait for hydration to complete (should be very fast now with minimal localStorage)
      const hydrated = useReviewStore.persist?.hasHydrated();

      if (hydrated) {
        const tHydrationEnd = performance.now?.() ?? Date.now();
        console.log('[Home][hydration] ✅ Store hydrated', {
          ts: new Date().toISOString(),
          durationMs: tHydrationEnd - tHydrationStart,
        });
        setIsHydrated(true);
      } else {
        // If not hydrated yet, wait for the onFinishHydration callback
        console.log('[Home][hydration] ⏳ Waiting for hydration to complete...');
        useReviewStore.persist?.onFinishHydration(() => {
          const tHydrationEnd = performance.now?.() ?? Date.now();
          console.log('[Home][hydration] ✅ Store hydrated (via callback)', {
            ts: new Date().toISOString(),
            durationMs: tHydrationEnd - tHydrationStart,
          });
          setIsHydrated(true);
        });
      }
    };

    checkHydration();
  }, []);

  // NEW: "Wait for Frame" trick - delay feed render until browser is ready to paint
  useEffect(() => {
    if (!isHydrated) return;

    const tFrameStart = performance.now?.() ?? Date.now();
    console.log('[Home][frame-wait] Store hydrated, waiting for browser frame...', {
      ts: new Date().toISOString(),
    });

    // Use double requestAnimationFrame to ensure we wait for TWO frames
    // Frame 1: Browser draws the basic page structure (header, map preview, etc.)
    // Frame 2: Browser is ready to inject the heavy feed list
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const tFrameEnd = performance.now?.() ?? Date.now();
        console.log('[Home][frame-wait] ✅ Browser ready, rendering feed now', {
          ts: new Date().toISOString(),
          durationMs: tFrameEnd - tFrameStart,
        });
        setFeedReady(true);
      });
    });
  }, [isHydrated]);

  // NEW: Scroll restoration - restore saved scroll position after feed is ready
  useEffect(() => {
    if (!feedReady || scrollPosition === 0) return;

    const tScrollStart = performance.now?.() ?? Date.now();
    console.log('[Home][scroll-restore] Feed ready, restoring scroll position...', {
      ts: new Date().toISOString(),
      scrollPosition,
    });

    // Wait one more tick to ensure VirtualizedFeed has rendered
    requestAnimationFrame(() => {
      const tScrollEnd = performance.now?.() ?? Date.now();
      console.log('[Home][scroll-restore] ✅ Restoring scroll to position', {
        ts: new Date().toISOString(),
        position: scrollPosition,
        durationMs: tScrollEnd - tScrollStart,
      });
      window.scrollTo(0, scrollPosition);
    });
  }, [feedReady, scrollPosition]);

  // NEW: Debounced scroll listener - save scroll position every 100ms
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Debounce: clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set new timeout to save scroll position after 100ms of no scrolling
      scrollTimeout = setTimeout(() => {
        const currentScroll = window.scrollY || document.documentElement.scrollTop;
        if (currentScroll > 0) {
          setScrollPosition(currentScroll);
          console.log('[Home][scroll-save] Saved scroll position:', currentScroll);
        }
      }, 100); // Debounce delay: 100ms
    };

    // Add scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [setScrollPosition]);

  useEffect(() => {
    isFirstLoad.current = false;
    const mountEnd = performance.now?.() ?? Date.now();
    console.log(
      '[Home][mount-effect] component did mount',
      'ts=',
      new Date().toISOString(),
      'perfMs=',
      mountEnd,
      'sinceRenderMs=',
      mountEnd - mountStart
    );
  }, []);

  useLayoutEffect(() => {
    const ts = new Date().toISOString();
    console.log('[Home][layout-effect]', {
      ts,
      authUserId: authUser?.uid || null,
    });
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        console.log('[Home][layout-raf]', {
          ts: new Date().toISOString(),
          authUserId: authUser?.uid || null,
          perfNow: performance.now?.(),
        });
      });
    }
  }, [authUser?.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        clearCache();
        setUserProfile(null);
        console.trace('[Home][auth] clearing userReviews/firebaseReviews/feedPosts due to sign-out');
        setUserReviews([]);
        clearFollowing();
      }
      setAuthUser(user);
    });

    return () => unsubscribe();
  }, [clearCache, clearFollowing]);

  // Load user-specific data (profile, stats, following) independent of feed cache
  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;
    const loadUserContext = async () => {
      const currentUserId = authUser.uid;
      setProfileLoading(true);

      try {
        const [profileResult, reviews] = await Promise.all([
          getUserProfile(currentUserId),
          fetchUserReviews(50, currentUserId)
        ]);

        if (cancelled) return;

        if (profileResult.success && profileResult.profile) {
          setUserProfile(profileResult.profile);
        }

        setUserReviews(reviews);

        // Load following relationships (only if stale or empty)
        try {
          if (isFollowStale() || followingIds.size === 0) {
            console.log('[Home][user-context] Fetching fresh following list...');
            const followingList = await getFollowing(currentUserId);
            if (cancelled) return;
            const followingSet = new Set(followingList.map((f) => f.followingId));
            setFollowingIds(followingSet);
            updateFollowFetched();
          } else {
            console.log('[Home][user-context] Using cached following list', { count: followingIds.size });
          }
        } catch (followErr) {
          console.error('[Home][user-context] Failed to load following list', followErr);
        }
      } catch (err) {
        console.error('[Home][user-context] Failed to load user data:', err);
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadUserContext();
    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, isFollowStale, followingIds.size, setFollowingIds, updateFollowFetched]);
  
  // Initialize data on mount: load from network only if cache is stale or missing
  // IMPORTANT: Only run after store hydration is complete to avoid race conditions
  useEffect(() => {
    // Wait for hydration before initializing data
    if (!isHydrated) {
      console.log('[Home][init] Waiting for store hydration before initializing data...');
      return;
    }

    const initializeData = async () => {
      if (!authUser) {
        console.log('[Home][init] No authenticated user yet, waiting...');

        // Set timeout: if no auth after 3 seconds, show error
        const timeoutId = setTimeout(() => {
          console.error('[Home][init] Auth timeout - user still null after 3s');
          setLoading(false);
          setError('Authentication timeout. Please refresh the page.');
        }, 3000);

        return () => clearTimeout(timeoutId);
      }


      // Check for force refresh flag
      const url = new URL(window.location.href);
      const forceRefresh = url.searchParams.get('refresh') === '1';

      const tInitStart = performance.now?.() ?? Date.now();
      const stale = isStale();
      console.log('[Home][init] start', {
        ts: new Date().toISOString(),
        perfMs: tInitStart,
        isStale: stale,
        forceRefresh,
        hasCachedPosts: feedPosts.length > 0,
        hasRenderedPosts: renderedFeedPosts.length > 0
      });

      // OPTIMIZATION: If we have rendered posts in store, use them immediately (no CPU work)
      if (!forceRefresh && !stale && renderedFeedPosts.length > 0) {
        console.log(
          '[Home][init] ⚡ Using memoized renderedFeedPosts from Zustand - ZERO CPU work!',
          'ts=',
          new Date().toISOString(),
          'count=',
          renderedFeedPosts.length
        );
        // State is already hydrated from Zustand, just ensure loading is false
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      // Fallback: If we have valid feedPosts cache but no rendered posts, skip fetch but we'll need to render
      if (!forceRefresh && !stale && feedPosts.length > 0) {
        console.log(
          '[Home][init] Using Zustand feedPosts cache, skipping fetch',
          'ts=',
          new Date().toISOString()
        );
        // State is already hydrated from Zustand, just ensure loading is false
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      // Otherwise, fetch fresh data
      try {
        const tFetchStart = performance.now?.() ?? Date.now();
        console.log('[Home][init] Fetching fresh data...', {
          ts: new Date().toISOString(),
          perfMs: tFetchStart,
        });
        setLoading(true);

        // Load public feed using cache-first approach
        const tFeedFetchStart = performance.now?.() ?? Date.now();
        const publicFeed = await fetchReviewsWithCache(50);
        const tFeedFetchEnd = performance.now?.() ?? Date.now();
        console.log('[Home][init] Fetched public feed (cache-first)', {
          ts: new Date().toISOString(),
          count: publicFeed.length,
          durationMs: tFeedFetchEnd - tFeedFetchStart,
        });

        const tConvertStart = performance.now?.() ?? Date.now();
        const posts = await convertReviewsToFeedPosts(publicFeed);
        const tConvertEnd = performance.now?.() ?? Date.now();
        console.log('[Home][init] Converted reviews to feed posts', {
          ts: new Date().toISOString(),
          count: posts.length,
          durationMs: tConvertEnd - tConvertStart,
        });

        // Store both raw and rendered posts
        setFirebaseReviews(publicFeed);
        setFeedPosts(posts);
        setRenderedFeed(posts); // NEW: Store the rendered posts for instant reuse on "Back"
        updateLastFetched();

        const tInitEnd = performance.now?.() ?? Date.now();
        console.log('[Home][init] complete, Zustand store updated', {
          ts: new Date().toISOString(),
          totalDurationMs: tInitEnd - tInitStart,
        });
        setLoading(false);
      } catch (err) {
        console.error('[Home][init] Failed to initialize home data:', err);
        setError('Failed to load data');
        setLoading(false);
        setProfileLoading(false);
      }
    };

    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, isHydrated]); // Re-run when auth changes OR when hydration completes
  
  // Fetch reviews from Firebase (used for first load and manual refresh)
  const loadReviews = async (silent: boolean = false) => {
    try {
      const tLoadStart = performance.now?.() ?? Date.now();
      console.log('[Home][refresh] loadReviews start', {
        ts: new Date().toISOString(),
        perfMs: tLoadStart,
      });
      if (!silent) {
        setLoading(true);
      }
      const currentUser = authUser;

      // Load current user's reviews once and reuse for state + stats
      const tUserReviewsStart = performance.now?.() ?? Date.now();
      const reviews = await fetchUserReviews(50);
      const tUserReviewsEnd = performance.now?.() ?? Date.now();
      console.log('[Home][refresh] Fetched user reviews', {
        ts: new Date().toISOString(),
        count: reviews.length,
        durationMs: tUserReviewsEnd - tUserReviewsStart,
      });
      setUserReviews(currentUser ? reviews : []);

      // Load public feed using cache-first approach
      const publicFeed = await fetchReviewsWithCache(50);

      // Convert Firebase reviews to feed post format
      const tConvertStart = performance.now?.() ?? Date.now();
      const posts = await convertReviewsToFeedPosts(publicFeed);
      const tConvertEnd = performance.now?.() ?? Date.now();
      console.log('[Home][refresh] Converted reviews to feed posts', {
        ts: new Date().toISOString(),
        count: posts.length,
        durationMs: tConvertEnd - tConvertStart,
      });

      // Store both raw and rendered posts
      setFirebaseReviews(publicFeed);
      setFeedPosts(posts);
      setRenderedFeed(posts); // NEW: Store the rendered posts for instant reuse
      updateLastFetched();
      setError(null);
    } catch (err) {
      console.error('Failed to load reviews:', err);
      setError('Failed to load reviews');
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Real-time home feed listener (public, not deleted). Keeps feed fresh and ordered.
  useEffect(() => {
    console.log('[Home] Setting up real-time feed listener');
    const unsub = listenHomeFeed(
      // Initial load: full conversion
      async (items: FirebaseReview[]) => {
        try {
          const tListenerStart = performance.now?.() ?? Date.now();
          console.log('[Home][listener] received items', {
            ts: new Date().toISOString(),
            rawCount: items.length,
          });
          const tConvertStart = performance.now?.() ?? Date.now();
          const posts = await convertReviewsToFeedPosts(items);
          const tConvertEnd = performance.now?.() ?? Date.now();
          console.log('[Home][listener] Converted items to posts', {
            ts: new Date().toISOString(),
            count: posts.length,
            durationMs: tConvertEnd - tConvertStart,
          });

          // Update Zustand store with both raw and rendered posts
          setFirebaseReviews(items);
          setFeedPosts(posts);
          setRenderedFeed(posts); // NEW: Store rendered posts for instant reuse
          updateLastFetched();
          setLoading(false);

          const tListenerEnd = performance.now?.() ?? Date.now();
          console.log('[Home][listener] complete', {
            ts: new Date().toISOString(),
            totalDurationMs: tListenerEnd - tListenerStart,
          });
        } catch (e) {
          console.error('[Home][listener] Failed converting live feed posts', e);
          setError('Failed to load feed updates');
          setLoading(false);
          setRefreshing(false);
        }
      },
      // Incremental updates: only convert what changed
      async (added, modified, removed) => {
        try {
          console.log('[Home][listener] Delta:', {
            added: added.length,
            modified: modified.length,
            removed: removed.length
          });

          // Handle removed posts
          if (removed.length) {
            const updatedPosts = feedPosts.filter(post => !removed.includes(post.id));
            setFeedPosts(updatedPosts);
            setRenderedFeed(updatedPosts); // NEW: Update rendered feed
          }

          // Handle modified posts (re-convert and replace)
          if (modified.length) {
            const modifiedPosts = await convertReviewsToFeedPosts(modified);
            const updated = [...feedPosts];
            modifiedPosts.forEach(modPost => {
              const index = updated.findIndex(p => p.id === modPost.id);
              if (index >= 0) {
                updated[index] = modPost;
              }
            });
            setFeedPosts(updated);
            setRenderedFeed(updated); // NEW: Update rendered feed
          }

          // Handle new posts (convert and prepend to top)
          if (added.length) {
            const newPosts = await convertReviewsToFeedPosts(added);
            const updatedPosts = [...newPosts, ...feedPosts];
            setFeedPosts(updatedPosts);
            setRenderedFeed(updatedPosts); // NEW: Update rendered feed
          }
        } catch (e) {
          console.error('[Home][listener] Delta update failed', e);
          // Don't set error for incremental failures - just log
        }
      }
    );
    return () => {
      console.log('[Home] Cleaning up feed listener');
      unsub();
    };
  }, []); // ✅ Create once on mount, clean up on unmount

  // STABILITY: Memoize computed user stats to prevent recalculation on every render
  const currentUser = authUser;
  const userStats = useMemo(() => {
    console.log('[Home][useMemo] Recalculating userStats', {
      ts: new Date().toISOString(),
      hasUser: !!currentUser,
      reviewsCount: userReviews.length
    });

    return currentUser ? {
      averageRating: userProfile?.stats?.averageRating
        ? userProfile.stats.averageRating.toFixed(1)
        : userReviews.length > 0
          ? (userReviews.reduce((sum, review) => sum + review.rating, 0) / userReviews.length).toFixed(1)
          : "0.0",
      totalRestaurants: userProfile?.stats?.totalRestaurants ||
        new Set(
          userReviews
            .map((r: any) => r?.restaurantId || r?.restaurant || r?.restaurantName)
            .filter(Boolean)
        ).size,
      totalReviews: userProfile?.stats?.totalReviews || userReviews.length,
      totalDishes: userReviews.length,
      pointsEarned: Math.max(userProfile?.stats?.pointsEarned || 0, userReviews.length * 20)
    } : {
      // Default stats for unauthenticated users
      averageRating: "0.0",
      totalRestaurants: 0,
      totalReviews: 0,
      totalDishes: 0,
      pointsEarned: 0
    };
  }, [currentUser, userReviews, userProfile?.stats]);
  const isNewUser = userReviews.length === 0;
  const [hideFeaturedExample, setHideFeaturedExample] = useState(false);

  useEffect(() => {
    setHideFeaturedExample(getHomeFeaturedHidden());
  }, []);

  // STABILITY: Memoize user recent reviews to prevent slice recalculation
  const userRecentReviews = useMemo(() => {
    console.log('[Home][useMemo] Recalculating userRecentReviews', {
      ts: new Date().toISOString(),
      reviewsCount: userReviews.length
    });
    return userReviews.slice(0, 3);
  }, [userReviews]);

  useEffect(() => {
    console.log('[Home][state] feedPosts length changed', {
      ts: new Date().toISOString(),
      length: feedPosts.length,
      loading,
      hasAnyContent:
        (feedPosts && feedPosts.length > 0) ||
        (firebaseReviews && firebaseReviews.length > 0) ||
        (userReviews && userReviews.length > 0),
      authUserId: authUser?.uid || null,
    });
  }, [feedPosts.length]);

  // Loading timeout protection: prevent infinite loading state
  useEffect(() => {
    if (!loading) return;

    const timeoutId = setTimeout(() => {
      if (loading) {
        console.error('[Home] Loading timeout - still loading after 10s');
        setLoading(false);
        setError('Loading took too long. Please try refreshing.');
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [loading]);

  // Navigation detection: refresh stale cache when navigating to Home
  const hasNavigatedToHome = useRef(false);

  useEffect(() => {
    // Detect when we navigate TO home (not just mount)
    if (location.pathname === '/' && authUser) {
      if (hasNavigatedToHome.current) {
        // Not first mount, this is a navigation event
        const stale = isStale();

        // Refresh if cache is stale
        if (stale) {
          console.log('[Home][nav] Navigated to Home, refreshing stale cache');
          setRefreshing(true);
          loadReviews();
        }
      }
      hasNavigatedToHome.current = true;
    }
  }, [location.pathname, authUser, isStale]);

  // Page visibility detection: refresh when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && authUser) {
        const stale = isStale();

        if (stale) {
          console.log('[Home][visibility] Tab visible, cache stale, refreshing');
          setRefreshing(true);
          loadReviews();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authUser, isStale]);

  // PersistentShell visibility detection: refresh when returning after 5+ minutes
  const lastHiddenTime = useRef<number | null>(null);
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    // Detect when Home becomes visible/hidden via PersistentShell (location.pathname changes)
    if (location.pathname === '/') {
      // Home is now visible
      if (lastHiddenTime.current !== null && authUser) {
        const hiddenDuration = Date.now() - lastHiddenTime.current;
        
        if (hiddenDuration > STALE_THRESHOLD_MS) {
          console.log('[Home][persistent-visibility] Home visible after', hiddenDuration, 'ms, refreshing feed silently');
          // Silent refresh - no loading spinner
          loadReviews(true).catch(err => {
            console.error('[Home][persistent-visibility] Background refresh failed:', err);
          });
        } else {
          console.log('[Home][persistent-visibility] Home visible after', hiddenDuration, 'ms, skipping refresh (< 5min)');
        }
        
        lastHiddenTime.current = null;
      }
    } else {
      // Home is now hidden (user navigated away)
      if (lastHiddenTime.current === null) {
        lastHiddenTime.current = Date.now();
        console.log('[Home][persistent-visibility] Home hidden at', new Date().toISOString());
      }
    }
  }, [location.pathname, authUser]);

  // Stable map of follow status keyed by authorId, for FeedPost components.
  const followingMap = useMemo(() => {
    const map = new Map<string, boolean>();
    followingIds.forEach(id => map.set(id, true));
    return map;
  }, [followingIds]);

  // Memoized callback - stable reference across renders
  const handleFollowChange = useCallback((userId: string, isFollowing: boolean) => {
    if (isFollowing) {
      addFollowing(userId);
    } else {
      removeFollowing(userId);
    }
  }, [addFollowing, removeFollowing]);

  // Load more posts for infinite scroll
  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const { reviews, lastDoc: newLastDoc } = await fetchReviewsPaginated(20, lastDoc);

      if (reviews.length === 0) {
        setHasMore(false);
        return;
      }

      const newPosts = await convertReviewsToFeedPosts(reviews);
      const updatedPosts = [...feedPosts, ...newPosts];
      setFeedPosts(updatedPosts);
      setRenderedFeed(updatedPosts); // NEW: Update rendered feed with pagination
      setLastDoc(newLastDoc);
      setHasMore(newLastDoc !== null);
    } catch (error) {
      console.error('Failed to load more posts:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastDoc]);

  const handleVisitClick = (visitId: number) => {
    console.log(`Navigate to post ${visitId}`);
  };

  const handleAddNote = (visitId: number) => {
    console.log(`Add note for visit ${visitId}`);
  };

  // Empty state for new users
  const EmptyState = () => (
    <div className="text-center py-12 px-4">
      <div className="mb-6">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <PlusIcon size={32} className="text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Your Food Journey!</h3>
        <p className="text-gray-600 mb-6 max-w-sm mx-auto">
          Create your first review to start tracking your favorite dishes and restaurants.
        </p>
      </div>
      
      <div className="space-y-3 max-w-xs mx-auto">
        <Link 
          to="/create" 
          className="block w-full bg-primary text-white py-3 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
        >
          Add Your First Review
        </Link>
        {!isNewUser && (
          <Link 
            to="/discover" 
            className="block w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-full font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            <MapIcon size={18} className="mr-2" />
            Discover Restaurants
          </Link>
        )}
      </div>
    </div>
  );

  const hasAnyContent =
    renderedFeedPosts.length > 0 ||
    feedPosts.length > 0 ||
    firebaseReviews.length > 0 ||
    userReviews.length > 0;
  const baseFeedPosts = renderedFeedPosts.length > 0 ? renderedFeedPosts : feedPosts;
  const featuredExamplePost = useMemo(() => {
    if (hideFeaturedExample && !isHomeTourActive) return null;
    if (!isNewUser || baseFeedPosts.length === 0) return null;
    const matchesSpicyFoodieJackDusty = (post: any) => {
      const restaurantName = String(post?.restaurant?.name || '').trim().toLowerCase();
      const authorName = String(post?.author?.name || post?.author?.username || '').trim().toLowerCase();
      // Match "Jack Dusty" restaurant AND "Spicy Foodie" author (Spicy Foodie339)
      if (restaurantName !== 'jack dusty') return false;
      if (!authorName.includes('spicy') && !authorName.includes('foodie')) return false;
      return true;
    };
    return baseFeedPosts.find(matchesSpicyFoodieJackDusty) || null;
  }, [hideFeaturedExample, isNewUser, baseFeedPosts, isHomeTourActive]);
  const displayFeedPosts = useMemo(() => {
    if (!featuredExamplePost) return baseFeedPosts;
    const featured = {
      ...featuredExamplePost,
      isFeaturedExample: true
    };
    const rest = baseFeedPosts.filter((post) => post?.id !== featuredExamplePost.id);
    return [featured, ...rest];
  }, [featuredExamplePost, baseFeedPosts]);

  const isHomeRoute = location.pathname === '/';
  useAutoStartTour('home', isHomeRoute && Boolean(featuredExamplePost));

  // Only show loader on true cold start (no cache at all)
  // CRITICAL: Only block UI on absolute first load to ensure interactability
  if (loading && !hasAnyContent && isFirstLoad.current) {
    // ONLY show blocking loading screen on true first load
    // If we have ANY data (cache or current), show it and make page interactive
    console.log('[Home][render] showing loading state', {
      ts: new Date().toISOString(),
      feedPostsLength: feedPosts.length,
      isFirstLoad: isFirstLoad.current
    });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your feed...</p>
        </div>
      </div>
    );
  }

  // If we reach here, ALWAYS render the full UI (even if loading)
  // This ensures the page is ALWAYS interactive after first load

  // Always show the full Home dashboard (stats, map, community feed)
  return (
    <div
      className="min-h-screen bg-gray-50 pb-16"
      onTouchStart={(e) => {
        if (window.scrollY <= 0) {
          canPull.current = true;
          pullStartY.current = e.touches[0].clientY;
        } else {
          canPull.current = false;
          pullStartY.current = null;
        }
      }}
      onTouchMove={(e) => {
        if (!canPull.current || pullStartY.current == null) return;
        const dy = e.touches[0].clientY - pullStartY.current;
        if (dy > 0) {
          setPullY(Math.min(dy, 120));
        }
      }}
      onTouchCancel={() => {
        canPull.current = false;
        pullStartY.current = null;
        setPullY(0);
      }}
      onTouchEnd={() => {
        if (pullY >= PULL_TRIGGER && !refreshing) {
          setRefreshing(true);
          setPullY(0);
          // Clear Zustand cache so fresh data is fetched
          clearCache();
          loadReviews();
        } else {
          setPullY(0);
        }
      }}
      style={{
        transform: pullY > 0 ? `translateY(${pullY}px)` : undefined,
        transition: pullY === 0 ? 'transform 150ms ease-out' : undefined,
      }}
    >
      {/* Pull-to-refresh indicator with progressive ring */}
      {(pullY > 0 || refreshing) && (
        <div className="fixed top-3 inset-x-0 flex items-center justify-center z-50 pointer-events-none">
          <svg
            className={`${refreshing ? 'animate-spin' : ''}`}
            width="32"
            height="32"
            viewBox="0 0 36 36"
          >
            {/* background track */}
            <circle cx="18" cy="18" r="16" stroke="#e5e7eb" strokeWidth="3" fill="none" />
            {/* progress arc */}
            <circle
              cx="18"
              cy="18"
              r="16"
              stroke="#ff3131"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - (refreshing ? 0.85 : pullProgress))}`}
              transform="rotate(-90 18 18)"
            />
          </svg>
        </div>
      )}
      {/* Header */}
      <div className="bg-white px-4 py-1 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src="/images/tip-logo.png" 
              alt="Tip" 
              data-tour="home-logo"
              className="w-36 h-20 object-contain -ml-2"
            />
          </div>
          <div className="flex items-center">
            <div 
              className="bg-white rounded-full shadow-sm border border-gray-100 p-2 mr-3 cursor-pointer hover:shadow-md transition-shadow flex items-center justify-center"
              onClick={() => navigate('/rewards')}
            >
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#FFD700' }}
              >
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F59E0B' }}
                >
                  <Star 
                    size={10} 
                    style={{ 
                      color: '#FFD700', 
                      fill: '#FFD700'
                    }} 
                  />
                </div>
              </div>
            </div>
            <HamburgerMenu />
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Inline refresh indicator when updating but showing cached content */}
        {refreshing && hasAnyContent && (
          <div className="flex justify-center mb-3">
            <div className="bg-white rounded-full shadow-sm px-4 py-2 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-600">Updating feed...</span>
            </div>
          </div>
        )}

        {/* User Stats Box with Dynamic Island */}
        <FloatingUserStatsBox
          avatar={userProfile?.avatar || userProfile?.photoURL || authUser?.photoURL}
          username={userProfile?.username || userProfile?.displayName || authUser?.displayName || 'User'}
          tierIndex={getTierFromPoints(userStats.pointsEarned).tierIndex}
          tierName={getTierFromPoints(userStats.pointsEarned).tierName}
          reviewsCount={userStats.totalReviews}
          dishesCount={userStats.totalDishes}
        />

        {/* Community Feed Section */}
        <div className="space-y-4">
          {/* Section Header */}
          <h2 className="text-lg font-bold text-black">Community Feed</h2>

          {/* Onboarding dialogs removed: replaced by coach-mark tour */}
          
          {error && (
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm p-8 text-center my-6">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Couldn't Load Your Feed
              </h3>
              <p className="text-gray-600 mb-6 text-sm">{error}</p>
              <button
                onClick={() => {
                  // Clear Zustand cache and retry
                  clearCache();
                  setError(null);
                  setLoading(true);
                  // Trigger re-initialization
                  window.location.search = '?refresh=1';
                }}
                className="bg-primary text-white py-3 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
          
          {/* Feed Posts */}
          {/* NON-BLOCKING RENDER: Only show feed after hydration + frame wait */}
          {/* Skip gate when home tour is active — feed data is already in store from before navigation */}
          {!feedReady && !isHomeTourActive ? (
            // Show skeleton/placeholder while waiting for hydration and frame
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
                  <div className="h-64 bg-gray-200"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (displayFeedPosts.length > 0) ? (
            <VirtualizedFeed
              posts={displayFeedPosts}
              followingMap={followingMap}
              onFollowChange={handleFollowChange}
              onLoadMore={loadMorePosts}
              hasMore={hasMore}
              loadingMore={loadingMore}
              currentUserPointsEarned={userStats.pointsEarned}
            />
          ) : !loading && !error && (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusIcon size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reviews Yet</h3>
              <p className="text-gray-600 mb-6">Be the first to share a review!</p>
              <Link 
                to="/create" 
                className="inline-block bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
              >
                Create First Review
              </Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Home;
