import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, Star } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';

const RewardsComingSoon: React.FC = () => {
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

      {/* Main Content */}
      <div className="px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center">
            {/* Large Gold Coin Icon */}
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div 
                className="w-full h-full rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: '#FFD700' }}
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F59E0B' }}
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#FFD700' }}
                  >
                    <Star 
                      size={24} 
                      style={{ 
                        color: '#F59E0B', 
                        fill: '#F59E0B'
                      }} 
                    />
                  </div>
                </div>
              </div>
              {/* Shine effect */}
              <div 
                className="absolute top-2 left-2 w-4 h-4 rounded-full opacity-60"
                style={{ backgroundColor: '#FFF3CD' }}
              />
            </div>

            {/* Main Heading */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Rewards Coming Soon!
            </h2>

            {/* Subtext */}
            <p className="text-lg text-primary font-medium mb-4">
              Stay tuned!
            </p>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed mb-8 max-w-sm mx-auto">
              We're building exciting rewards that you'll be able to redeem with the points you've been earning. 
              Keep reviewing your favorite dishes and restaurants!
            </p>

            {/* Features Preview */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                What's Coming:
              </h3>
              <div className="space-y-3 text-left">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                  <span className="text-gray-700">Exclusive restaurant discounts</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                  <span className="text-gray-700">Free appetizers and desserts</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                  <span className="text-gray-700">VIP dining experiences</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                  <span className="text-gray-700">Gift cards to popular restaurants</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                  <span className="text-gray-700">Early access to new restaurant openings</span>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="pt-4">
              <Link 
                to="/create" 
                className="inline-block bg-primary text-white py-3 px-8 rounded-full font-semibold hover:bg-red-600 transition-colors shadow-sm"
              >
                Keep Earning Points
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

export default RewardsComingSoon;