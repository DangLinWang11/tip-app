import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, PlusSquareIcon, UserIcon } from 'lucide-react';

const BottomNavigation: React.FC = () => {
  return (
    <nav className="bottom-nav">
      <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex flex-col items-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
          }
        >
          <HomeIcon size={24} />
          <span className="text-xs mt-1">My Food Map</span>
        </NavLink>

        <NavLink 
          to="/discover" 
          className={({ isActive }) => 
            `flex flex-col items-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
          }
        >
          <SearchIcon size={24} />
          <span className="text-xs mt-1">Discover</span>
        </NavLink>

        <NavLink to="/create" className="flex flex-col items-center">
          <div className="bg-primary rounded-full p-2">
            <PlusSquareIcon size={24} color="white" />
          </div>
          <span className="text-xs mt-1 text-dark-gray">Add Review</span>
        </NavLink>

        <NavLink 
          to="/profile" 
          className={({ isActive }) => 
            `flex flex-col items-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
          }
        >
          <UserIcon size={24} />
          <span className="text-xs mt-1">Profile</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNavigation;