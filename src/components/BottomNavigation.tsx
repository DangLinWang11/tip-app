import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, PlusSquareIcon, UserIcon } from 'lucide-react';

const BottomNavigation: React.FC = () => {
  return (
    <nav className="bottom-nav pb-safe">
      <div className="max-w-md mx-auto px-4 py-2 pb-6 flex justify-between items-center">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
          }
        >
          <HomeIcon size={18} />
          <span className="text-xs mt-2">My Food Map</span>
        </NavLink>

        <NavLink 
          to="/discover" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
          }
        >
          <SearchIcon size={18} />
          <span className="text-xs mt-2">Discover</span>
        </NavLink>

        <NavLink to="/create" className="flex flex-col items-center justify-center">
          <div className="bg-primary rounded-full p-1.5">
            <PlusSquareIcon size={18} color="white" />
          </div>
          <span className="text-xs mt-1 text-dark-gray">Add Review</span>
        </NavLink>

        <NavLink 
          to="/profile" 
          className={({ isActive }) => 
            `flex flex-col items-center justify-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
          }
        >
          <UserIcon size={18} />
          <span className="text-xs mt-2">Profile</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNavigation;