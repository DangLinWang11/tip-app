import React, { useEffect, useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';
const Layout: React.FC = () => {
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

  return (
    <div className="app-container">
      <main className="pb-20 touch-pan-y">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
};
export default Layout;
