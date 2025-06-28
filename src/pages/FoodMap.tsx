import React, { useState } from 'react';
import { MapIcon, TrendingUpIcon, StarIcon, ClockIcon, MessageCircleIcon, PlusIcon, MapPinIcon } from 'lucide-react';

const FoodMap: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'recent' | 'journey'>('recent');
  
  // Sample user data - replace with real data later
  const userProfile = {
    profilePicture: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    points: 2685
  };

  const userStats = {
    averageRating: 8.2,
    totalRestaurants: 450,
    totalDishes: 950,
    pointsEarned: "10.2k"
  };

  const recentVisits = [
    { 
      id: 1,
      restaurant: "The Octane Burger", 
      location: "Ford's Garage",
      dish: "Classic Burger", 
      rating: 8.5, 
      date: "5h ago",
      personalNote: "Good choice! Solid burger, will have to order again. Added to the Best Bets!",
      triedTimes: 2,
      visitedTimes: 11,
      rewardReason: "New menu item review",
      pointsEarned: 250
    },
    { 
      id: 2,
      restaurant: "Cinnamon Roll", 
      location: "Philly's Diner",
      dish: "Cinnamon Roll with Ice Cream", 
      rating: 10, 
      date: "5d ago",
      personalNote: "Hands down one of the best desserts I've ever had. Warm roll with cold ice cream.",
      triedTimes: 1,
      visitedTimes: 7,
      rewardReason: "First-time visit bonus",
      pointsEarned: 150
    },
    { 
      id: 3,
      restaurant: "Pasta Paradise", 
      location: "Downtown",
      dish: "Truffle Pasta", 
      rating: 9.2, 
      date: "2 days ago",
      personalNote: "Ask for extra truffle oil - makes all the difference!",
      triedTimes: 3,
      visitedTimes: 5,
      rewardReason: "Featured dish promotion",
      pointsEarned: 300
    },
  ];

  const handleVisitClick = (visitId: number) => {
    // Navigate to the specific post - you'll implement this with your routing
    console.log(`Navigate to post ${visitId}`);
  };

  const handleAddNote = (visitId: number) => {
    // Handle adding/editing personal note
    console.log(`Add note for visit ${visitId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <MapIcon size={28} className="text-secondary mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-black">My Food Map</h1>
              <p className="text-gray-600">Your personal dining journey</p>
            </div>
          </div>
          <div className="flex items-center">
            <div className="bg-primary text-white px-3 py-1 rounded-full text-sm font-semibold mr-3">
              {userProfile.points} 🪙
            </div>
            <img 
              src={userProfile.profilePicture} 
              alt="Profile" 
              className="w-12 h-12 rounded-full border-2 border-gray-200"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 py-6">
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.averageRating}</p>
            <p className="text-xs text-gray-500 font-medium">Average Rating</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.totalRestaurants}</p>
            <p className="text-xs text-gray-500 font-medium">Restaurants</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.totalDishes}</p>
            <p className="text-xs text-gray-500 font-medium">Dishes</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <p className="text-2xl font-bold text-primary">{userStats.pointsEarned}</p>
            <p className="text-xs text-gray-500 font-medium">Points Earned</p>
          </div>
        </div>

        {/* Toggle Slider */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('recent')}
              className={`flex-1 py-3 text-center font-semibold ${
                activeTab === 'recent'
                  ? 'text-black border-b-2 border-primary'
                  : 'text-gray-500'
              }`}
            >
              Recent Visits
            </button>
            <button
              onClick={() => setActiveTab('journey')}
              className={`flex-1 py-3 text-center font-semibold ${
                activeTab === 'journey'
                  ? 'text-black border-b-2 border-primary'
                  : 'text-gray-500'
              }`}
            >
              My Food Journey
            </button>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'recent' ? (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search places or items..."
                className="w-full bg-gray-100 rounded-full py-3 px-4 pl-10 text-gray-700"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Recent Visits List */}
            {recentVisits.map((visit) => (
              <div 
                key={visit.id}
                onClick={() => handleVisitClick(visit.id)}
                className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                        <span className="text-white font-bold text-sm">{visit.rating}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-black">{visit.restaurant}</h3>
                        <p className="text-sm text-gray-600 flex items-center">
                          <MapPinIcon size={14} className="text-red-500 mr-1" />
                          {visit.location} ✓
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2 ml-11">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                        Tried {visit.triedTimes}x
                      </span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                        Visited {visit.visitedTimes}x
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <p className="text-sm text-gray-500">{visit.date}</p>
                    <div className="bg-primary text-white px-2 py-1 rounded-full text-xs font-semibold mt-1">
                      +{visit.pointsEarned}🪙
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{visit.rewardReason}</p>
                  </div>
                </div>

                {/* Personal Note */}
                <div className="ml-11">
                  {visit.personalNote ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Personal Comment:</p>
                      <div className="bg-green-100 text-green-800 p-3 rounded-lg text-sm italic">
                        {visit.personalNote}
                      </div>
                      <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <input
                          type="text"
                          placeholder="Add another personal note..."
                          className="flex-1 bg-transparent text-sm text-gray-600 placeholder-gray-400 border-none outline-none"
                        />
                        <PlusIcon size={16} className="text-gray-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">Personal Comment:</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddNote(visit.id);
                        }}
                        className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-full text-left hover:bg-gray-100"
                      >
                        <span className="text-sm text-gray-500 mr-2">Add personal note...</span>
                        <PlusIcon size={16} className="text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* My Food Journey - Map View */
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-black mb-4">Your Food Journey</h2>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapIcon size={48} className="text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">Interactive map coming soon!</p>
                <p className="text-sm text-gray-500">See all your visited restaurants on a map</p>
              </div>
            </div>

            {/* Simple Journey Stats */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">15</p>
                <p className="text-sm text-black">Miles Traveled</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">8</p>
                <p className="text-sm text-black">Neighborhoods</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodMap;