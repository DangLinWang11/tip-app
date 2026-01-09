import { useState } from 'react';
import { DishCardData } from '../components/discover/DishCard';
import { RestaurantCardData } from '../components/discover/RestaurantCard';
import { fetchRestaurantDishes, fetchNearbyRestaurants } from '../services/mapService';

interface MapBottomSheetState {
  isOpen: boolean;
  type: 'dish' | 'restaurant';
  items: (DishCardData | RestaurantCardData)[];
  sourceId: string;
  isLoading: boolean;
}

export const useMapBottomSheet = () => {
  const [state, setState] = useState<MapBottomSheetState>({
    isOpen: false,
    type: 'dish',
    items: [],
    sourceId: '',
    isLoading: false
  });

  const openDishSheet = async (restaurantId: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const dishes = await fetchRestaurantDishes(restaurantId);

      if (dishes.length === 0) {
        console.warn('No dishes found for restaurant:', restaurantId);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      setState({
        isOpen: true,
        type: 'dish',
        items: dishes,
        sourceId: restaurantId,
        isLoading: false
      });
    } catch (error) {
      console.error('Error opening dish sheet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const openRestaurantSheet = async (lat: number, lng: number, radius: number = 1000) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const restaurants = await fetchNearbyRestaurants(lat, lng, radius);

      if (restaurants.length === 0) {
        console.warn('No nearby restaurants found');
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      setState({
        isOpen: true,
        type: 'restaurant',
        items: restaurants,
        sourceId: `${lat},${lng}`,
        isLoading: false
      });
    } catch (error) {
      console.error('Error opening restaurant sheet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const closeSheet = () => {
    setState(prev => ({ ...prev, isOpen: false }));
    // Reset after animation completes
    setTimeout(() => {
      setState({
        isOpen: false,
        type: 'dish',
        items: [],
        sourceId: '',
        isLoading: false
      });
    }, 300);
  };

  return {
    ...state,
    openDishSheet,
    openRestaurantSheet,
    closeSheet
  };
};
