import React, { useState, useEffect } from 'react';
import { SearchIcon, MapPinIcon, StarIcon, PlusIcon } from 'lucide-react';
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore';
import { useLoadScript } from '@react-google-maps/api';
import { db } from '../lib/firebase';
import LocationPickerModal from './LocationPickerModal';
import { CUISINES, getCuisineLabel } from '../utils/taxonomy';
import { saveGooglePlaceToFirestore } from '../services/googlePlacesService';

const formatCuisineLabel = (value: string) => getCuisineLabel(value);

interface FirebaseRestaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  cuisines?: string[];
  phone: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  createdAt: any;
  updatedAt: any;
}

interface RestaurantForSearch extends FirebaseRestaurant {
  rating: number;
  distance: string;
  coverImage: string;
}

interface RestaurantSearchProps {
  onSelect: (restaurant: RestaurantForSearch) => void;
}
const RestaurantSearch: React.FC<RestaurantSearchProps> = ({
  onSelect
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantForSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCuisineModal, setShowCuisineModal] = useState(false);
  console.log('Modal state:', showLocationModal);
  const [pendingRestaurant, setPendingRestaurant] = useState<RestaurantForSearch | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [pendingRestaurantName, setPendingRestaurantName] = useState('');
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places']
  });
  const [googlePlacePredictions, setGooglePlacePredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [fetchingGooglePlaces, setFetchingGooglePlaces] = useState(false);


  // Fetch restaurants from Firebase
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const restaurantsCollection = collection(db, 'restaurants');
        const restaurantSnapshot = await getDocs(restaurantsCollection);
        
        const restaurantList: RestaurantForSearch[] = restaurantSnapshot.docs.map((doc, index) => {
          const data = doc.data() as FirebaseRestaurant;
          
          // Add mock data for fields not in Firebase yet
          const mockExtras = {
            rating: 4.0 + Math.random() * 1.0, // Random rating between 4.0-5.0
            distance: `${(0.5 + Math.random() * 2).toFixed(1)} mi`, // Random distance
            coverImage: `https://images.unsplash.com/photo-${1579684947550 + index}?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80`
          };
          
          return {
            id: doc.id,
            ...data,
            ...mockExtras
          };
        });
        
        setRestaurants(restaurantList);
        console.log(`Loaded ${restaurantList.length} restaurants for search`);
      } catch (err: any) {
        console.error('Error fetching restaurants:', err);
        setError('Failed to load restaurants');
      } finally {
        setLoading(false);
      }
    };
    
    fetchRestaurants();
  }, []);

  const fetchGooglePlaces = async (searchText: string) => {
    if (!searchText || searchText.length < 2 || !mapsLoaded || typeof google === 'undefined') {
      setGooglePlacePredictions([]);
      return;
    }

    try {
      setFetchingGooglePlaces(true);
      const service = new google.maps.places.AutocompleteService();
      const request = {
        input: searchText,
        types: ['restaurant'],
        componentRestrictions: { country: 'us' }
      };

      service.getPlacePredictions(request, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setGooglePlacePredictions(predictions.slice(0, 5));
        } else {
          setGooglePlacePredictions([]);
        }
        setFetchingGooglePlaces(false);
      });
    } catch (error) {
      console.error('Error fetching Google Places:', error);
      setGooglePlacePredictions([]);
      setFetchingGooglePlaces(false);
    }
  };

  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleGooglePlaceSelected = async (placeId: string, placeName: string) => {
    if (typeof google === 'undefined') {
      return;
    }

    try {
      setFetchingGooglePlaces(true);

      // Check if this restaurant already exists in Firebase
      const placeQuery = firestoreQuery(collection(db, 'restaurants'), where('googlePlaceId', '==', placeId));
      const snapshot = await getDocs(placeQuery);

      if (!snapshot.empty) {
        // Restaurant already exists, just select it
        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as FirebaseRestaurant;
        const mockExtras = {
          rating: 4.0 + Math.random() * 1.0,
          distance: '0 mi',
          coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        };
        onSelect({
          id: docSnap.id,
          ...data,
          ...mockExtras
        });
        setQuery(placeName);
        setIsOpen(false);
        setGooglePlacePredictions([]);
      } else {
        // Fetch full details and save to Firebase
        const container = document.createElement('div');
        const service = new google.maps.places.PlacesService(container);

        service.getDetails(
          {
            placeId,
            fields: [
              'name',
              'formatted_address',
              'formatted_phone_number',
              'geometry',
              'place_id',
              'types',
              'photos',
              'opening_hours',
              'website',
              'price_level',
              'rating'
            ]
          },
          async (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              try {
                // Save to Firebase in background (fire-and-forget)
                saveGooglePlaceToFirestore(place).catch((error) => {
                  console.warn('Failed to save Google place to Firestore:', error);
                });

                // Create restaurant object for immediate selection
                const newRestaurant: RestaurantForSearch = {
                  id: placeId,
                  name: place.name || placeName,
                  address: place.formatted_address || '',
                  cuisine: 'restaurant',
                  cuisines: [],
                  phone: place.formatted_phone_number || '',
                  coordinates: {
                    lat: place.geometry?.location?.lat() || 0,
                    lng: place.geometry?.location?.lng() || 0
                  },
                  googlePlaceId: placeId, // Ensure googlePlaceId is included
                  createdAt: null,
                  updatedAt: null,
                  rating: place.rating || 0,
                  distance: '0 mi',
                  coverImage: place.photos?.[0]?.getUrl({ maxWidth: 500, maxHeight: 500 }) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
                } as any;

                onSelect(newRestaurant);
                setQuery(place.name || placeName);
                setIsOpen(false);
                setGooglePlacePredictions([]);
              } catch (error) {
                console.error('Error handling Google place selection:', error);
              }
            }
            setFetchingGooglePlaces(false);
          }
        );
      }
    } catch (error) {
      console.error('Error selecting Google place:', error);
      setFetchingGooglePlaces(false);
    }
  };

  const handleManualRestaurantAdd = () => {
    const trimmedName = query.trim();
    if (!trimmedName) return;
    setPendingRestaurantName(trimmedName);
    setSelectedCuisine(null);
    setShowCuisineModal(true);
  };

  const handleCuisineCancel = () => {
    setShowCuisineModal(false);
    setSelectedCuisine(null);
    setPendingRestaurantName('');
  };

  const handleCuisineConfirm = () => {
    if (!selectedCuisine || !pendingRestaurantName) return;
    const manualRestaurant: RestaurantForSearch = {
      name: pendingRestaurantName,
      cuisine: selectedCuisine,
      cuisines: [selectedCuisine],
      id: `manual_${Date.now()}`,
      address: '',
      phone: '',
      coordinates: { lat: 0, lng: 0 },
      createdAt: null,
      updatedAt: null,
      rating: 0,
      distance: '0 mi',
      coverImage:
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    };
    setPendingRestaurant(manualRestaurant);
    setShowCuisineModal(false);
    console.log('Setting showLocationModal to true');
    setShowLocationModal(true);
  };

  const handleLocationConfirm = (location: { latitude: number; longitude: number }) => {
    if (pendingRestaurant) {
      const updatedRestaurant = {
        ...pendingRestaurant,
        coordinates: {
          lat: location.latitude,
          lng: location.longitude
        }
      };
      onSelect(updatedRestaurant);
    }
    setShowLocationModal(false);
    setPendingRestaurant(null);
    setIsOpen(false);
    setPendingRestaurantName('');
    setSelectedCuisine(null);
  };

  const handleLocationCancel = () => {
    setShowLocationModal(false);
    setPendingRestaurant(null);
    setPendingRestaurantName('');
    setSelectedCuisine(null);
  };
  return <div className="relative">
      {/* Restaurant search input */}
      <div className="flex items-center border border-medium-gray rounded-xl p-3">
        <SearchIcon size={20} className="text-dark-gray mr-2" />
        <input type="text" placeholder="Search for a restaurant..." value={query} onChange={e => {
        const value = e.target.value;
        setQuery(value);
        setIsOpen(true);
        if (value.length >= 2) {
          fetchGooglePlaces(value);
        } else {
          setGooglePlacePredictions([]);
        }
      }} className="flex-1 focus:outline-none" />
      </div>
      {isOpen && query && (
        <div className="absolute z-10 left-0 right-0 mt-2 bg-white rounded-xl shadow-lg max-h-64 overflow-y-auto border border-gray-200">
          {loading || fetchingGooglePlaces ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading restaurants...</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-600">
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              {googlePlacePredictions.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400 font-semibold bg-gray-50 border-b">
                    From Google Places
                  </div>
                  {googlePlacePredictions.map(prediction => (
                    <button
                      key={prediction.place_id}
                      className="w-full p-3 flex items-start hover:bg-blue-50 transition-colors border-b border-gray-100"
                      onClick={() => handleGooglePlaceSelected(prediction.place_id, prediction.structured_formatting?.main_text || prediction.description)}
                    >
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">
                          {prediction.structured_formatting?.main_text || prediction.description}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {prediction.structured_formatting?.secondary_text}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
              {filteredRestaurants.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400 font-semibold bg-gray-50 border-b">
                    Your Saved Restaurants
                  </div>
                  {filteredRestaurants.map(restaurant => (
                    <button
                      key={restaurant.id}
                      className="w-full p-3 flex items-start hover:bg-light-gray transition-colors border-b border-gray-100"
                      onClick={() => {
                        onSelect(restaurant);
                        setQuery(restaurant.name);
                        setIsOpen(false);
                      }}
                    >
                      <img
                        src={restaurant.coverImage}
                        alt={restaurant.name}
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80';
                        }}
                      />
                      <div className="ml-3 flex-1 text-left">
                        <div className="flex items-center">
                          <span className="font-medium">{restaurant.name}</span>
                          <div className="ml-2 flex items-center">
                            <StarIcon size={14} className="text-accent" />
                            <span className="ml-1 text-sm">{restaurant.rating.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-dark-gray mt-1">
                          <span className="mr-2">{restaurant.cuisine}</span>
                          <MapPinIcon size={14} className="mr-1" />
                          <span>{restaurant.distance}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
              {query.trim() && googlePlacePredictions.length === 0 && filteredRestaurants.length === 0 && (
                <button
                  className="w-full p-3 flex items-center hover:bg-blue-50 transition-colors border-t border-gray-100 bg-gray-50"
                  onClick={handleManualRestaurantAdd}
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <PlusIcon size={20} className="text-blue-600" />
                  </div>
                  <div className="ml-3 flex-1 text-left">
                    <div className="font-medium text-blue-600">
                      + Add '{query}' as new restaurant
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Create a custom restaurant entry
                    </div>
                  </div>
                </button>
              )}
              {googlePlacePredictions.length === 0 && filteredRestaurants.length === 0 && !loading && !error && (
                <div className="p-4 text-center text-gray-500">
                  <p className="text-sm">No restaurants found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <CuisineSelectionModal
        isOpen={showCuisineModal}
        restaurantName={pendingRestaurantName || query}
        selectedCuisine={selectedCuisine}
        onSelect={setSelectedCuisine}
        onConfirm={handleCuisineConfirm}
        onCancel={handleCuisineCancel}
      />
      {console.log('Rendering modal with isOpen:', showLocationModal)}
      <LocationPickerModal
        isOpen={showLocationModal}
        restaurantName={pendingRestaurant?.name || ''}
        onConfirm={handleLocationConfirm}
        onCancel={handleLocationCancel}
      />
    </div>;
};

interface CuisineSelectionModalProps {
  isOpen: boolean;
  restaurantName: string;
  selectedCuisine: string | null;
  onSelect: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const CuisineSelectionModal: React.FC<CuisineSelectionModalProps> = ({
  isOpen,
  restaurantName,
  selectedCuisine,
  onSelect,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-slate-900">
          {`What type of cuisine is ${restaurantName || 'this restaurant'}?`}
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">Select the cuisine that fits best.</p>
        <div className="max-h-64 overflow-y-auto grid grid-cols-2 gap-2">
          {CUISINES.map((cuisine) => {
            const label = formatCuisineLabel(cuisine);
            const active = selectedCuisine === cuisine;
            return (
              <button
                key={cuisine}
                type="button"
                onClick={() => onSelect(cuisine)}
                className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-red-500 text-white shadow-md shadow-red-200/60'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!selectedCuisine}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
              selectedCuisine ? 'bg-[#ff3131] hover:bg-[#e02a2a]' : 'bg-red-200 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
export default RestaurantSearch;
