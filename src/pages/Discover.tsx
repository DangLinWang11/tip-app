import React, { useState } from 'react';
import { SearchIcon, FilterIcon, MapPinIcon, StarIcon } from 'lucide-react';
import { restaurants } from '../utils/mockData';
import RestaurantMap from '../components/RestaurantMap';

const Discover: React.FC = () => {
  const [mapType, setMapType] = useState<'restaurant' | 'dish'>('restaurant');
  const [isListView, setIsListView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white sticky top-0 z-10 p-4 shadow-sm">
        <div className="flex items-center mb-4">
          <div className="relative flex-1">
            <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-gray" />
            <input
              type="text"
              placeholder="Search restaurants, dishes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-light-gray rounded-full text-sm"
            />
          </div>
          <button className="ml-2 p-2 rounded-full bg-light-gray">
            <FilterIcon size={20} />
          </button>
        </div>
        
        {/* Restaurant Map | Dish Map Toggle */}
        <div className="flex mb-3">
          <button
            className={`flex-1 py-2 text-center rounded-l-full ${
              mapType === 'restaurant' ? 'bg-primary text-white' : 'bg-light-gray'
            }`}
            onClick={() => setMapType('restaurant')}
          >
            Restaurant Map
          </button>
          <button
            className={`flex-1 py-2 text-center rounded-r-full ${
              mapType === 'dish' ? 'bg-primary text-white' : 'bg-light-gray'
            }`}
            onClick={() => setMapType('dish')}
          >
            Dish Map
          </button>
        </div>
      </header>

      {/* Map Section */}
      <div className="relative">
        <div className="h-[calc(100vh-220px)]">
          <RestaurantMap mapType={mapType} />
        </div>
        
        {/* Restaurant cards at bottom with List View toggle */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t">
          {/* List View Toggle */}
          <div className="flex justify-center py-2 border-b">
            <div className="flex bg-light-gray rounded-full">
              <button
                className={`px-4 py-1 text-sm rounded-full ${
                  !isListView ? 'bg-primary text-white' : 'text-gray-600'
                }`}
                onClick={() => setIsListView(false)}
              >
                Card View
              </button>
              <button
                className={`px-4 py-1 text-sm rounded-full ${
                  isListView ? 'bg-primary text-white' : 'text-gray-600'
                }`}
                onClick={() => setIsListView(true)}
              >
                List View
              </button>
            </div>
          </div>

          {/* Restaurant Cards */}
          {!isListView ? (
            <div className="p-4 overflow-x-auto flex space-x-3 pb-6">
              {restaurants.map(restaurant => (
                <div key={restaurant.id} className="bg-white rounded-xl shadow-sm p-3 min-w-[200px] border">
                  <img
                    src={restaurant.coverImage}
                    alt={restaurant.name}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                  <h3 className="font-medium">{restaurant.name}</h3>
                  <div className="flex items-center text-sm text-dark-gray">
                    <span>{restaurant.cuisine}</span>
                    <span className="mx-1">•</span>
                    <span>{restaurant.distance}</span>
                  </div>
                  <div className="flex items-center mt-1">
                    <StarIcon size={16} className="text-accent mr-1" />
                    <span className="font-medium text-sm">{restaurant.rating}</span>
                    <div className="ml-2 px-2 py-0.5 bg-light-gray rounded-full">
                      <span className="text-xs">{restaurant.qualityPercentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <div className="space-y-3">
                {restaurants.map(restaurant => (
                  <div key={restaurant.id} className="bg-white rounded-xl shadow-sm flex overflow-hidden border">
                    <img
                      src={restaurant.coverImage}
                      alt={restaurant.name}
                      className="w-20 h-20 object-cover"
                    />
                    <div className="p-3 flex-1">
                      <h3 className="font-medium">{restaurant.name}</h3>
                      <div className="flex items-center text-sm text-dark-gray">
                        <span>{restaurant.cuisine}</span>
                        <span className="mx-1">•</span>
                        <span>{restaurant.priceRange}</span>
                      </div>
                      <div className="flex items-center mt-1 justify-between">
                        <div className="flex items-center">
                          <StarIcon size={16} className="text-accent mr-1" />
                          <span className="font-medium text-sm">{restaurant.rating}</span>
                        </div>
                        <div className="flex items-center">
                          <MapPinIcon size={14} className="text-dark-gray mr-1" />
                          <span className="text-xs text-dark-gray">{restaurant.distance}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Discover;