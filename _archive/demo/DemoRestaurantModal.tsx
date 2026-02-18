import React from 'react';
import { X } from 'lucide-react';
import type { DemoRestaurant } from './demoJourney';

interface DemoRestaurantModalProps {
  restaurant: DemoRestaurant | null;
  isOpen: boolean;
  onClose: () => void;
}

const DemoRestaurantModal: React.FC<DemoRestaurantModalProps> = ({ restaurant, isOpen, onClose }) => {
  if (!isOpen || !restaurant) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl"
        data-tour="mapdemo-pin-card"
      >
        <div className="bg-white p-6 relative border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close demo"
          >
            <X size={20} className="text-gray-600" />
          </button>

          <div className="flex items-start gap-4">
            <div className="flex flex-col items-start gap-2">
              <div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center text-gray-400 text-xl">
                {restaurant.photoUrl ? (
                  <img src={restaurant.photoUrl} alt={restaurant.name} className="h-full w-full object-cover" />
                ) : (
                  <span>🍽️</span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                Example
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-black leading-tight">{restaurant.name}</h3>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                  {restaurant.cuisine}
                </span>
                <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
                  {restaurant.rating.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Demo journey pin</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-4 py-4">
          <div className="space-y-3">
            {restaurant.reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{review.dish}</p>
                    <p className="text-sm text-gray-600 mt-1">{review.note}</p>
                    <div className="text-xs text-gray-400 mt-2">{review.createdAt}</div>
                  </div>
                  <div className="text-primary font-bold text-xl flex-shrink-0">
                    {review.rating.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Close button is in the header */}
      </div>
    </div>
  );
};

export default DemoRestaurantModal;
