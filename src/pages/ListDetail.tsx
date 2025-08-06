import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, EditIcon, Share, Store, UtensilsCrossed, Trash2, Star, MapPinIcon } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  getSavedListById, 
  removeRestaurantFromList, 
  removeDishFromList,
  SavedList 
} from '../services/savedListsService';

// Interfaces for restaurant and dish data
interface Restaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  phone?: string;
  coordinates?: { latitude: number; longitude: number };
}

interface Dish {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  category?: string;
  rating?: number;
  description?: string;
}

interface SavedRestaurant extends Restaurant {
  // Additional fields for saved restaurants display
  qualityScore?: number;
}

interface SavedDish extends Dish {
  // Additional fields for saved dishes display
  averageRating?: number;
}

const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // State management
  const [list, setList] = useState<SavedList | null>(null);
  const [restaurants, setRestaurants] = useState<SavedRestaurant[]>([]);
  const [dishes, setDishes] = useState<SavedDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Load list data on component mount
  useEffect(() => {
    console.log('🚀 [ListDetail] Component mounted, ID from params:', id);
    if (id) {
      loadListData();
    } else {
      console.warn('⚠️ [ListDetail] No ID found in URL params');
    }
  }, [id]);

  const loadListData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch list data
      console.log('🔍 [ListDetail] Fetching list with ID:', id);
      const listResult = await getSavedListById(id);
      
      console.log('📄 [ListDetail] List fetch result:', {
        success: listResult.success,
        error: listResult.error,
        listExists: !!listResult.list
      });
      
      if (!listResult.success || !listResult.list) {
        console.error('❌ [ListDetail] Failed to fetch list:', listResult.error);
        setError(listResult.error || 'Failed to load list');
        return;
      }

      console.log('📋 [ListDetail] Fetched list data:', {
        id: listResult.list.id,
        name: listResult.list.name,
        type: listResult.list.type,
        savedItems: listResult.list.savedItems,
        restaurantCount: listResult.list.savedItems.restaurants.length,
        dishCount: listResult.list.savedItems.dishes.length
      });

      console.log('🏪 [ListDetail] Restaurant IDs to fetch:', listResult.list.savedItems.restaurants);
      console.log('🍽️ [ListDetail] Dish IDs to fetch:', listResult.list.savedItems.dishes);

      setList(listResult.list);

      // Fetch restaurant data
      const restaurantPromises = listResult.list.savedItems.restaurants.map(async (restaurantId) => {
        try {
          console.log('🔍 [ListDetail] Fetching restaurant with ID:', restaurantId);
          const restaurantDoc = await getDoc(doc(db, 'restaurants', restaurantId));
          
          console.log(`📄 [ListDetail] Restaurant ${restaurantId} query result:`, {
            exists: restaurantDoc.exists(),
            id: restaurantDoc.id
          });
          
          if (restaurantDoc.exists()) {
            const restaurantData = restaurantDoc.data();
            console.log(`✅ [ListDetail] Restaurant ${restaurantId} data:`, restaurantData);
            
            return {
              id: restaurantDoc.id,
              ...restaurantData,
              qualityScore: Math.round((Math.random() * 2 + 3) * 10) / 10 // Mock quality score
            } as SavedRestaurant;
          } else {
            console.warn(`⚠️ [ListDetail] Restaurant ${restaurantId} not found in database`);
          }
          return null;
        } catch (err) {
          console.error(`❌ [ListDetail] Error fetching restaurant ${restaurantId}:`, err);
          return null;
        }
      });

      // Fetch dish data (from reviews/posts)
      const dishPromises = listResult.list.savedItems.dishes.map(async (dishId) => {
        try {
          console.log('🔍 [ListDetail] Fetching dish with ID:', dishId);
          const dishDoc = await getDoc(doc(db, 'reviews', dishId));
          
          console.log(`📄 [ListDetail] Dish ${dishId} query result:`, {
            exists: dishDoc.exists(),
            id: dishDoc.id
          });
          
          if (dishDoc.exists()) {
            const dishData = dishDoc.data();
            console.log(`✅ [ListDetail] Dish ${dishId} data:`, dishData);
            
            return {
              id: dishDoc.id,
              name: dishData.dish || 'Unknown Dish',
              restaurantId: dishData.restaurantId || '',
              restaurantName: dishData.restaurant || 'Unknown Restaurant',
              category: dishData.category || 'Main Course',
              rating: dishData.rating || 0,
              averageRating: dishData.rating || 0
            } as SavedDish;
          } else {
            console.warn(`⚠️ [ListDetail] Dish ${dishId} not found in reviews collection`);
          }
          return null;
        } catch (err) {
          console.error(`❌ [ListDetail] Error fetching dish ${dishId}:`, err);
          return null;
        }
      });

      // Wait for all data to load
      console.log('⏳ [ListDetail] Waiting for all Firebase queries to complete...');
      const [restaurantResults, dishResults] = await Promise.all([
        Promise.all(restaurantPromises),
        Promise.all(dishPromises)
      ]);

      console.log('📊 [ListDetail] Raw query results:', {
        restaurantResults: restaurantResults,
        dishResults: dishResults,
        restaurantCount: restaurantResults.length,
        dishCount: dishResults.length,
        restaurantSuccessCount: restaurantResults.filter(r => r !== null).length,
        dishSuccessCount: dishResults.filter(d => d !== null).length
      });

      // Filter out null results
      const filteredRestaurants = restaurantResults.filter((r): r is SavedRestaurant => r !== null);
      const filteredDishes = dishResults.filter((d): d is SavedDish => d !== null);

      console.log('📈 [ListDetail] Filtered results:', {
        filteredRestaurants: filteredRestaurants,
        filteredDishes: filteredDishes,
        finalRestaurantCount: filteredRestaurants.length,
        finalDishCount: filteredDishes.length
      });

      setRestaurants(filteredRestaurants);
      setDishes(filteredDishes);

    } catch (err) {
      console.error('❌ [ListDetail] Critical error loading list data:', err);
      console.error('❌ [ListDetail] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError('Failed to load list data');
    } finally {
      console.log('✅ [ListDetail] Loading complete, setting loading to false');
      setLoading(false);
    }
  };

  const handleRemoveRestaurant = async (restaurantId: string) => {
    if (!id || !list) return;

    setRemoving(restaurantId);
    try {
      const result = await removeRestaurantFromList(id, restaurantId);
      if (result.success) {
        // Refresh data
        await loadListData();
      } else {
        setError(result.error || 'Failed to remove restaurant');
      }
    } catch (err) {
      console.error('Error removing restaurant:', err);
      setError('Failed to remove restaurant');
    } finally {
      setRemoving(null);
    }
  };

  const handleRemoveDish = async (dishId: string) => {
    if (!id || !list) return;

    setRemoving(dishId);
    try {
      const result = await removeDishFromList(id, dishId);
      if (result.success) {
        // Refresh data
        await loadListData();
      } else {
        setError(result.error || 'Failed to remove dish');
      }
    } catch (err) {
      console.error('Error removing dish:', err);
      setError('Failed to remove dish');
    } finally {
      setRemoving(null);
    }
  };

  const handleShareList = async () => {
    if (!list) return;
    
    try {
      const shareUrl = `${window.location.origin}/list/${id}`;
      const shareData = {
        title: `Check out my ${list.name} list!`,
        text: `Check out my ${list.name} food list on Tip!`,
        url: shareUrl
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('List link copied to clipboard!');
      }
    } catch (err) {
      console.error('Failed to share list:', err);
      try {
        const shareUrl = `${window.location.origin}/list/${id}`;
        await navigator.clipboard.writeText(shareUrl);
        alert('List link copied to clipboard!');
      } catch {
        alert('Unable to share list. Please try again.');
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-6 shadow-sm">
          <div className="flex items-center">
            <button 
              onClick={() => navigate(-1)}
              className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeftIcon size={20} className="text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-black">Loading...</h1>
          </div>
        </div>

        {/* Loading State */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading list...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !list) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white px-4 py-6 shadow-sm">
          <div className="flex items-center">
            <button 
              onClick={() => navigate(-1)}
              className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeftIcon size={20} className="text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-black">Error</h1>
          </div>
        </div>

        {/* Error State */}
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load List</h3>
          <p className="text-gray-600 mb-4">{error || 'This list may not exist or you may not have access to it.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white px-4 py-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1">
            <button 
              onClick={() => navigate(-1)}
              className="mr-2 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeftIcon size={20} className="text-gray-600" />
            </button>
            <h1 className="text-lg font-semibold text-black truncate">{list.name}</h1>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={() => navigate(`/list/${id}/edit`)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Edit list"
            >
              <EditIcon size={18} className="text-gray-600" />
            </button>
            
            <button
              onClick={handleShareList}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Share list"
            >
              <Share size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Restaurants Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Store size={20} className="text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-black">Restaurants</h2>
            </div>
            <span className="text-sm text-gray-500">{restaurants.length} saved</span>
          </div>

          {restaurants.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Store size={24} className="text-gray-400" />
              </div>
              <p className="text-gray-600 text-sm">No restaurants saved</p>
              <p className="text-gray-500 text-xs mt-1">Add restaurants from the discover page</p>
            </div>
          ) : (
            <div className="space-y-3">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{restaurant.name}</h3>
                    <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                      <span>{restaurant.cuisine}</span>
                      {restaurant.qualityScore && (
                        <div className="flex items-center">
                          <Star size={10} className="text-yellow-500 mr-1" />
                          <span>{restaurant.qualityScore}</span>
                        </div>
                      )}
                      {restaurant.address && (
                        <div className="flex items-center">
                          <MapPinIcon size={10} className="text-gray-400 mr-1" />
                          <span className="truncate">{restaurant.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveRestaurant(restaurant.id);
                    }}
                    disabled={removing === restaurant.id}
                    className="p-2 hover:bg-red-50 rounded-full transition-colors ml-2"
                    title="Remove from list"
                  >
                    {removing === restaurant.id ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} className="text-red-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dishes Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <UtensilsCrossed size={20} className="text-orange-600 mr-2" />
              <h2 className="text-lg font-semibold text-black">Dishes</h2>
            </div>
            <span className="text-sm text-gray-500">{dishes.length} saved</span>
          </div>

          {dishes.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UtensilsCrossed size={24} className="text-gray-400" />
              </div>
              <p className="text-gray-600 text-sm">No dishes saved</p>
              <p className="text-gray-500 text-xs mt-1">Add dishes from restaurant reviews</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dishes.map((dish) => (
                <div
                  key={dish.id}
                  onClick={() => navigate(`/dish/${dish.id}`)}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{dish.name}</h3>
                    <div className="flex items-center space-x-3 text-xs text-gray-600 mt-1">
                      <span className="truncate">from {dish.restaurantName}</span>
                      {dish.averageRating && dish.averageRating > 0 && (
                        <div className="flex items-center">
                          <Star size={10} className="text-yellow-500 mr-1" />
                          <span>{dish.averageRating.toFixed(1)}</span>
                        </div>
                      )}
                      {dish.category && (
                        <span>{dish.category}</span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveDish(dish.id);
                    }}
                    disabled={removing === dish.id}
                    className="p-2 hover:bg-red-50 rounded-full transition-colors ml-2"
                    title="Remove from list"
                  >
                    {removing === dish.id ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} className="text-red-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 text-xs underline mt-2 hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListDetail;