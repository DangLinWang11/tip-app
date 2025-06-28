import React from 'react';
import { XIcon, ImageIcon } from 'lucide-react';
interface ImageGridProps {
  images: string[];
  onRemove: (index: number) => void;
  onAdd: () => void;
  maxImages?: number;
}
const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onRemove,
  onAdd,
  maxImages = 4
}) => {
  return <div className="grid grid-cols-2 gap-2">
      {images.map((image, index) => <div key={index} className="relative aspect-square">
          <img src={image} alt={`Upload ${index + 1}`} className="w-full h-full object-cover rounded-xl" />
          <button onClick={() => onRemove(index)} className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
            <XIcon size={14} className="text-white" />
          </button>
        </div>)}
      {images.length < maxImages && <button onClick={onAdd} className="aspect-square border-2 border-dashed border-medium-gray rounded-xl flex flex-col items-center justify-center text-dark-gray">
          <ImageIcon size={24} />
          <span className="text-sm mt-1">Add Photo</span>
        </button>}
    </div>;
};
export default ImageGrid;