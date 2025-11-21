import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, SearchIcon, PlusSquareIcon, UserIcon } from 'lucide-react';

const BottomNavigation: React.FC = () => {
  return (
    <nav className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] z-50 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ul className="grid grid-cols-4">
        <li className="min-w-0">
          <NavLink
            to="/"
            onClick={(e) => {
              e.stopPropagation();
              window.scrollTo({ top: window.scrollY, behavior: 'instant' });
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#FF385C] font-medium' : 'text-gray-500'}`
            }
          >
            <HomeIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">Home</span>
          </NavLink>
        </li>

        <li className="min-w-0">
          <NavLink
            to="/discover"
            onClick={(e) => {
              e.stopPropagation();
              window.scrollTo({ top: window.scrollY, behavior: 'instant' });
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#FF385C] font-medium' : 'text-gray-500'}`
            }
          >
            <SearchIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">Discover</span>
          </NavLink>
        </li>

        <li className="min-w-0">
          <NavLink
            to="/create"
            onClick={(e) => {
              e.stopPropagation();
              window.scrollTo({ top: window.scrollY, behavior: 'instant' });
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#FF385C] font-medium' : 'text-gray-500'}`
            }
          >
            <PlusSquareIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">Create</span>
          </NavLink>
        </li>

        <li className="min-w-0">
          <NavLink
            to="/profile"
            onClick={(e) => {
              e.stopPropagation();
              window.scrollTo({ top: window.scrollY, behavior: 'instant' });
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#FF385C] font-medium' : 'text-gray-500'}`
            }
          >
            <UserIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">Profile</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default BottomNavigation;
