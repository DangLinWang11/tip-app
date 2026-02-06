import React, { useState, useEffect } from 'react';
import { MapPinIcon } from 'lucide-react';
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

      {/* Review counter (matches Food Journey map styling) */}
      <div className="pointer-events-none absolute left-4 z-30" style={{ bottom: '88px' }}>
        <div className="rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.18)] border border-white/70 px-3 py-1.5 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 flex-shrink-0">
            <MapPinIcon size={20} className="text-secondary" />
          </div>
          <div className="flex flex-col items-start text-left leading-tight">
            <span className="text-[11px] uppercase tracking-[0.16em] text-gray-400">Reviews</span>
            <span className="text-[13px] font-semibold text-gray-800">
              {userProfile?.stats?.totalReviews ?? 0} total
            </span>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MyFoodMap;
