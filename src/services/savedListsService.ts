import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc 
} from 'firebase/firestore';
import { db, getCurrentUser } from '../lib/firebase';

// Saved list interface
export interface SavedList {
  id: string;
  userId: string;
  name: string;
  type: 'template' | 'custom';
  templateType?: 'date_night' | 'business_dinners' | 'casual_favorites' | 'want_to_try';
  savedItems: {
    restaurants: string[]; // Restaurant Firebase IDs
    dishes: string[];      // Post/Review Firebase IDs
  };
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
  isPublic: boolean;
  shareCode?: string;
}

// Template definitions
const DEFAULT_TEMPLATES = [
  {
    name: 'Date Night Spots',
    templateType: 'date_night',
    description: 'Perfect restaurants for romantic dinners'
  },
  {
    name: 'Business Dinners', 
    templateType: 'business_dinners',
    description: 'Professional restaurants for client meetings'
  },
  {
    name: 'Casual Favorites',
    templateType: 'casual_favorites', 
    description: 'Everyday spots for friends and family'
  },
  {
    name: 'Want to Try',
    templateType: 'want_to_try',
    description: 'Restaurants and dishes on your wishlist'
  }
];

// Create default templates for new users
export const createDefaultTemplates = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    console.log('🎯 Creating default templates for user:', currentUser.uid);

    // Check if templates already exist
    const existingLists = await getUserSavedLists();
    if (!existingLists.success) {
      return { success: false, error: 'Failed to check existing lists' };
    }

    const hasTemplates = existingLists.lists?.some(list => list.type === 'template');
    if (hasTemplates) {
      console.log('✅ Templates already exist for user');
      return { success: true };
    }

    // Create all default templates
    const templatePromises = DEFAULT_TEMPLATES.map(async (template) => {
      const templateData = {
        userId: currentUser.uid,
        name: template.name,
        type: 'template' as const,
        templateType: template.templateType,
        savedItems: {
          restaurants: [],
          dishes: []
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublic: false
      };

      return addDoc(collection(db, 'savedLists'), templateData);
    });

    await Promise.all(templatePromises);
    console.log('✅ Default templates created successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to create default templates:', error);
    return { success: false, error: error.message };
  }
};

// Get all saved lists for current user
export const getUserSavedLists = async (): Promise<{ 
  success: boolean; 
  lists?: SavedList[]; 
  error?: string 
}> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    const listsRef = collection(db, 'savedLists');
    const q = query(
      listsRef,
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const lists: SavedList[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      lists.push({
        id: doc.id,
        ...data
      } as SavedList);
    });

    // Sort templates first, then custom lists
    lists.sort((a, b) => {
      if (a.type === 'template' && b.type === 'custom') return -1;
      if (a.type === 'custom' && b.type === 'template') return 1;
      return 0;
    });

    console.log(`✅ Fetched ${lists.length} saved lists`);
    return { success: true, lists };
  } catch (error: any) {
    console.error('❌ Failed to fetch saved lists:', error);
    return { success: false, error: error.message };
  }
};

// Create a new custom list
export const createCustomList = async (
  name: string
): Promise<{ success: boolean; listId?: string; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    if (!name || !name.trim()) {
      return { success: false, error: 'List name is required' };
    }

    console.log('📝 Creating custom list:', name);

    const listData = {
      userId: currentUser.uid,
      name: name.trim(),
      type: 'custom' as const,
      savedItems: {
        restaurants: [],
        dishes: []
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isPublic: false,
      shareCode: generateShareCode()
    };

    const docRef = await addDoc(collection(db, 'savedLists'), listData);
    console.log('✅ Custom list created with ID:', docRef.id);
    
    return { success: true, listId: docRef.id };
  } catch (error: any) {
    console.error('❌ Failed to create custom list:', error);
    return { success: false, error: error.message };
  }
};

