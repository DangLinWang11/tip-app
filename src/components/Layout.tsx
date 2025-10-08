import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNavigation from './BottomNavigation';
const Layout: React.FC = () => {
  return <div className="app-container">
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>;
};
export default Layout;
