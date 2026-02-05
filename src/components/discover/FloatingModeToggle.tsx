import React from 'react';
import { Store } from 'lucide-react';

const DishIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    className={className}
    fill="none"
  >
    <path
      d="M48.07,104H207.93a16,16,0,0,0,15.72-19.38C216.22,49.5,176,24,128,24S39.78,49.5,32.35,84.62A16,16,0,0,0,48.07,104ZM128,40c39.82,0,74.21,20.61,79.93,48H48.07L48,87.93C53.79,60.61,88.18,40,128,40ZM229.26,152.48l-41.13,15L151,152.57a8,8,0,0,0-5.94,0l-37,14.81L71,152.57a8,8,0,0,0-5.7-.09l-44,16a8,8,0,0,0,5.47,15L40,178.69V184a40,40,0,0,0,40,40h96a40,40,0,0,0,40-40v-9.67l18.73-6.81a8,8,0,1,0-5.47-15ZM200,184a24,24,0,0,1-24,24H80a24,24,0,0,1-24-24V172.88l11.87-4.32L105,183.43a8,8,0,0,0,5.94,0l37-14.81,37,14.81a8,8,0,0,0,5.7.09l9.27-3.37ZM16,128a8,8,0,0,1,8-8H232a8,8,0,0,1,0,16H24A8,8,0,0,1,16,128Z"
      fill="currentColor"
    />
  </svg>
);

interface FloatingModeToggleProps {
  mode: 'restaurant' | 'dish';
  onModeChange: (mode: 'restaurant' | 'dish') => void;
}

const FloatingModeToggle: React.FC<FloatingModeToggleProps> = ({ mode, onModeChange }) => {
  const isRestaurant = mode === 'restaurant';

  return (
    <div className="absolute right-2 top-[118px] z-30">
      <div className="relative w-[100px] h-[44px] rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-white/70 flex items-center">
        <div
          className={`absolute top-1 left-1 h-[36px] w-[46px] rounded-full bg-primary shadow transition-transform duration-300 ease-out ${
            isRestaurant ? 'translate-x-0' : 'translate-x-[46px]'
          }`}
        />
        <button
          type="button"
          onClick={() => onModeChange('restaurant')}
          className="relative z-10 flex h-full w-1/2 items-center justify-center"
          aria-label="Restaurant map"
        >
          <Store className={`h-4 w-4 ${isRestaurant ? 'text-white' : 'text-slate-400'}`} />
        </button>
        <button
          type="button"
          onClick={() => onModeChange('dish')}
          className="relative z-10 flex h-full w-1/2 items-center justify-center"
          aria-label="Dish map"
        >
          <DishIcon className={`h-4 w-4 ${!isRestaurant ? 'text-white' : 'text-slate-400'}`} />
        </button>
      </div>
    </div>
  );
};

export default FloatingModeToggle;
