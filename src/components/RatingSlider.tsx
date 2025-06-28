import React from 'react';
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
  return <div className="w-full">
      {label && <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-lg font-semibold text-primary">
            {value.toFixed(1)}
          </span>
        </div>}
      <div className="relative h-2 bg-light-gray rounded-full">
        <input type="range" min="0" max="10" step="0.1" value={value} onChange={e => onChange(parseFloat(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer" />
        <div className="absolute h-full bg-primary rounded-full" style={{
        width: `${value / 10 * 100}%`
      }} />
        <div className="absolute w-4 h-4 bg-white border-2 border-primary rounded-full -mt-1" style={{
        left: `calc(${value / 10 * 100}% - 0.5rem)`
      }} />
      </div>
    </div>;
};
export default RatingSlider;