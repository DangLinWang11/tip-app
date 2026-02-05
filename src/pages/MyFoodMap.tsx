import React, { useState, useEffect } from 'react';
import UserJourneyMap from '../components/UserJourneyMap';
import { getCurrentUser, getUserProfile } from '../lib/firebase';
import { getTierFromPoints } from '../badges/badgeTiers';
import BottomNavigation from '../components/BottomNavigation';

const MyFoodMap: React.FC = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const result = await getUserProfile();
        if (result.success && result.profile) {
          setUserProfile(result.profile);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const currentUser = getCurrentUser();
  const tierInfo = getTierFromPoints(userProfile?.stats?.pointsEarned ?? 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your food map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white">
      {/* Full-screen map - extends edge to edge */}
      <UserJourneyMap
        className="w-full h-full"
        fullBleed
        showLegend
        showControls
        userName={userProfile?.username || userProfile?.displayName}
        userTierIndex={tierInfo.tierIndex}
        userAvatar={userProfile?.avatar || userProfile?.photoURL || currentUser?.photoURL}
        homeCountry={userProfile?.homeCountry}
        allowHomeCountryOverride={true}
      />

      <BottomNavigation />
    </div>
  );
};

export default MyFoodMap;
