import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Discover from './pages/Discover';
import DiscoverList from './pages/DiscoverList';
import Create from './pages/Create';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import RecentActivity from './pages/RecentActivity';
import EditProfile from './pages/EditProfile';
import ListDetail from './pages/ListDetail';
import ChangePassword from './pages/ChangePassword';
import Rewards from './pages/Rewards';
import Onboarding from './pages/Onboarding';
import RestaurantDetail from './pages/RestaurantDetail';
import MenuDetail from './pages/MenuDetail';
import FoodMap from './pages/FoodMap';
import AdminUpload from './pages/AdminUpload';
import { LocationProvider } from './contexts/LocationContext';
import { useFeature } from './utils/features';

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

// Session management utilities
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const checkUserSession = () => {
  try {
    const userProfile = localStorage.getItem('userProfile');
    if (!userProfile) return { isValid: false, needsPhoneOnly: false };
    
    const profile = JSON.parse(userProfile);
    const now = Date.now();
    
    // Check if user is verified and has all required fields
    if (profile.isVerified && profile.phoneNumber && profile.username && profile.lastLogin) {
      const timeSinceLogin = now - profile.lastLogin;
      
      if (timeSinceLogin <= SESSION_DURATION) {
        // Valid session, user can skip onboarding
        return { isValid: true, needsPhoneOnly: false };
      } else {
        // Session expired, needs phone verification only
        return { isValid: false, needsPhoneOnly: true };
      }
    }
    
    return { isValid: false, needsPhoneOnly: false };
  } catch (error) {
    console.error('Error checking user session:', error);
    return { isValid: false, needsPhoneOnly: false };
  }
};

export function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [needsPhoneOnly, setNeedsPhoneOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const sessionCheck = checkUserSession();
    setIsOnboarded(sessionCheck.isValid);
    setNeedsPhoneOnly(sessionCheck.needsPhoneOnly);
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isOnboarded) {
    return (
      <Onboarding 
        onComplete={() => setIsOnboarded(true)} 
        needsPhoneOnly={needsPhoneOnly}
      />
    );
  }

  return (
    <LocationProvider>
      <Router>
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
            <Route path="rewards" element={<Rewards />} />
            <Route path="list/:id" element={<ListDetail />} />
            <Route path="/food-map" element={<FoodMap />} />
            <Route path="/list-view" element={<FoodMap />} />
          </Route>
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/profile/change-password" element={<ChangePassword />} />
          <Route path="/restaurant/:id" element={<RestaurantDetail />} />
          <Route path="/restaurant/:id/menu" element={<MenuDetail />} />
          <Route path="/dish/:id" element={<MenuDetail />} />
          <Route path="/admin-upload" element={<AdminUpload />} />
        </Routes>
      </Router>
    </LocationProvider>
  );
}