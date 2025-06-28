import React, { useState } from 'react';
import { SearchIcon, FilterIcon, MapPinIcon, StarIcon } from 'lucide-react';
import { restaurants } from '../utils/mockData';
import RestaurantMap from '../components/RestaurantMap';
const Discover: React.FC = () => {
  const [isMapView, setIsMapView] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  return <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white sticky top-0 z-10 p-4 shadow-sm">
        <div className="flex items-center mb-4">
          <div className="relative flex-1">
            <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-gray" />
            <input type="text" placeholder="Search restaurants, dishes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-light-gray rounded-full text-sm" />
          </div>
          <button className="ml-2 p-2 rounded-full bg-light-gray">
            <FilterIcon size={20} />
          </button>
        </div>
        <div className="flex">
          <button className={`flex-1 py-2 text-center rounded-l-full ${isMapView ? 'bg-primary text-white' : 'bg-light-gray'}`} onClick={() => setIsMapView(true)}>
            Map View
          </button>
          <button className={`flex-1 py-2 text-center rounded-r-full ${!isMapView ? 'bg-primary text-white' : 'bg-light-gray'}`} onClick={() => setIsMapView(false)}>
            List View
          </button>
        </div>
      </header>
      {isMapView ? <div className="relative">
          <div className="h-[calc(100vh-180px)]">
            <RestaurantMap />
          </div>
          {/* Restaurant cards at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4 overflow-x-auto flex space-x-3 pb-6">
            {restaurants.map(restaurant => <div key={restaurant.id} className="bg-white rounded-xl shadow-sm p-3 min-w-[200px]">
                <img src={restaurant.coverImage} alt={restaurant.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                <h3 className="font-medium">{restaurant.name}</h3>
                <div className="flex items-center text-sm text-dark-gray">
                  <span>{restaurant.cuisine}</span>
                  <span className="mx-1">•</span>
                  <span>{restaurant.distance}</span>
                </div>
                <div className="flex items-center mt-1">
                  <StarIcon size={16} className="text-accent mr-1" />
                  <span className="font-medium text-sm">
                    {restaurant.rating}
                  </span>
                  <div className="ml-2 px-2 py-0.5 bg-light-gray rounded-full">
                    <span className="text-xs">
                      {restaurant.qualityPercentage}%
                    </span>
                  </div>
                </div>
              </div>)}
          </div>
        </div> : <div className="p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Popular Near You</h2>
            <div className="grid grid-cols-2 gap-3">
              {restaurants.map(restaurant => <div key={restaurant.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <img src={restaurant.coverImage} alt={restaurant.name} className="w-full h-32 object-cover" />
                  <div className="p-3">
                    <h3 className="font-medium">{restaurant.name}</h3>
                    <div className="flex items-center text-sm text-dark-gray">
                      <span>{restaurant.cuisine}</span>
                      <span className="mx-1">•</span>
                      <span>{restaurant.priceRange}</span>
                    </div>
                    <div className="flex items-center mt-1">
                      <StarIcon size={16} className="text-accent mr-1" />
                      <span className="font-medium text-sm">
                        {restaurant.rating}
                      </span>
                      <div className="ml-auto flex items-center">
                        <MapPinIcon size={14} className="text-dark-gray mr-1" />
                        <span className="text-xs text-dark-gray">
                          {restaurant.distance}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>)}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Top Rated Dishes</h2>
            <div className="space-y-3">
              {restaurants.flatMap(restaurant => restaurant.posts.map(post => <div key={post.id} className="bg-white rounded-xl shadow-sm flex overflow-hidden">
                      <img src={post.image} alt={post.dish} className="w-24 h-24 object-cover" />
                      <div className="p-3 flex-1">
                        <h3 className="font-medium">{post.dish}</h3>
                        <p className="text-sm text-dark-gray">
                          {restaurant.name}
                        </p>
                        <div className="flex items-center mt-1">
                          <div className="flex items-center">
                            <StarIcon size={16} className="text-accent mr-1" />
                            <span className="font-medium text-sm">
                              {post.rating}
                            </span>
                          </div>
                          <span className="mx-2 text-dark-gray">•</span>
                          <span className="text-sm font-medium">
                            {post.price}
                          </span>
                        </div>
                      </div>
                    </div>)).slice(0, 5)}
            </div>
          </div>
        </div>}
    </div>;
};
export default Discover;