import React from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import DishCard, { DishCardData } from './DishCard';
import RestaurantCard, { RestaurantCardData } from './RestaurantCard';

interface MapBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: DishCardData[] | RestaurantCardData[];
  type: 'dish' | 'restaurant';
  onItemClick?: (id: string) => void;
}

const MapBottomSheet: React.FC<MapBottomSheetProps> = ({
  isOpen,
  onClose,
  items,
  type,
  onItemClick
}) => {
  const handleDragEnd = (e: any, info: { offset: { y: number }, velocity: { y: number } }) => {
    const { offset, velocity } = info;
    // Dragged down > 80px OR fast downward swipe = dismiss
    if (offset.y > 80 || (offset.y > 30 && velocity.y > 500)) {
      onClose();
    }
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
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="fixed bottom-[68px] left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
            style={{ height: '60vh', maxHeight: '600px' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Scrollable card list */}
            <div className="overflow-y-auto h-[calc(100%-40px)] px-4 pb-4">
              {items.map((item, idx) => (
                <React.Fragment key={type === 'dish' ? (item as DishCardData).id : (item as RestaurantCardData).id}>
                  {type === 'dish' ? (
                    <DishCard data={item as DishCardData} onClick={onItemClick} />
                  ) : (
                    <RestaurantCard data={item as RestaurantCardData} onClick={onItemClick} />
                  )}
                  {idx < items.length - 1 && (
                    <hr className="my-4 border-gray-200" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MapBottomSheet;
