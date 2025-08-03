import React from 'react';
import { Trash2, Share2, Users, Store, UtensilsCrossed } from 'lucide-react';
import { SavedList } from '../services/savedListsService';

interface ListCardProps {
  list: SavedList;
  onDelete: (listId: string, listName: string) => void;
  onShare: (listId: string) => void;
  onClick: (listId: string) => void;
  previewImages?: string[]; // Optional preview images from saved items
}

const ListCard: React.FC<ListCardProps> = ({
  list,
  onDelete,
  onShare,
  onClick,
  previewImages = []
}) => {
  const totalItems = list.savedItems.restaurants.length + list.savedItems.dishes.length;
  
  // Get appropriate icon based on template type
  const getTemplateIcon = () => {
    switch (list.templateType) {
      case 'date_night':
        return '💕';
      case 'business_dinners':
        return '💼';
      case 'casual_favorites':
        return '🍽️';
      case 'want_to_try':
        return '⭐';
      default:
        return '📝';
    }
  };

  // Template descriptions
  const getTemplateDescription = () => {
    switch (list.templateType) {
      case 'date_night':
        return 'Perfect for romantic dinners';
      case 'business_dinners':
        return 'Professional meeting spots';
      case 'casual_favorites':
        return 'Everyday go-to places';
      case 'want_to_try':
        return 'Your wishlist items';
      default:
        return 'Custom collection';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      
      {/* Preview Images */}
      <div 
        className="h-32 bg-gray-100 relative cursor-pointer"
        onClick={() => onClick(list.id)}
      >
        {previewImages.length > 0 ? (
          <div className="grid grid-cols-2 h-full">
            {previewImages.slice(0, 4).map((image, index) => (
              <img
                key={index}
                src={image}
                alt=""
                className="w-full h-full object-cover"
              />
            ))}
            {previewImages.length > 4 && (
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-xs">
                +{previewImages.length - 4}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">
                {list.type === 'template' ? getTemplateIcon() : '📝'}
              </div>
              <p className="text-gray-500 text-sm">
                {totalItems === 0 ? 'Empty list' : `${totalItems} items`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div 
            className="flex-1 cursor-pointer"
            onClick={() => onClick(list.id)}
          >
            <h3 className="font-semibold text-gray-900 truncate">{list.name}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {list.type === 'template' ? getTemplateDescription() : 'Custom list'}
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex items-center space-x-1 ml-2">
            {/* Share Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(list.id);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              title="Share list"
            >
              <Share2 size={14} className="text-gray-500" />
            </button>
            
            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(list.id, list.name);
              }}
              className="p-1.5 hover:bg-red-50 rounded-full transition-colors"
              title="Delete list"
            >
              <Trash2 size={14} className="text-red-500" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center space-x-3">
            {list.savedItems.restaurants.length > 0 && (
              <div className="flex items-center">
                <Store size={12} className="mr-1" />
                <span>{list.savedItems.restaurants.length}</span>
              </div>
            )}
            {list.savedItems.dishes.length > 0 && (
              <div className="flex items-center">
                <UtensilsCrossed size={12} className="mr-1" />
                <span>{list.savedItems.dishes.length}</span>
              </div>
            )}
          </div>
          
          {/* Template Badge */}
          {list.type === 'template' && (
            <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
              Template
            </span>
          )}
          
          {/* Public Badge */}
          {list.isPublic && (
            <div className="flex items-center">
              <Users size={12} className="mr-1" />
              <span>Public</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListCard;