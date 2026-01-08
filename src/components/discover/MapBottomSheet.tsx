import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import DishCard, { DishCardData } from './DishCard';
import RestaurantCard, { RestaurantCardData } from './RestaurantCard';

interface MapBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: DishCardData[] | RestaurantCardData[];
  type: 'dish' | 'restaurant';
  currentIndex: number;
  onSwipe: (newIndex: number) => void;
  onItemClick?: (id: string) => void;
}

const SWIPE_CONFIDENCE_THRESHOLD = 10000;
const SWIPE_POWER = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

const MapBottomSheet: React.FC<MapBottomSheetProps> = ({
  isOpen,
  onClose,
  items,
  type,
  currentIndex,
  onSwipe,
  onItemClick
}) => {
  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number) => {
    const newIndex = currentIndex + newDirection;
    if (newIndex >= 0 && newIndex < items.length) {
      onSwipe(newIndex);
      setPage([newIndex, newDirection]);
    }
  };

  const handleDragEnd = (e: any, { offset, velocity }: PanInfo) => {
    const swipe = SWIPE_POWER(offset.x, velocity.x);

    if (swipe < -SWIPE_CONFIDENCE_THRESHOLD && currentIndex < items.length - 1) {
      paginate(1);
    } else if (swipe > SWIPE_CONFIDENCE_THRESHOLD && currentIndex > 0) {
      paginate(-1);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  if (!isOpen || items.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Bottom sheet container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
            style={{ height: '40vh', maxHeight: '400px' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 bg-white/90 rounded-full shadow-md hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-gray-700" />
            </button>

            {/* Swipeable card area */}
            <div className="relative h-[calc(100%-60px)] px-4 pb-6 overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={handleDragEnd}
                  className="h-full"
                >
                  {type === 'dish' ? (
                    <DishCard data={items[currentIndex] as DishCardData} onClick={onItemClick} />
                  ) : (
                    <RestaurantCard data={items[currentIndex] as RestaurantCardData} onClick={onItemClick} />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Pagination dots */}
              {items.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 pb-2">
                  {items.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const newDirection = idx > currentIndex ? 1 : -1;
                        setPage([idx, newDirection]);
                        onSwipe(idx);
                      }}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === currentIndex
                          ? 'w-6 bg-primary'
                          : 'w-2 bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to item ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MapBottomSheet;
