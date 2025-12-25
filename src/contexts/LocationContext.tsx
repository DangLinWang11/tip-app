import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locationStore } from '../utils/locationStore';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationContextType {
  hasPermission: boolean;
  isPermissionRequested: boolean;
  currentLocation: LocationCoordinates;
  isLoading: boolean;
  error: string | null;
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationCoordinates>;
  clearError: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isPermissionRequested, setIsPermissionRequested] = useState<boolean>(false);

  // Initialize from locationStore instead of null
  const storedLocation = locationStore.get();
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates>({
    latitude: storedLocation.lat,
    longitude: storedLocation.lng
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const permissionRequested = localStorage.getItem('locationPermissionRequested');
    if (permissionRequested) {
      setIsPermissionRequested(true);
      checkExistingPermission();
    }

    // Listen for localStorage changes
    const handleStorageChange = () => {
      const permissionRequested = localStorage.getItem('locationPermissionRequested');
      if (permissionRequested) {
        setIsPermissionRequested(true);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const checkExistingPermission = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setHasPermission(permission.state === 'granted');
      
      if (permission.state === 'granted') {
        getCurrentLocation();
      }
    } catch (err) {
      console.warn('Permission API not supported');
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      // Update both state and locationStore
      setCurrentLocation(coordinates);
      locationStore.update(coordinates.latitude, coordinates.longitude);

      setHasPermission(true);
      setIsPermissionRequested(true);
      localStorage.setItem('locationPermissionRequested', 'true');
      setIsLoading(false);
      return true;

    } catch (err) {
      setIsLoading(false);
      setIsPermissionRequested(true);
      localStorage.setItem('locationPermissionRequested', 'true');

      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location access denied by user');
            setHasPermission(false);
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location information unavailable');
            break;
          case err.TIMEOUT:
            setError('Location request timed out');
            break;
          default:
            setError('An unknown error occurred while retrieving location');
            break;
        }
      } else {
        setError('Failed to get location');
      }
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<LocationCoordinates> => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      // Return stored location as fallback
      return currentLocation;
    }

    if (!hasPermission) {
      setError('Location permission not granted');
      // Return stored location as fallback
      return currentLocation;
    }

    setIsLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      // Update both state and locationStore
      setCurrentLocation(coordinates);
      locationStore.update(coordinates.latitude, coordinates.longitude);

      setIsLoading(false);
      return coordinates;

    } catch (err) {
      setIsLoading(false);
      setError('Failed to get current location');
      // Return stored location as fallback
      return currentLocation;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: LocationContextType = {
    hasPermission,
    isPermissionRequested,
    currentLocation,
    isLoading,
    error,
    requestLocationPermission,
    getCurrentLocation,
    clearError
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
export const useLocationContext = useLocation;

