import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { COUNTRIES, CountryData, searchCountries } from '../data/countries';
import { getCountryFromCoordinates } from '../utils/reverseGeocode';

interface CountrySelectorProps {
  selectedCountry: CountryData | null;
  onSelect: (country: CountryData) => void;
  autoDetect?: boolean;
}

const CountrySelector: React.FC<CountrySelectorProps> = ({
  selectedCountry,
  onSelect,
  autoDetect = true,
}) => {
  const [query, setQuery] = useState('');
  const [detecting, setDetecting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCountries = useMemo(() => searchCountries(query), [query]);

  // Auto-detect country from browser geolocation
  useEffect(() => {
    if (!autoDetect || selectedCountry) return;

    if (!navigator.geolocation) return;

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await getCountryFromCoordinates(
            position.coords.latitude,
            position.coords.longitude
          );
          if (result) {
            const match = COUNTRIES.find(c => c.code === result.code);
            if (match) {
              onSelect(match);
            }
          }
        } catch {
          // Silently fail - user can pick manually
        } finally {
          setDetecting(false);
        }
      },
      () => {
        // Geolocation denied or failed
        setDetecting(false);
      },
      { timeout: 8000, maximumAge: 300000 }
    );
  }, [autoDetect]);

  return (
    <div className="flex flex-col h-full">
      <p className="text-sm text-center text-gray-500 font-poppins mb-4">
        We'll start your food map here
      </p>

      {/* Search input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-poppins focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      {detecting && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 px-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Detecting your location...</span>
        </div>
      )}

      {/* Selected country indicator */}
      {selectedCountry && !query && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-lg">{selectedCountry.flag}</span>
          <span className="text-sm font-medium text-gray-900">{selectedCountry.name}</span>
          <span className="ml-auto text-xs text-primary font-medium">Selected</span>
        </div>
      )}

      {/* Country list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100"
        style={{ maxHeight: '300px' }}
      >
        {filteredCountries.map((country) => {
          const isSelected = selectedCountry?.code === country.code;
          return (
            <button
              key={country.code}
              type="button"
              onClick={() => onSelect(country)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'bg-red-50 border-l-2 border-l-primary'
                  : 'hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">{country.flag}</span>
              <span className={`text-sm ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {country.name}
              </span>
              {isSelected && (
                <span className="ml-auto text-xs text-primary font-medium">
                  &#10003;
                </span>
              )}
            </button>
          );
        })}
        {filteredCountries.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No countries found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
};

export default CountrySelector;
