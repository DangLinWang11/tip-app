import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, Store, UtensilsCrossed } from 'lucide-react';
import { 
  getUserSavedLists, 
  createCustomList, 
  addRestaurantToList, 
  addDishToList,
  deleteSavedList,
  createDefaultTemplates,
  SavedList 
} from '../services/savedListsService';

interface DishOption {
  dishId?: string;
  dishName: string;
  postId?: string; // For saving specific posts/reviews
}

interface SaveToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId?: string;
  restaurantName?: string;
  dishId?: string;
  dishName?: string;
  postId?: string; // For saving specific posts/reviews
  dishes?: DishOption[]; // NEW: Array of dishes for multi-dish saves
  onSaved?: (r: { entity: 'dish' | 'restaurant'; listName?: string }) => void;
}

type SaveType = 'restaurant' | 'dish' | null;

const SaveToListModal: React.FC<SaveToListModalProps> = ({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
  dishId,
  dishName,
  postId,
  dishes,
  onSaved
}) => {
  const [step, setStep] = useState<'select_type' | 'select_list'>('select_type');
  const [saveType, setSaveType] = useState<SaveType>(null);
  const [selectedDish, setSelectedDish] = useState<DishOption | null>(null);
  const [lists, setLists] = useState<SavedList[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 40) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // Load user's saved lists when modal opens
  useEffect(() => {
    if (isOpen && step === 'select_list') {
      loadUserLists();
    }
  }, [isOpen, step]);

  // If only one target is available (e.g., restaurant only), skip selection step
  useEffect(() => {
    if (!isOpen) return;
    const hasRestaurant = !!(restaurantId && restaurantName);
    const hasDish = !!((dishId || postId) && dishName);
    if (step === 'select_type' && hasRestaurant && !hasDish) {
      setSaveType('restaurant');
      setStep('select_list');
    }
    if (step === 'select_type' && !hasRestaurant && hasDish) {
      setSaveType('dish');
      setStep('select_list');
    }
  }, [isOpen, step, restaurantId, restaurantName, dishId, dishName, postId]);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setStep('select_type');
      setSaveType(null);
      setSelectedDish(null);
      setShowCreateForm(false);
      setNewListName('');
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const loadUserLists = async () => {
    setLoading(true);
    setError(null);

    try {
      // First ensure user has default templates
      await createDefaultTemplates();
      
      // Then load all lists
      const result = await getUserSavedLists();
      if (result.success && result.lists) {
        setLists(result.lists);
      } else {
        setError(result.error || 'Failed to load lists');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load lists');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSelection = (type: SaveType, dish?: DishOption) => {
    setSaveType(type);
    if (type === 'dish' && dish) {
      setSelectedDish(dish);
    }
    setStep('select_list');
  };

  const handleSaveToList = async (listId: string) => {
    if (!saveType) return;

    setLoading(true);
    setError(null);

    try {
      let result;
      let savedItemName = '';

      if (saveType === 'restaurant' && restaurantId) {
        result = await addRestaurantToList(listId, restaurantId);
        savedItemName = restaurantName || 'Restaurant';
      } else if (saveType === 'dish') {
        // Use selectedDish if available (from multi-dish selection), otherwise fall back to single dish props
        const dishToSave = selectedDish || { dishId, dishName, postId };
        const idToSave = dishToSave.dishId || dishToSave.postId;

        console.log('💾 [SaveToListModal] Saving dish to list:', {
          listId,
          selectedDish,
          dishToSave,
          idToSave
        });

        if (idToSave) {
          result = await addDishToList(listId, idToSave);
          savedItemName = dishToSave.dishName || 'Dish';
          console.log('💾 [SaveToListModal] Save result:', result);
        } else {
          console.error('❌ [SaveToListModal] No dish or post ID available');
          setError('No dish or post ID available');
          return;
        }
      } else {
        setError('Missing required data');
        return;
      }

      if (result?.success) {
        setSuccess(`${savedItemName} saved successfully!`);
        try {
          const savedEntity: 'dish' | 'restaurant' = saveType;
          const listObj = lists.find(l => l.id === listId);
          const listName = listObj?.name;
          // Notify caller for toast/analytics
          if (typeof onSaved === 'function') {
            onSaved({ entity: savedEntity, listName });
          }
        } catch (e) {
          // no-op: optional callback
        }

        // Close modal after short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(result?.error || 'Failed to save item');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      setError('List name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const result = await createCustomList(newListName.trim());
      if (result.success && result.listId) {
        // Add item to the newly created list
        await handleSaveToList(result.listId);
        
        // Refresh lists
        await loadUserLists();
        setShowCreateForm(false);
        setNewListName('');
      } else {
        setError(result.error || 'Failed to create list');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (!confirm(`Delete "${listName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteSavedList(listId);
      if (result.success) {
        await loadUserLists(); // Refresh the list
      } else {
        setError(result.error || 'Failed to delete list');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete list');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            {step === 'select_type' ? 'Save to List' : `Save ${saveType === 'restaurant' ? 'Restaurant' : 'Dish'}`}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          
          {/* Step 1: Select what to save */}
          {step === 'select_type' && (
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600 mb-4">What would you like to save?</p>

              {/* Save Restaurant Option */}
              {restaurantId && restaurantName && (
                <button
                  onClick={() => handleTypeSelection('restaurant')}
                  className="w-full p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-red-50 transition-colors text-left flex items-center"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <Store size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Save Restaurant</div>
                    <div className="text-sm text-gray-600 truncate">{truncateText(restaurantName)}</div>
                  </div>
                </button>
              )}

              {/* Save Dishes Options - Show all dishes if multiple, otherwise single */}
              {dishes && dishes.length > 0 ? (
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="font-medium mb-3">Save Dish</div>
                  <div className="max-h-[200px] overflow-y-auto space-y-2">
                    {dishes.map((dish, index) => (
                      <button
                        key={index}
                        onClick={() => handleTypeSelection('dish', dish)}
                        className="w-full p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-red-50 transition-colors text-left flex items-center"
                      >
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                          <UtensilsCrossed size={18} className="text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate">{truncateText(dish.dishName, 35)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Single dish fallback */
                (dishId || postId) && dishName && (
                  <button
                    onClick={() => handleTypeSelection('dish', { dishId, dishName, postId })}
                    className="w-full p-4 border border-gray-200 rounded-xl hover:border-primary hover:bg-red-50 transition-colors text-left flex items-center"
                  >
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <UtensilsCrossed size={20} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">Save Dish</div>
                      <div className="text-sm text-gray-600 truncate">{truncateText(dishName)}</div>
                    </div>
                  </button>
                )
              )}
            </div>
          )}

          {/* Step 2: Select list */}
          {step === 'select_list' && (
            <div className="p-4">
              
              {/* Back Button */}
              <button
                onClick={() => setStep('select_type')}
                className="text-primary text-sm mb-4 hover:underline"
              >
                ← Back to selection
              </button>

              {/* Success Message */}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                  <Check size={16} className="text-green-600 mr-2" />
                  <span className="text-green-800 text-sm">{success}</span>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-800 text-sm">{error}</span>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-600 text-sm">Loading lists...</p>
                </div>
              )}

              {/* Lists */}
              {!loading && (
                <div className="space-y-2">
                  {lists.map((list) => (
                    <div key={list.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                      <button
                        onClick={() => handleSaveToList(list.id)}
                        disabled={loading}
                        className="flex-1 text-left"
                      >
                        <div className="font-medium">{list.name}</div>
                        <div className="text-xs text-gray-500">
                          {list.savedItems.restaurants.length + list.savedItems.dishes.length} items
                          {list.type === 'template' && ' • Template'}
                        </div>
                      </button>
                      
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteList(list.id, list.name)}
                        className="p-1 ml-2 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete list"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                  ))}

                  {/* Create New List */}
                  {!showCreateForm ? (
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary hover:bg-red-50 transition-colors flex items-center justify-center text-gray-600 hover:text-primary"
                    >
                      <Plus size={20} className="mr-2" />
                      Create New List
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-xl p-4">
                      <input
                        type="text"
                        placeholder="Enter list name..."
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateList();
                          } else if (e.key === 'Escape') {
                            setShowCreateForm(false);
                            setNewListName('');
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary mb-3"
                        autoFocus
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCreateList}
                          disabled={creating || !newListName.trim()}
                          className="flex-1 bg-primary text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
                        >
                          {creating ? 'Creating...' : 'Create & Save'}
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewListName('');
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaveToListModal;
