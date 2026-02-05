// File: src/components/LayoutWithPersistentShell.tsx
import React, { useEffect, useLayoutEffect } from 'react';
import BottomNavigation from './BottomNavigation';
import { PersistentShell } from './layout/PersistentShell';
import Home from '../pages/Home';
import DiscoverList from '../pages/DiscoverList';
import Profile from '../pages/Profile';
import MyFoodMap from '../pages/MyFoodMap';
import FoodMap from '../pages/FoodMap';
import RecentActivity from '../pages/RecentActivity';

/**
 * Layout with PersistentShell - keeps main tab components mounted
 * and toggles visibility instead of unmounting on navigation.
 *
 * This eliminates the Gray Screen by keeping Home and other tabs warm.
 */
const LayoutWithPersistentShell: React.FC = () => {
  useEffect(() => {
    // Defensive: ensure scrolling is enabled whenever the layout mounts
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, []);

  useLayoutEffect(() => {
    const ts = new Date().toISOString();
    console.log('[LayoutWithPersistentShell][layout-effect]', { ts });
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        console.log('[LayoutWithPersistentShell][raf]', {
          ts: new Date().toISOString(),
          perfNow: performance.now?.(),
        });
      });
    }
  }, []);

  // Define main tab routes that should persist
  const persistentRoutes = [
    { path: '/', element: <Home /> },
    { path: '/discover/list', element: <DiscoverList /> },
    { path: '/profile', element: <Profile /> },
    { path: '/food-map', element: <MyFoodMap /> },
    { path: '/list-view', element: <FoodMap /> },
    { path: '/recent-activity', element: <RecentActivity /> },
  ];

  return (
    <div className="app-container">
      <main className="pb-20 touch-pan-y">
        <PersistentShell>
          {persistentRoutes}
        </PersistentShell>
      </main>
      <BottomNavigation />
    </div>
  );
};

export default LayoutWithPersistentShell;
