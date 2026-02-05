import React from 'react';
import { Menu, Search, X } from 'lucide-react';

interface DiscoverHeaderProps {
  mode: 'restaurant' | 'dish';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchClear: () => void;
  onMenuClick?: () => void;
}

const DiscoverHeader: React.FC<DiscoverHeaderProps> = ({
  mode,
  searchQuery,
  onSearchChange,
  onSearchClear,
  onMenuClick,
}) => {
  const placeholder = 'Search restaurants or dishes...';

  return (
    <div className="pointer-events-none absolute left-4 right-4 top-4 z-40">
      <div className="pointer-events-auto rounded-3xl bg-white/92 backdrop-blur-xl shadow-[0_20px_40px_rgba(15,23,42,0.2)] border border-white/70 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-400 font-montserrat font-semibold">
          Discover
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-2xl border border-slate-100 bg-white/80 py-2.5 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100/70 font-poppins"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={onSearchClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white/90 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="h-10 w-10 rounded-full bg-white/90 backdrop-blur-xl shadow-[0_12px_28px_rgba(0,0,0,0.18)] border border-white/70 flex items-center justify-center"
              aria-label="View list"
            >
              <Menu className="h-4 w-4 text-slate-700" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoverHeader;
