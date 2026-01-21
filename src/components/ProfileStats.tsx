import React from 'react';

interface ProfileStatsProps {
  reviewCount: number;
  followersCount: number;
  followingCount: number;
  onReviewsClick?: () => void;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
}

const ProfileStats: React.FC<ProfileStatsProps> = ({
  reviewCount,
  followersCount,
  followingCount,
  onReviewsClick,
  onFollowersClick,
  onFollowingClick
}) => {
  return (
    <div className="flex items-center justify-start gap-6 mt-1">
      <button
        onClick={onReviewsClick}
        className="text-center focus:outline-none"
      >
        <p className="text-lg font-bold text-gray-900">{reviewCount}</p>
        <p className="text-xs text-gray-500">Reviews</p>
      </button>

      <button
        onClick={onFollowersClick}
        className="text-center focus:outline-none"
      >
        <p className="text-lg font-bold text-gray-900">{followersCount}</p>
        <p className="text-xs text-gray-500">Followers</p>
      </button>

      <button
        onClick={onFollowingClick}
        className="text-center focus:outline-none"
      >
        <p className="text-lg font-bold text-gray-900">{followingCount}</p>
        <p className="text-xs text-gray-500">Following</p>
      </button>
    </div>
  );
};

export default ProfileStats;
