// File: src/components/layout/PersistentShell.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';

interface PersistentShellProps {
  children: Array<{
    path: string;
    element: React.ReactElement;
    exact?: boolean;
  }>;
}

/**
 * Instagram-style persistent shell that keeps main tab components mounted
 * and toggles their visibility with CSS instead of unmounting them.
 *
 * This eliminates the "Gray Screen" by preventing the Home feed from ever
 * unmounting when navigating to detail pages.
 */
export const PersistentShell: React.FC<PersistentShellProps> = ({ children }) => {
  const location = useLocation();

  console.log('[PersistentShell][render]', {
    ts: new Date().toISOString(),
    currentPath: location.pathname,
    childrenCount: children.length,
  });

  return (
    <>
      {children.map(({ path, element, exact }) => {
        // Match exact path for index route, or starts-with for other routes
        const isActive = exact
          ? location.pathname === path
          : path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

        console.log('[PersistentShell]', {
          path,
          currentPath: location.pathname,
          isActive,
        });

        return (
          <div
            key={path}
            style={{
              display: isActive ? 'block' : 'none',
            }}
          >
            {element}
          </div>
        );
      })}
    </>
  );
};
