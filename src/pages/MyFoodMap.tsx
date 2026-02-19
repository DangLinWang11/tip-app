import React, { useState, useEffect } from 'react';
import UserJourneyMap from '../components/UserJourneyMap';
import { getCurrentUser, getUserProfile } from '../lib/firebase';
import { getUserVisitedRestaurants } from '../services/reviewService';
import { getTierFromPoints } from '../badges/badgeTiers';
import BottomNavigation from '../components/BottomNavigation';

const MyFoodMap: React.FC = () => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [journeyStats, setJourneyStats] = useState<{ reviews: number; countries: number }>({ reviews: 0, countries: 0 });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [profileResult, visitedRestaurants] = await Promise.all([
          getUserProfile(),
          getUserVisitedRestaurants()
        ]);

        if (profileResult.success && profileResult.profile) {
          setUserProfile(profileResult.profile);
        }

        const reviews = visitedRestaurants.reduce((sum, restaurant) => {
          const count = typeof restaurant.reviewCount === 'number'
            ? restaurant.reviewCount
            : (typeof restaurant.totalReviews === 'number' ? restaurant.totalReviews : 0);
          return sum + count;
        }, 0);
        const countries = new Set(
          visitedRestaurants
            .map((restaurant) => restaurant.countryCode)
            .filter((code): code is string => Boolean(code))
        ).size;
        setJourneyStats({ reviews, countries });
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
  const journeyReviews = journeyStats.reviews;
  const journeyCountries = journeyStats.countries;

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

      {/* Journey stats pill (matches Food Journey map styling) */}
      <div
        className="pointer-events-none absolute left-4 z-30"
        style={{ bottom: '88px' }}
        data-tour="mapdemo-empty-stats"
      >
        <div className="rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.18)] border border-white/70 px-3 py-1.5 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 flex-shrink-0">
            <svg width="24" height="30" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="journey_grad_my_map" x1="12" y1="2" x2="12" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FF6B6B"/>
                  <stop offset="100%" stopColor="#EE2D2D"/>
                </linearGradient>
                <radialGradient id="journey_depth_my_map" cx="40%" cy="35%" r="70%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="journey_shine_my_map" cx="0%" cy="0%" r="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path
                d="M 12 2
                   C 6.5 2, 2 6.5, 2 12
                   C 2 17.5, 12 30, 12 30
                   C 12 30, 22 17.5, 22 12
                   C 22 6.5, 17.5 2, 12 2 Z"
                fill="url(#journey_grad_my_map)"
                stroke="white"
                strokeWidth="2.25"
              />
              <circle cx="12" cy="12" r="10" fill="url(#journey_depth_my_map)" />
              <circle cx="9.2" cy="7.6" r="2.6" fill="url(#journey_shine_my_map)" />
              <text x="12" y="12" fontFamily="'Poppins', sans-serif" fontSize="12" fontWeight="800"
                textAnchor="middle" dominantBaseline="central" fill="#FFFFFF">
                {journeyReviews >= 100 ? '99+' : journeyReviews}
              </text>
            </svg>
          </div>
          <div className="flex flex-col items-start text-left leading-tight">
            <span className="text-[11px] uppercase tracking-[0.16em] text-gray-400">Journey Stats</span>
            <span className="text-[13px] font-semibold text-gray-800">
              🍽 {journeyReviews} reviews · 🌍 {journeyCountries} countries
            </span>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default MyFoodMap;
