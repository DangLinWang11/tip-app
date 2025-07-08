import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, Gift, Star, Camera, MessageCircle, MapPin, Trophy, Clock, Coins } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';

interface PointsActivity {
  id: string;
  type: 'review' | 'photo' | 'check_in' | 'bonus';
  points: number;
  description: string;
  date: string;
  restaurantName?: string;
}

const Rewards: React.FC = () => {
  const [totalPoints, setTotalPoints] = useState(1250);
  const [pointsHistory, setPointsHistory] = useState<PointsActivity[]>([
    {
      id: '1',
      type: 'review',
      points: 200,
      description: 'Reviewed Margherita Pizza',
      date: '2024-01-15',
      restaurantName: 'Tony\'s Italian Kitchen'
    },
    {
      id: '2',
      type: 'photo',
      points: 50,
      description: 'Added photo to review',
      date: '2024-01-15',
      restaurantName: 'Tony\'s Italian Kitchen'
    },
    {
      id: '3',
      type: 'check_in',
      points: 100,
      description: 'Checked in at restaurant',
      date: '2024-01-14',
      restaurantName: 'Sushi Zen'
    },
    {
      id: '4',
      type: 'review',
      points: 200,
      description: 'Reviewed Salmon Teriyaki',
      date: '2024-01-14',
      restaurantName: 'Sushi Zen'
    },
    {
      id: '5',
      type: 'bonus',
      points: 500,
      description: 'Weekly streak bonus',
      date: '2024-01-13',
    },
    {
      id: '6',
      type: 'review',
      points: 200,
      description: 'Reviewed Chicken Tacos',
      date: '2024-01-12',
      restaurantName: 'El Mariachi'
    }
  ]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'review':
        return <Star size={20} className="text-white" />;
      case 'photo':
        return <Camera size={20} className="text-white" />;
      case 'check_in':
        return <MapPin size={20} className="text-white" />;
      case 'bonus':
        return <Trophy size={20} className="text-white" />;
      default:
        return <Coins size={20} className="text-white" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'review':
        return 'bg-red-500';
      case 'photo':
        return 'bg-blue-500';
      case 'check_in':
        return 'bg-green-500';
      case 'bonus':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeftIcon size={20} className="text-gray-700" />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Rewards</h1>
          <div className="w-10 h-10" /> {/* Spacer */}
        </div>
      </div>

      {/* Points Balance Card */}
      <div className="px-4 py-6">
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #ff3131 0%, #ff1a1a 100%)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Total Points</p>
              <p className="text-4xl font-bold">{totalPoints.toLocaleString()}</p>
              <p className="text-red-100 text-sm mt-1">Keep earning to unlock rewards!</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-red-500" style={{ color: '#ff3131' }}>T</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift size={24} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Rewards Coming Soon!</h2>
            <p className="text-gray-600 mb-4">
              We're working on exciting rewards you can redeem with your points. Stay tuned!
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 font-medium">Potential Rewards:</p>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">• Restaurant discounts</p>
                <p className="text-sm text-gray-600">• Free appetizers</p>
                <p className="text-sm text-gray-600">• Exclusive dining experiences</p>
                <p className="text-sm text-gray-600">• Gift cards</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Points History */}
      <div className="px-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {pointsHistory.map((activity) => (
            <div key={activity.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{activity.description}</h3>
                      {activity.restaurantName && (
                        <p className="text-sm text-gray-600 mt-1">{activity.restaurantName}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-500 flex items-center" style={{ color: '#ff3131' }}>
                        +{activity.points}
                        <div className="w-3 h-3 bg-red-500 rounded-full flex items-center justify-center ml-1" style={{ backgroundColor: '#ff3131' }}>
                          <span className="text-xs font-bold text-white" style={{ fontSize: '8px' }}>T</span>
                        </div>
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center">
                        <Clock size={12} className="mr-1" />
                        {formatDate(activity.date)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How to Earn More Points */}
      <div className="px-4 mt-8 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Earn Points</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <Star size={16} className="text-red-500" style={{ color: '#ff3131' }} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Write Reviews</p>
                <p className="text-sm text-gray-600">200 points per review</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <Camera size={16} className="text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Add Photos</p>
                <p className="text-sm text-gray-600">50 points per photo</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <MapPin size={16} className="text-green-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Check In</p>
                <p className="text-sm text-gray-600">100 points per visit</p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                <Trophy size={16} className="text-yellow-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Weekly Streaks</p>
                <p className="text-sm text-gray-600">Bonus points for consistency</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default Rewards;