import React, { useState } from 'react';
import { SearchIcon, MapPinIcon, StarIcon } from 'lucide-react';
import { restaurants } from '../utils/mockData';
interface RestaurantSearchProps {
  onSelect: (restaurant: any) => void;
}
const RestaurantSearch: React.FC<RestaurantSearchProps> = ({
  onSelect
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const filteredRestaurants = restaurants.filter(restaurant => restaurant.name.toLowerCase().includes(query.toLowerCase()));
  return <div className="relative">
      <div className="flex items-center border border-medium-gray rounded-xl p-3">
        <SearchIcon size={20} className="text-dark-gray mr-2" />
        <input type="text" placeholder="Search for a restaurant..." value={query} onChange={e => {
        setQuery(e.target.value);
        setIsOpen(true);
      }} className="flex-1 focus:outline-none" />
      </div>
      {isOpen && query && <div className="absolute z-10 left-0 right-0 mt-2 bg-white rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filteredRestaurants.map(restaurant => <button key={restaurant.id} className="w-full p-3 flex items-start hover:bg-light-gray" onClick={() => {
        onSelect(restaurant);
        setQuery(restaurant.name);
        setIsOpen(false);
      }}>
              <img src={restaurant.coverImage} alt={restaurant.name} className="w-12 h-12 rounded-lg object-cover" />
              <div className="ml-3 flex-1 text-left">
                <div className="flex items-center">
                  <span className="font-medium">{restaurant.name}</span>
                  <div className="ml-2 flex items-center">
                    <StarIcon size={14} className="text-accent" />
                    <span className="ml-1 text-sm">{restaurant.rating}</span>
                  </div>
                </div>
                <div className="flex items-center text-sm text-dark-gray mt-1">
                  <MapPinIcon size={14} className="mr-1" />
                  <span>{restaurant.distance}</span>
                </div>
              </div>
            </button>)}
        </div>}
    </div>;
};
export default RestaurantSearch;