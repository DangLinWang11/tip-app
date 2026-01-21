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
    <div className="flex items-center justify-start gap-6 mt-1 ml-4">
      <button
        onClick={onReviewsClick}
        className="text-center focus:outline-none"
      >
        <p className="text-lg font-normal text-gray-900">{reviewCount}</p>
        <p className="text-xs text-primary">Reviews</p>
      </button>

      <button
        onClick={onFollowersClick}
        className="text-center focus:outline-none"
      >
        <p className="text-lg font-normal text-gray-900">{followersCount}</p>
        <p className="text-xs text-primary">Followers</p>
      </button>

      <button
        onClick={onFollowingClick}
        className="text-center focus:outline-none"
      >
        <p className="text-lg font-normal text-gray-900">{followingCount}</p>
        <p className="text-xs text-primary">Following</p>
      </button>
    </div>
  );
};

export default ProfileStats;
