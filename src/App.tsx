// File: src/App.tsx
import React, { useState, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getUserProfile } from './lib/firebase';
import { ensureUserProfile } from './services/userService';
import { I18nProvider } from './lib/i18n/useI18n';
import Layout from './components/Layout';
import Home from './pages/Home';
import Discover from './pages/Discover';
import DiscoverList from './pages/DiscoverList';
import Create from './pages/Create';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import UserFoodMapPage from './pages/UserFoodMapPage';
import RecentActivity from './pages/RecentActivity';
import EditProfile from './pages/EditProfile';
import ListDetail from './pages/ListDetail';
import ChangePassword from './pages/ChangePassword';
import RewardsComingSoon from './pages/RewardsComingSoon';
import Onboarding from './pages/Onboarding';
import RestaurantDetail from './pages/RestaurantDetail';
import MenuDetail from './pages/MenuDetail';
import FoodMap from './pages/FoodMap';
import AdminUpload from './pages/AdminUpload';
import PostDetail from './pages/PostDetail';
import FixRestaurants from './pages/FixRestaurants';
import { LocationProvider } from './contexts/LocationContext';
import { useFeature } from './utils/features';
import { getRandomLoadingMessage } from './utils/loadingMessages';
import { runBackfillSoftDelete } from './dev/backfillSoftDelete';
import { runBackfillCuisines } from './dev/backfillCuisines';
import { undeleteAllReviews } from './utils/undeleteReviews';
import { debugRinglingGrill } from './utils/debugRinglingGrill';
import { fixRinglingGrillSimple } from './utils/fixRinglingGrillSimple';

if (import.meta.env.DEV) {
  (window as any).runBackfillSoftDelete = runBackfillSoftDelete;
  (window as any).runBackfillCuisines = runBackfillCuisines;
  (window as any).undeleteAllReviews = undeleteAllReviews;
  (window as any).debugRinglingGrill = debugRinglingGrill;
  (window as any).fixRinglingGrillSimple = fixRinglingGrillSimple;
}

// MVP Coming Soon component for disabled features
const ComingSoon: React.FC<{ feature: string }> = ({ feature }) => (
  <div className="min-h-screen bg-white flex items-center justify-center p-4">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Coming Soon!</h2>
      <p className="text-gray-600 mb-6">{feature} will be available in a future update.</p>
      <p className="text-sm text-gray-500">Focus on discovering restaurants and tracking your food journey for now!</p>
    </div>
  </div>
);

// Loading screen component
const LoadingScreen: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => {
  const ts = new Date().toISOString();
  console.log('[NAV][LoadingScreen][render]', { ts, label });
  if (performance && performance.mark) {
    performance.mark(`LoadingScreen-render-${label}-${ts}`);
  }
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">{label}</p>
      </div>
    </div>
  );
};

// Top-level route shell that never unmounts and provides a stable background.
const RouteShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const renderStart = performance.now?.() ?? Date.now();
  console.log('[NAV][RouteShell][render]', {
    ts: new Date().toISOString(),
    path: location.pathname,
    renderStart,
  });

  useLayoutEffect(() => {
    const ts = new Date().toISOString();
    console.log('[NAV][RouteShell][layout-effect]', {
      ts,
      path: location.pathname,
    });
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        console.log('[NAV][RouteShell][raf]', {
          ts: new Date().toISOString(),
          path: location.pathname,
          perfNow: performance.now?.(),
        });
      });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#ffffff' }}>
      {children}
    </div>
  );
};

// Helper to log route location changes
const RouteLogger: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    const ts = new Date().toISOString();
    console.log('[NAV][location]', location.pathname + location.search, 'ts=', ts);
    if (performance && performance.mark) {
      performance.mark(`NAV-location-${location.pathname}-${ts}`);
    }
  }, [location.pathname, location.search]);
  return null;
};

