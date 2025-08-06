import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShareIcon, Users, Store, UtensilsCrossed } from 'lucide-react';
import { SavedList } from '../services/savedListsService';

interface ListCardProps {
  list: SavedList;
  onDelete: (listId: string, listName: string) => void;
  onShare: (listId: string) => void;
  previewImages?: string[]; // Optional preview images from saved items
}

const ListCard: React.FC<ListCardProps> = ({
  list,
  onDelete,
  onShare,
  previewImages = []
}) => {
  const navigate = useNavigate();
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
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer w-full"
      onClick={() => navigate(`/list/${list.id}`)}
    >
      {/* Single Row Layout */}
      <div className="flex items-center justify-between">
        {/* Left side - Icon, Name, and Counts */}
        <div className="flex items-center flex-1 min-w-0">
          {/* Icon and Name */}
          <div className="text-lg mr-3 flex-shrink-0">
            {list.type === 'template' ? getTemplateIcon() : '📝'}
          </div>
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="font-medium text-gray-900 truncate text-base mb-1">{list.name}</h3>
            {/* Item counts with icons and labels */}
            <div className="flex items-center space-x-4 text-xs text-gray-600">
              {list.savedItems.restaurants.length > 0 && (
                <div className="flex items-center">
                  <Store size={11} className="mr-1" />
                  <span>{list.savedItems.restaurants.length} Restaurant{list.savedItems.restaurants.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {list.savedItems.dishes.length > 0 && (
                <div className="flex items-center">
                  <UtensilsCrossed size={11} className="mr-1" />
                  <span>{list.savedItems.dishes.length} Dish{list.savedItems.dishes.length !== 1 ? 'es' : ''}</span>
                </div>
              )}
              {totalItems === 0 && (
                <span className="text-gray-400">Empty list</span>
              )}
              {/* Public indicator */}
              {list.isPublic && (
                <div className="flex items-center">
                  <Users size={11} className="mr-1" />
                  <span>Public</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Right side - Actions */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          {/* Share Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(list.id);
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Share list"
          >
            <ShareIcon size={22} className="text-dark-gray" />
          </button>
          
          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(list.id, list.name);
            }}
            className="p-2 hover:bg-red-50 rounded-full transition-colors"
            title="Delete list"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListCard;