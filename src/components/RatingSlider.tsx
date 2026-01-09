import React, { useRef, useCallback } from 'react';

interface RatingSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  step?: number;
  min?: number;
  max?: number;
}

const RatingSlider: React.FC<RatingSliderProps> = ({
  value,
  onChange,
  label,
  step = 0.5,
  min = 0,
  max = 10
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isActive, setIsActive] = React.useState(false);

  const clamp = useCallback((val: number) => Math.max(min, Math.min(max, val)), [min, max]);

  const updateValue = useCallback((clientX: number) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + percentage * (max - min);
    const stepped = Math.round(raw / step) * step;
    const rounded = Number(clamp(stepped).toFixed(1));
    onChange(rounded);
  }, [clamp, max, min, onChange, step]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    setIsActive(true);
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
    setIsActive(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    setIsActive(true);
    const touch = e.touches[0];
    if (touch) {
      updateValue(touch.clientX);
    }
    e.preventDefault();
  }, [updateValue]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging.current && e.touches.length > 0) {
      const touch = e.touches[0];
      if (touch) {
        updateValue(touch.clientX);
      }
      e.preventDefault();
    }
  }, [updateValue]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    setIsActive(false);
  }, []);

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

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full">
      {label ? (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-lg font-semibold text-primary">
            {value.toFixed(1)}
          </span>
        </div>
      ) : null}
      <div
        ref={sliderRef}
        className="relative h-2 cursor-pointer select-none py-8 -my-8"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ touchAction: 'none' }}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer"
          style={{ pointerEvents: 'none' }}
          tabIndex={0}
        />
        {/* Background track */}
        <div className="absolute h-2 top-8 w-full bg-slate-200 rounded-full pointer-events-none" />
        {/* Filled track */}
        <div
          className="absolute h-2 top-8 bg-red-500 rounded-full pointer-events-none"
          style={{
            width: `${percentage}%`,
            transition: isDragging.current ? 'none' : 'width 0.1s ease-out'
          }}
        />
        {/* Handle */}
        <div
          className="absolute top-8 flex items-center justify-center pointer-events-none"
          style={{
            left: `${percentage}%`,
            transform: 'translate(-50%, -50%)',
            transition: isDragging.current ? 'none' : 'left 0.1s ease-out'
          }}
        >
          {/* Large invisible touch target */}
          <div className="absolute w-12 h-12 rounded-full" />
          {/* Visible handle with scale effect when active */}
          <div
            className={`w-5 h-5 bg-white border-2 border-red-500 rounded-full shadow-lg transition-transform ${
              isActive ? 'scale-125' : 'scale-100'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default RatingSlider;
