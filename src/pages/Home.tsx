import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { MapIcon, PlusIcon, MapPinIcon, Star, ChevronRight, Store } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import HamburgerMenu from '../components/HamburgerMenu';
import FeedPost from '../components/FeedPost';
import { VirtualizedFeed } from '../components/VirtualizedFeed';
import { fetchReviews, fetchReviewsPaginated, convertReviewsToFeedPosts, fetchUserReviews, FirebaseReview, listenHomeFeed } from '../services/reviewService';
import { auth, getUserProfile, getCurrentUser } from '../lib/firebase';
import { getFollowing } from '../services/followService';
import mapPreview from "../assets/map-preview.png";
// Defer heavy map code: code-split ExpandedMapModal and avoid inline map
const ExpandedMapModal = React.lazy(() => import('../components/ExpandedMapModal'));

// Simple in-memory cache for Home state (survives route changes within session)
type HomeCache = {
  ts: number;
  firebaseReviews: FirebaseReview[];
  userReviews: FirebaseReview[];
  feedPosts: any[];
  userProfile: any;
};
let __homeCache: HomeCache | null = null;
let __homeCacheUserId: string | null = null;
const HOME_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper to check if cache is valid for the given user
const isCacheValid = (userId: string | null | undefined) => {
  if (!__homeCache) {
    return false;
  }
  if (!userId) {
    return false;
  }
  if (__homeCacheUserId !== userId) {
    return false;
  }
  return Date.now() - __homeCache.ts < HOME_CACHE_TTL_MS;
};

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

  // Synchronously validate cache BEFORE initializing state to avoid blank screen
  const initialAuthUser = getCurrentUser();
  const cacheIsValid = isCacheValid(initialAuthUser?.uid);
  const cachedData = cacheIsValid ? __homeCache : null;

  const [firebaseReviews, setFirebaseReviews] = useState<FirebaseReview[]>(cachedData?.firebaseReviews || []);
  const [userReviews, setUserReviews] = useState<FirebaseReview[]>(cachedData?.userReviews || []);
  const [feedPosts, setFeedPosts] = useState<any[]>(cachedData?.feedPosts || []);
  const [userProfile, setUserProfile] = useState<any>(cachedData?.userProfile || null);
  // CRITICAL: If we have cached posts, we're NOT loading - this prevents blank screen
  const [loading, setLoading] = useState(!cachedData || cachedData.feedPosts.length === 0);
  const [profileLoading, setProfileLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const [showExpandedMap, setShowExpandedMap] = useState(false);
  const [authUser, setAuthUser] = useState(() => getCurrentUser());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

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
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        console.log('[Home][raf] painted', {
          ts: new Date().toISOString(),
          perfNow: performance.now?.(),
        });
      });
    }
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
        __homeCache = null;
        __homeCacheUserId = null;
        setUserProfile(null);
        console.trace('[Home][auth] clearing userReviews/firebaseReviews/feedPosts due to sign-out');
        setUserReviews([]);
        setFirebaseReviews([]);
        setFeedPosts([]);
        setFollowingIds(new Set());
      }
      setAuthUser(user);
    });

    return () => unsubscribe();
  }, []);
  
  // Initialize data on mount: load from network only if cache is stale or missing
  useEffect(() => {
    const initializeData = async () => {
      if (!authUser) {
        console.log(
          '[Home][init] No authenticated user yet, skipping initialization',
          'ts=',
          new Date().toISOString()
        );
        return;
      }

      // Check for force refresh flag
      const url = new URL(window.location.href);
      const forceRefresh = url.searchParams.get('refresh') === '1';

      const tInitStart = performance.now?.() ?? Date.now();
      const cacheValid = isCacheValid(authUser.uid);
      console.log('[Home][init] start', {
        ts: new Date().toISOString(),
        perfMs: tInitStart,
        cacheValid,
        forceRefresh,
      });

      // If we have valid cache and no force refresh, skip fetch entirely
      if (!forceRefresh && cacheValid) {
        console.log(
          '[Home][init] Using cached data, skipping fetch',
          'ts=',
          new Date().toISOString()
        );
        // State is already hydrated from cache at mount, just ensure loading is false
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
        setProfileLoading(true);

        const currentUser = authUser;
        let loadedProfile = null;
        let followingSet: Set<string> = new Set();

        // Load user profile
        if (currentUser) {
          const tProfileStart = performance.now?.() ?? Date.now();
          const profileResult = await getUserProfile(currentUser.uid);
          const tProfileEnd = performance.now?.() ?? Date.now();
          console.log('[Home][init] getUserProfile completed', {
            ts: new Date().toISOString(),
            durationMs: tProfileEnd - tProfileStart,
            success: profileResult.success,
          });
          if (profileResult.success && profileResult.profile) {
            setUserProfile(profileResult.profile);
            loadedProfile = profileResult.profile;
            // If profile has following info, hydrate following set here in future.
          }

          // Load following relationships once for Home and pass into FeedPost components.
          try {
            const followingList = await getFollowing(currentUser.uid);
            followingSet = new Set(followingList.map((f) => f.followingId));
            setFollowingIds(followingSet);
          } catch (followErr) {
            console.error('[Home][init] Failed to load following list', followErr);
          }
        }
        setProfileLoading(false);

        // Load user's reviews for stats
        const tUserReviewsStart = performance.now?.() ?? Date.now();
        const reviews = await fetchUserReviews(50);
        const tUserReviewsEnd = performance.now?.() ?? Date.now();
        console.log('[Home][init] Fetched user reviews', {
          ts: new Date().toISOString(),
          count: reviews.length,
          durationMs: tUserReviewsEnd - tUserReviewsStart,
        });
        setFirebaseReviews(reviews);
        setUserReviews(currentUser ? reviews : []);

        // Load public feed (the listener will take over after initial load)
        const tFeedFetchStart = performance.now?.() ?? Date.now();
        const publicFeed = await fetchReviews(50);
        const tFeedFetchEnd = performance.now?.() ?? Date.now();
        console.log('[Home][init] Fetched public feed', {
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
        setFeedPosts(posts);

        // Update cache
        __homeCache = {
          ts: Date.now(),
          firebaseReviews: reviews,
          userReviews: currentUser ? reviews : [],
          feedPosts: posts,
          userProfile: loadedProfile
        };
        __homeCacheUserId = currentUser?.uid || null;

        const tInitEnd = performance.now?.() ?? Date.now();
        console.log('[Home][init] complete, cache updated', {
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
  }, [authUser]);
  
  // Fetch reviews from Firebase (used for first load and manual refresh)
  const loadReviews = async () => {
    try {
      const tLoadStart = performance.now?.() ?? Date.now();
      console.log('[Home][refresh] loadReviews start', {
        ts: new Date().toISOString(),
        perfMs: tLoadStart,
      });
      setLoading(true);
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
      setFirebaseReviews(reviews);
      setUserReviews(currentUser ? reviews : []);

      // Convert Firebase reviews to feed post format for initial render
      const tConvertStart = performance.now?.() ?? Date.now();
      const posts = await convertReviewsToFeedPosts(reviews);
      const tConvertEnd = performance.now?.() ?? Date.now();
      console.log('[Home][refresh] Converted reviews to feed posts', {
        ts: new Date().toISOString(),
        count: posts.length,
        durationMs: tConvertEnd - tConvertStart,
      });
      setFeedPosts(posts);
      setError(null);

      // Update cache
      __homeCache = {
        ts: Date.now(),
        firebaseReviews: reviews,
        userReviews: currentUser ? reviews : [],
        feedPosts: posts,
        userProfile
      };
      __homeCacheUserId = currentUser?.uid || null;
    } catch (err) {
      console.error('Failed to load reviews:', err);
      setError('Failed to load reviews');
      setFeedPosts([]); // Fallback to empty array
      setUserReviews([]); // Fallback to empty array
    } finally {
      setLoading(false);
      setRefreshing(false);
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
          setFeedPosts(posts);
          // update cache
          __homeCache = {
            ts: Date.now(),
            firebaseReviews: items,
            userReviews: userReviews,
            feedPosts: posts,
            userProfile
          };
          __homeCacheUserId = authUser?.uid || null;
          setLoading(false);
          const tListenerEnd = performance.now?.() ?? Date.now();
          console.log('[Home][listener] complete', {
            ts: new Date().toISOString(),
            totalDurationMs: tListenerEnd - tListenerStart,
          });
        } catch (e) {
          console.error('[Home][listener] Failed converting live feed posts', e);
        }
      },
      // Incremental updates: only convert what changed
      async (added, modified, removed) => {
        console.log('[Home][listener] Delta:', {
          added: added.length,
          modified: modified.length,
          removed: removed.length
        });

        // Handle removed posts
        if (removed.length) {
          setFeedPosts((prev) => prev.filter(post => !removed.includes(post.id)));
        }

        // Handle modified posts (re-convert and replace)
        if (modified.length) {
          const modifiedPosts = await convertReviewsToFeedPosts(modified);
          setFeedPosts((prev) => {
            const updated = [...prev];
            modifiedPosts.forEach(modPost => {
              const index = updated.findIndex(p => p.id === modPost.id);
              if (index >= 0) {
                updated[index] = modPost;
              }
            });
            return updated;
          });
        }

        // Handle new posts (convert and prepend to top)
        if (added.length) {
          const newPosts = await convertReviewsToFeedPosts(added);
          setFeedPosts((prev) => [...newPosts, ...prev]);
        }
      }
    );
    return () => {
      console.log('[Home] Cleaning up feed listener');
      unsub();
    };
  }, []); // ✅ Create once on mount, clean up on unmount

  // Calculate user stats from their own reviews and profile data
  const currentUser = authUser;
  const userStats = currentUser ? {
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
    totalDishes: userReviews.length, // Use user's actual review count for dishes
    pointsEarned: userProfile?.stats?.pointsEarned || 0
  } : {
    // Default stats for unauthenticated users
    averageRating: "0.0",
    totalRestaurants: 0,
    totalDishes: 0,
    pointsEarned: 0
  };

  // Get user's recent reviews for personal section (use actual user reviews)
  const userRecentReviews = userReviews.slice(0, 3);

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

  // Stable map of follow status keyed by authorId, for FeedPost components.
  const followingMap = useMemo(() => {
    return followingIds;
  }, [followingIds]);

  // Memoized callback - stable reference across renders
  const handleFollowChange = useCallback((userId: string, isFollowing: boolean) => {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (isFollowing) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }, []);

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
      setFeedPosts(prev => [...prev, ...newPosts]);
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
        <Link 
          to="/discover" 
          className="block w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-full font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
        >
          <MapIcon size={18} className="mr-2" />
          Discover Restaurants
        </Link>
      </div>
    </div>
  );

  const hasAnyContent =
    feedPosts.length > 0 ||
    firebaseReviews.length > 0 ||
    userReviews.length > 0;

  // Only show loader on true cold start (no cache at all)
  if (loading && !hasAnyContent) {
    console.log('[Home][render] showing loading state', {
      ts: new Date().toISOString(),
      feedPostsLength: feedPosts.length,
      cacheExists: !!cachedData
    });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
        Loading your feed...
      </div>
    );
  }

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
          // Clear cache so fresh data is fetched
          __homeCache = null;
          __homeCacheUserId = null;
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
        {loading && hasAnyContent && (
          <div className="flex justify-center mb-3">
            <span className="text-xs text-gray-400">Refreshing...</span>
          </div>
        )}

        {/* Your Food Journey Section */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Your Food Journey</h2>
          <p className="text-sm font-normal text-gray-500 mb-5">Tap to open your journey map</p>
          <div
            className="h-52 rounded-2xl border border-gray-100 overflow-hidden relative cursor-pointer hover:border-gray-200 hover:shadow-md transition-all duration-200"
            onClick={() => setShowExpandedMap(true)}
          >
            <img
              src={mapPreview}
              alt="Map preview"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-white/5" />
          </div>

          <div className="text-center mt-5">
            <div 
              className="inline-flex items-center gap-2 bg-white rounded-full border border-gray-200 px-5 py-2.5 shadow-sm cursor-pointer hover:border-gray-300 hover:shadow-md transition-all duration-200"
              onClick={() => navigate('/list-view')}
            >
              <MapPinIcon size={18} className="text-secondary" />
              <span className="text-sm font-medium text-gray-900">Recent Visits</span>
            </div>
          </div>
        </div>

        {/* Community Feed Section */}
        <div className="space-y-4">
          {/* Section Header */}
          <h2 className="text-lg font-bold text-black">Community Feed</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-red-600 underline"
              >
                Retry
              </button>
            </div>
          )}
          
          {/* Feed Posts */}
          {feedPosts.length > 0 ? (
            <VirtualizedFeed
              posts={feedPosts}
              followingMap={followingMap}
              onFollowChange={handleFollowChange}
              onLoadMore={loadMorePosts}
              hasMore={hasMore}
              loadingMore={loadingMore}
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

      {/* Expanded Map Modal */}
      {/* Lazy-loaded map modal to keep initial bundle light */}
      <React.Suspense fallback={null}>
        <ExpandedMapModal 
          isOpen={showExpandedMap}
          onClose={() => setShowExpandedMap(false)}
        />
      </React.Suspense>
    </div>
  );
};

export default Home;
