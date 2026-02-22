import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { HomeIcon, MapIcon, PlusSquareIcon, UserIcon, RefreshCw } from 'lucide-react';
import { useI18n } from '../lib/i18n/useI18n';

const BottomNavigation: React.FC = () => {
  const location = useLocation();
  const { t } = useI18n();
  const [homeRefreshing, setHomeRefreshing] = useState(false);

  useEffect(() => {
    const handleComplete = () => setHomeRefreshing(false);
    window.addEventListener('tip:home-refresh-complete', handleComplete);
    return () => window.removeEventListener('tip:home-refresh-complete', handleComplete);
  }, []);

  const handleHomeClick = () => {
    if (location.pathname === '/') {
      setHomeRefreshing(true);
      window.dispatchEvent(new CustomEvent('tip:home-refresh', { detail: { source: 'nav' } }));
    } else {
      sessionStorage.setItem('tip:home-refresh', '1');
    }
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] z-50 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ul className="grid grid-cols-4">
        <li className="min-w-0">
          <NavLink
            to="/"
            onClick={(e) => {
              e.stopPropagation();
              handleHomeClick();
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#FF385C] font-medium' : 'text-gray-500'}`
            }
          >
            <span className="relative h-7 w-7 flex items-center justify-center">
              {homeRefreshing && location.pathname === '/' ? (
                <RefreshCw className="h-6 w-6 animate-spin text-[#FF385C]" aria-hidden="true" />
              ) : (
                <HomeIcon className="h-7 w-7" aria-hidden="true" />
              )}
            </span>
            <span className="text-[11px] font-medium leading-none">{t('nav.home')}</span>
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
            <MapIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">{t('nav.foodMap')}</span>
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
            <span className="text-[11px] font-medium leading-none">{t('nav.create')}</span>
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
            <span className="text-[11px] font-medium leading-none">{t('nav.profile')}</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default BottomNavigation;
