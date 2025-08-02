import React, { useRef, useCallback } from 'react';

interface RatingSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

const RatingSlider: React.FC<RatingSliderProps> = ({
  value,
  onChange,
  label
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newValue = Math.round(percentage * 20) / 2; // Round to 0.5 increments (0.0 to 10.0)
    onChange(newValue);
  }, [onChange]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    updateValue(e.clientX);
    e.preventDefault();
  }, [updateValue]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current) {
      updateValue(e.clientX);
    }
  }, [updateValue]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    const touch = e.touches[0];
    updateValue(touch.clientX);
    e.preventDefault();
  }, [updateValue]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging.current && e.touches.length > 0) {
      const touch = e.touches[0];
      updateValue(touch.clientX);
      e.preventDefault();
    }
  }, [updateValue]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Add global event listeners
  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();
    const handleGlobalTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const handleGlobalTouchEnd = () => handleTouchEnd();

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-lg font-semibold text-primary">
            {value.toFixed(1)}
          </span>
        </div>
      )}
      <div 
        ref={sliderRef}
        className="relative h-2 bg-light-gray rounded-full cursor-pointer select-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ touchAction: 'none' }}
      >
        {/* Hidden input for accessibility */}
        <input 
          type="range" 
          min="0" 
          max="10" 
          step="0.5" 
          value={value} 
          onChange={e => onChange(parseFloat(e.target.value))} 
          className="absolute w-full h-full opacity-0 cursor-pointer"
          style={{ pointerEvents: 'none' }}
          tabIndex={0}
        />
        
        {/* Progress bar */}
        <div 
          className="absolute h-full bg-red-500 rounded-full transition-all duration-75 ease-out" 
          style={{
            width: `${(value / 10) * 100}%`
          }} 
        />
        
        {/* Draggable circle */}
        <div 
          className="absolute w-4 h-4 bg-white border-2 border-red-500 rounded-full -mt-1 transition-all duration-75 ease-out shadow-sm" 
          style={{
            left: `calc(${(value / 10) * 100}% - 0.5rem)`
          }} 
        />
      </div>
    </div>
  );
};
export default RatingSlider;