// Add restaurant to a saved list
export const addRestaurantToList = async (
  listId: string,
  restaurantId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    console.log('🏪 Adding restaurant to list:', { listId, restaurantId });

    // Get current list data
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = listDoc.data() as SavedList;
    
    // Check if user owns the list
    if (listData.userId !== currentUser.uid) {
      return { success: false, error: 'Permission denied' };
    }

    // Check if restaurant already exists in list
    if (listData.savedItems.restaurants.includes(restaurantId)) {
      return { success: false, error: 'Restaurant already in list' };
    }

    // Add restaurant to the list
    const updatedRestaurants = [...listData.savedItems.restaurants, restaurantId];
    
    await updateDoc(doc(db, 'savedLists', listId), {
      'savedItems.restaurants': updatedRestaurants,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Restaurant added to list successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to add restaurant to list:', error);
    return { success: false, error: error.message };
  }
};

// Add dish to a saved list
export const addDishToList = async (
  listId: string,
  dishId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    console.log('🍽️ Adding dish to list:', { listId, dishId });

    // Get current list data
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = listDoc.data() as SavedList;
    
    // Check if user owns the list
    if (listData.userId !== currentUser.uid) {
      return { success: false, error: 'Permission denied' };
    }

    // Check if dish already exists in list
    if (listData.savedItems.dishes.includes(dishId)) {
      return { success: false, error: 'Dish already in list' };
    }

    // Add dish to the list
    const updatedDishes = [...listData.savedItems.dishes, dishId];
    
    await updateDoc(doc(db, 'savedLists', listId), {
      'savedItems.dishes': updatedDishes,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Dish added to list successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to add dish to list:', error);
    return { success: false, error: error.message };
  }
};

// Remove restaurant from a saved list
export const removeRestaurantFromList = async (
  listId: string,
  restaurantId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    // Get current list data
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = listDoc.data() as SavedList;
    
    // Check if user owns the list
    if (listData.userId !== currentUser.uid) {
      return { success: false, error: 'Permission denied' };
    }

    // Remove restaurant from the list
    const updatedRestaurants = listData.savedItems.restaurants.filter(id => id !== restaurantId);
    
    await updateDoc(doc(db, 'savedLists', listId), {
      'savedItems.restaurants': updatedRestaurants,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Restaurant removed from list successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to remove restaurant from list:', error);
    return { success: false, error: error.message };
  }
};

// Remove dish from a saved list
export const removeDishFromList = async (
  listId: string,
  dishId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    // Get current list data
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = listDoc.data() as SavedList;
    
    // Check if user owns the list
    if (listData.userId !== currentUser.uid) {
      return { success: false, error: 'Permission denied' };
    }

    // Remove dish from the list
    const updatedDishes = listData.savedItems.dishes.filter(id => id !== dishId);
    
    await updateDoc(doc(db, 'savedLists', listId), {
      'savedItems.dishes': updatedDishes,
      updatedAt: serverTimestamp()
    });

    console.log('✅ Dish removed from list successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to remove dish from list:', error);
    return { success: false, error: error.message };
  }
};

// Delete a saved list
export const deleteSavedList = async (
  listId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    console.log('🗑️ Deleting saved list:', listId);

    // Get list to verify ownership
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = listDoc.data() as SavedList;
    
    // Check if user owns the list
    if (listData.userId !== currentUser.uid) {
      return { success: false, error: 'Permission denied' };
    }

    await deleteDoc(doc(db, 'savedLists', listId));
    console.log('✅ List deleted successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to delete list:', error);
    return { success: false, error: error.message };
  }
};

// Get a specific saved list by ID
export const getSavedListById = async (
  listId: string
): Promise<{ success: boolean; list?: SavedList; error?: string }> => {
  try {
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = {
      id: listDoc.id,
      ...listDoc.data()
    } as SavedList;

    return { success: true, list: listData };
  } catch (error: any) {
    console.error('❌ Failed to fetch list:', error);
    return { success: false, error: error.message };
  }
};

// Generate a shareable code for lists
const generateShareCode = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Get list by share code
export const getListByShareCode = async (
  shareCode: string
): Promise<{ success: boolean; list?: SavedList; error?: string }> => {
  try {
    const listsRef = collection(db, 'savedLists');
    const q = query(listsRef, where('shareCode', '==', shareCode), where('isPublic', '==', true));
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, error: 'Shared list not found or not public' };
    }

    const listDoc = querySnapshot.docs[0];
    const listData = {
      id: listDoc.id,
      ...listDoc.data()
    } as SavedList;

    return { success: true, list: listData };
  } catch (error: any) {
    console.error('❌ Failed to fetch shared list:', error);
    return { success: false, error: error.message };
  }
};

// Make list public and shareable
export const makeListPublic = async (
  listId: string
): Promise<{ success: boolean; shareCode?: string; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    // Get list to verify ownership
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = listDoc.data() as SavedList;
    
    // Check if user owns the list
    if (listData.userId !== currentUser.uid) {
      return { success: false, error: 'Permission denied' };
    }

    const shareCode = listData.shareCode || generateShareCode();
    
    await updateDoc(doc(db, 'savedLists', listId), {
      isPublic: true,
      shareCode: shareCode,
      updatedAt: serverTimestamp()
    });

    console.log('✅ List made public with share code:', shareCode);
    return { success: true, shareCode };
  } catch (error: any) {
    console.error('❌ Failed to make list public:', error);
    return { success: false, error: error.message };
  }
};

// Make list private
export const makeListPrivate = async (
  listId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'No authenticated user' };
    }

    // Get list to verify ownership
    const listDoc = await getDoc(doc(db, 'savedLists', listId));
    if (!listDoc.exists()) {
      return { success: false, error: 'List not found' };
    }

    const listData = listDoc.data() as SavedList;
    
    // Check if user owns the list
    if (listData.userId !== currentUser.uid) {
      return { success: false, error: 'Permission denied' };
    }

    await updateDoc(doc(db, 'savedLists', listId), {
      isPublic: false,
      updatedAt: serverTimestamp()
    });

    console.log('✅ List made private');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Failed to make list private:', error);
    return { success: false, error: error.message };
  }
};
