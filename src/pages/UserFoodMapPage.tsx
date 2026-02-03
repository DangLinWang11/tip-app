import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserJourneyMap from '../components/UserJourneyMap';
import { getUserByUsername } from '../lib/firebase';

const UserFoodMapPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      if (!username) {
        setError('Username is required');
        setLoading(false);
        return;
      }

      try {
        const result = await getUserByUsername(username);
        if (result.success && result.profile) {
          setUserProfile(result.profile);
        } else {
          setError(result.error || 'User not found');
        }
      } catch (err) {
        console.error('Error loading user:', err);
        setError('Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Map</h2>
          <p className="text-gray-600 mb-4">{error || 'User not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="h-[100vh]">
        <UserJourneyMap
          userId={userProfile.uid}
          userName={userProfile.username || userProfile.displayName || username}
          className="w-full h-full"
          showLegend={true}
          showControls={true}
          onBack={() => navigate(-1)}
          allowHomeCountryOverride={false}
        />
      </div>
    </div>
  );
};

export default UserFoodMapPage;
