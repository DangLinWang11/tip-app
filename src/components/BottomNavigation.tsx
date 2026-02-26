import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { HomeIcon, MapIcon, PlusSquareIcon, UserIcon, RefreshCw } from 'lucide-react';
import { useI18n } from '../lib/i18n/useI18n';

const BottomNavigation: React.FC = () => {
  const location = useLocation();
  const { t } = useI18n();
  const [homeRefreshing, setHomeRefreshing] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleComplete = () => setHomeRefreshing(false);
    window.addEventListener('tip:home-refresh-complete', handleComplete);
    return () => window.removeEventListener('tip:home-refresh-complete', handleComplete);
  }, []);

  useEffect(() => {
    let blurTimeout: number | null = null;

    const isTextInput = (element: Element | null) => {
      if (!element) return false;
      if (element instanceof HTMLInputElement) {
        const type = element.type;
        return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(type);
      }
      if (element instanceof HTMLTextAreaElement) return true;
      if (element instanceof HTMLSelectElement) return true;
      return (element as HTMLElement).isContentEditable === true;
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (blurTimeout) {
        window.clearTimeout(blurTimeout);
        blurTimeout = null;
      }
      if (isTextInput(event.target as Element)) {
        setKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      if (blurTimeout) {
        window.clearTimeout(blurTimeout);
      }
      blurTimeout = window.setTimeout(() => {
        if (!isTextInput(document.activeElement)) {
          setKeyboardOpen(false);
        }
      }, 100);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (blurTimeout) {
        window.clearTimeout(blurTimeout);
      }
    };
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
    <nav
      className={`fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] z-50 transition-transform duration-200 ${
        keyboardOpen ? 'translate-y-full pointer-events-none' : 'translate-y-0'
      }`}
      aria-hidden={keyboardOpen}
    >
      <div
        className="absolute inset-x-0 bottom-0 bg-white"
        style={{ height: 'env(safe-area-inset-bottom)' }}
        aria-hidden="true"
      />
      <ul className="grid grid-cols-4 relative pb-[12px]">
        <li className="min-w-0 w-full">
          <NavLink
            to="/"
            onClick={(e) => {
              e.stopPropagation();
              handleHomeClick();
            }}
            className={({ isActive }) =>
              `flex w-full flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#ff3131] font-medium' : 'text-gray-500'}`
            }
          >
            <span className="relative h-7 w-7 flex items-center justify-center">
              {homeRefreshing && location.pathname === '/' ? (
                <RefreshCw className="h-6 w-6 animate-spin text-[#ff3131]" aria-hidden="true" />
              ) : (
                <HomeIcon className="h-7 w-7" aria-hidden="true" />
              )}
            </span>
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">{t('nav.home')}</span>
          </NavLink>
        </li>

        <li className="min-w-0 w-full">
          <NavLink
            to="/discover"
            onClick={(e) => {
              e.stopPropagation();
              window.scrollTo({ top: window.scrollY, behavior: 'instant' });
            }}
            className={({ isActive }) =>
              `flex w-full flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#ff3131] font-medium' : 'text-gray-500'}`
            }
          >
            <MapIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">{t('nav.foodMap')}</span>
          </NavLink>
        </li>

        <li className="min-w-0 w-full">
          <NavLink
            to="/create"
            onClick={(e) => {
              e.stopPropagation();
              window.scrollTo({ top: window.scrollY, behavior: 'instant' });
            }}
            className={({ isActive }) =>
              `flex w-full flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#ff3131] font-medium' : 'text-gray-500'}`
            }
          >
            <PlusSquareIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">{t('nav.create')}</span>
          </NavLink>
        </li>

        <li className="min-w-0 w-full">
          <NavLink
            to="/profile"
            onClick={(e) => {
              e.stopPropagation();
              window.scrollTo({ top: window.scrollY, behavior: 'instant' });
            }}
            className={({ isActive }) =>
              `flex w-full flex-col items-center justify-center gap-1 py-2 text-center ${isActive ? 'text-[#ff3131] font-medium' : 'text-gray-500'}`
            }
          >
            <UserIcon className="h-7 w-7" aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">{t('nav.profile')}</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default BottomNavigation;