export function App() {
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    needsUsername: boolean;
    isLoading: boolean;
  }>({
    isAuthenticated: false,
    needsUsername: false,
    isLoading: true
  });
  
  useEffect(() => {
    // Firebase Auth state listener - automatically handles session persistence
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('ðŸ” Auth state changed:', user ? `User ${user.uid}` : 'No user');
      
      if (user) {
        // User is signed in with Firebase Auth
        try {
          // Ensure minimal user profile exists
          await ensureUserProfile(user);
          // Check if user has completed profile setup
          const profileResult = await getUserProfile(user.uid);
          
          if (profileResult.success && profileResult.profile?.username) {
            // User is fully onboarded
            console.log('âœ… User authenticated and onboarded:', profileResult.profile.username);
            setAuthState({
              isAuthenticated: true,
              needsUsername: false,
              isLoading: false
            });
          } else {
            // User has Firebase auth but needs to complete profile (username)
            console.log('âš ï¸ User authenticated but needs username');
            setAuthState({
              isAuthenticated: true,
              needsUsername: true,
              isLoading: false
            });
          }
        } catch (error) {
          console.error('âŒ Error checking user profile:', error);
          // If there's an error checking profile, assume needs username
          setAuthState({
            isAuthenticated: true,
            needsUsername: true,
            isLoading: false
          });
        }
      } else {
        // No user signed in
        console.log('âŒ No authenticated user');
        setAuthState({
          isAuthenticated: false,
          needsUsername: false,
          isLoading: false
        });
      }
    });
    
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);
  
  // Show loading screen while checking auth state
  if (authState.isLoading) {
    return <LoadingScreen label={getRandomLoadingMessage()} />;
  }
  
  // Show onboarding if not authenticated or needs username
  if (!authState.isAuthenticated || authState.needsUsername) {
    return (
      <I18nProvider>
        <LocationProvider>
          <Router>
            <Onboarding 
              onComplete={() => {
                setAuthState({
                  isAuthenticated: true,
                  needsUsername: false,
                  isLoading: false
                });
              }}
              needsUsernameOnly={authState.needsUsername}
            />
          </Router>
        </LocationProvider>
      </I18nProvider>
    );
  }

  // User is fully authenticated and onboarded - show main app
  return (
    <I18nProvider>
      <LocationProvider>
        <Router>
        <RedirectAfterLogin />
        <RouteLogger />
        <RouteShell>
          {/* Suspense with minimal loading indicator */}
          <React.Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="discover" element={<Discover />} />
                <Route path="discover/list" element={<DiscoverList />} />
                <Route path="create" element={<Create />} />
                <Route 
                  path="notifications" 
                  element={
                    useFeature('NOTIFICATIONS') ? 
                    <Notifications /> : 
                    <ComingSoon feature="Notifications" />
                  } 
                />
                <Route path="recent-activity" element={<RecentActivity />} />
                <Route path="profile" element={<Profile />} />
                <Route path="user/:username" element={<PublicProfile />} />
                <Route path="profile/:username/map" element={<UserFoodMapPage />} />
                <Route path="rewards" element={<RewardsComingSoon />} />
                <Route path="list/:id" element={<ListDetail />} />
                <Route path="/food-map" element={<FoodMap />} />
                <Route path="/list-view" element={<FoodMap />} />
              </Route>
              <Route path="/profile/edit" element={<EditProfile />} />
              <Route path="/profile/change-password" element={<ChangePassword />} />
              <Route path="/restaurant/:id" element={<RestaurantDetail />} />
              <Route path="/restaurant/:id/menu" element={<MenuDetail />} />
              <Route path="/dish/:id" element={<MenuDetail />} />
              <Route path="/post/:postId" element={<PostDetail />} />
              <Route path="/admin-upload" element={<AdminUpload />} />
              <Route path="/admin/fix-restaurants" element={<FixRestaurants />} />
              <Route path="/admin/claims" element={<ClaimsReview />} />
              <Route path="/admin/reviews" element={<ReviewVerification />} />
              <Route path="/owner/*" element={<OwnerPortalLazy />} />
            </Routes>
          </React.Suspense>
        </RouteShell>
        </Router>
      </LocationProvider>
    </I18nProvider>
  );
}

// Lazy-load Owner Portal to keep bundle lean
const OwnerPortalLazy = React.lazy(() => import('./pages/owner/OwnerPortal'));
const ClaimsReview = React.lazy(() => import('./pages/admin/ClaimsReview'));
const ReviewVerification = React.lazy(() => import('./pages/admin/ReviewVerification'));

// Side-effect component to handle ?redirect=... after login
const RedirectAfterLogin: React.FC = () => {
  React.useEffect(() => {
    try {
      // Owners are normal users; we just honor redirect to /owner paths while remaining signed-in
      const sp = new URLSearchParams(window.location.search);
      const redirect = sp.get('redirect');
      if (redirect && typeof redirect === 'string') {
        // Clear the param to avoid loops
        sp.delete('redirect');
        const base = window.location.origin + window.location.pathname;
        const rest = sp.toString();
        const newUrl = rest ? `${base}?${rest}` : base;
        window.history.replaceState({}, '', newUrl);
        window.location.assign(redirect);
      }
    } catch {}
  }, []);
  return null;
};
