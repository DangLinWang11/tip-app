import React, { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';
import { PersistentShell } from './layout/PersistentShell';
import Home from '../pages/Home';
import DiscoverList from '../pages/DiscoverList';
import Profile from '../pages/Profile';
import MyFoodMap from '../pages/MyFoodMap';
import FoodMap from '../pages/FoodMap';
import RecentActivity from '../pages/RecentActivity';
import { TourProvider } from '../tour/TourProvider';

const Layout: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Defensive: ensure scrolling is enabled whenever the layout mounts
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, []);

  useLayoutEffect(() => {
    const ts = new Date().toISOString();
    console.log('[Layout][layout-effect]', { ts });
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        console.log('[Layout][raf]', {
          ts: new Date().toISOString(),
          perfNow: performance.now?.(),
        });
      });
    }
  }, []);

  // Define main tab routes that should persist (never unmount)
  const persistentRoutes = [
    { path: '/', element: <Home /> },
    { path: '/discover/list', element: <DiscoverList /> },
    { path: '/profile', element: <Profile /> },
    { path: '/food-map', element: <MyFoodMap /> },
    { path: '/list-view', element: <FoodMap /> },
    { path: '/recent-activity', element: <RecentActivity /> },
  ];

  // Check if current route is a persistent tab route
  const isPersistentRoute = persistentRoutes.some(route => {
    if (route.path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(route.path);
  });

  return (
    <TourProvider>
      <div className="app-container">
        <main className="pb-20 touch-pan-y">
          {isPersistentRoute ? (
            <PersistentShell>
              {persistentRoutes}
            </PersistentShell>
          ) : (
            <Outlet />
          )}
        </main>
        <BottomNavigation />
      </div>
    </TourProvider>
  );
};
export default Layout;
