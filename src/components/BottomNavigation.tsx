import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, PlusSquareIcon, UserIcon } from 'lucide-react';

const BottomNavigation: React.FC = () => {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-50 pb-[calc(env(safe-area-inset-bottom)+8px)]">
      <ul className="grid grid-cols-4">
        <li className="min-w-0">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
            }
          >
            <HomeIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs leading-none">My Food Map</span>
          </NavLink>
        </li>

        <li className="min-w-0">
          <NavLink
            to="/discover"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
            }
          >
            <SearchIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs leading-none">Discover</span>
          </NavLink>
        </li>

        <li className="min-w-0">
          <NavLink
            to="/create"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
            }
          >
            <PlusSquareIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs leading-none">Add Review</span>
          </NavLink>
        </li>

        <li className="min-w-0">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-primary' : 'text-dark-gray'}`
            }
          >
            <UserIcon className="h-6 w-6" aria-hidden="true" />
            <span className="text-xs leading-none">Profile</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default BottomNavigation;
