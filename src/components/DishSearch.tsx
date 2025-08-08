import React, { useState, useEffect } from 'react';
import { PlusIcon, UtensilsIcon } from 'lucide-react';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number | null;
  description: string;
  restaurantId: string;
  createdAt: any;
  updatedAt: any;
}

interface DishSearchProps {
  restaurantId: string | null;
  onSelect: (dish: MenuItem) => void;
  onAddNew: (dishName: string, newMenuItem: MenuItem) => void;
  disabled?: boolean;
}

const DishSearch: React.FC<DishSearchProps> = ({
  restaurantId,
  onSelect,
  onAddNew,
  disabled = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  console.log('DishSearch component mounted/re-rendered');
  console.log('restaurantId prop:', restaurantId);

  // Fetch menu items from Firebase when restaurant changes
  useEffect(() => {
    console.log('useEffect triggered - restaurantId:', restaurantId);
    
    if (!restaurantId) {
      console.log('No restaurantId provided, clearing menu items');
      setMenuItems([]);
      return;
    }

    const fetchMenuItems = async () => {
      try {
        console.log('Starting Firebase query for restaurantId:', restaurantId);
        setLoading(true);
        setError(null);
        
        const menuItemsCollection = collection(db, 'menuItems');
        const q = query(menuItemsCollection, where('restaurantId', '==', restaurantId));
        console.log('Executing Firebase query...');
        const menuItemSnapshot = await getDocs(q);
        
        const menuItemList: MenuItem[] = menuItemSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        } as MenuItem));
        
        console.log('Firebase query results:', {
          docsCount: menuItemSnapshot.docs.length,
          menuItems: menuItemList
        });
        
        setMenuItems(menuItemList);
        console.log(`Loaded ${menuItemList.length} menu items for restaurant ${restaurantId}`);
      } catch (err: any) {
        console.error('Error fetching menu items:', err);
        console.error('Error details:', {
          message: err.message,
          code: err.code,
          stack: err.stack
        });
        setError('Failed to load menu items');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMenuItems();
  }, [restaurantId]);

  const filteredMenuItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNewDish = async () => {
    if (!restaurantId || !searchQuery.trim() || addingNew) return;

    try {
      setAddingNew(true);
      const newMenuItem = {
        name: searchQuery.trim(),
        category: 'Dish Added',
        price: null,
        description: '',
        restaurantId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'menuItems'), newMenuItem);
      
      const createdMenuItem: MenuItem = {
        id: docRef.id,
        ...newMenuItem
      };

      setMenuItems(prev => [...prev, createdMenuItem]);
      onAddNew(searchQuery.trim(), createdMenuItem);
      setSearchQuery(createdMenuItem.name);
      setIsOpen(false);
    } catch (err: any) {
      console.error('Error adding new dish:', err);
      setError('Failed to add new dish');
    } finally {
      setAddingNew(false);
    }
  };

  return (
    <div className="relative">
      <div className={`flex items-center border border-medium-gray rounded-xl p-3 ${disabled ? 'bg-gray-50' : ''}`}>
        <UtensilsIcon size={20} className="text-dark-gray mr-2" />
        <input
          type="text"
          placeholder={restaurantId ? "Search for a dish..." : "Select a restaurant first"}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          disabled={disabled || !restaurantId}
          className="flex-1 focus:outline-none disabled:bg-transparent disabled:text-gray-400"
        />
      </div>
      
      {isOpen && searchQuery && restaurantId && (
        <div className="absolute z-10 left-0 right-0 mt-2 bg-white rounded-xl shadow-lg max-h-64 overflow-y-auto border border-gray-200">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading dishes...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              {filteredMenuItems.length > 0 && (
                <>
                  {filteredMenuItems.map(item => (
                    <button 
                      key={item.id} 
                      className="w-full p-3 flex items-start hover:bg-light-gray transition-colors text-left" 
                      onClick={() => {
                        onSelect(item);
                        setSearchQuery(item.name);
                        setIsOpen(false);
                      }}
                    >
                      <UtensilsIcon size={16} className="text-dark-gray mr-3 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.name}</span>
                          {item.price && (
                            <span className="text-sm text-dark-gray">${item.price}</span>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-dark-gray mt-1">
                          <span className="mr-2">{item.category}</span>
                          {item.description && (
                            <span className="text-xs text-gray-500 truncate">{item.description}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  <hr className="border-gray-200" />
                </>
              )}
              
              {/* Add new dish option */}
              <button 
                className="w-full p-3 flex items-center hover:bg-light-gray transition-colors text-left text-accent"
                onClick={handleAddNewDish}
                disabled={addingNew}
              >
                {addingNew ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent mr-3"></div>
                    <span>Adding dish...</span>
                  </>
                ) : (
                  <>
                    <PlusIcon size={16} className="mr-3" />
                    <span>Add "{searchQuery}" as new dish</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DishSearch;