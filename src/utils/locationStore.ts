/**
 * Global Location Store
 * Singleton to hold and persist the user's last known location
 */

const STORAGE_KEY = 'tip_last_location';

// Default fallback location: Sarasota, FL
const DEFAULT_LOCATION = {
  lat: 27.3364,
  lng: -82.5307
};

export interface StoredLocation {
  lat: number;
  lng: number;
}

class LocationStore {
  private location: StoredLocation;

  constructor() {
    // Initialize from localStorage or use default
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.location = JSON.parse(stored);
      } catch {
        this.location = DEFAULT_LOCATION;
      }
    } else {
      this.location = DEFAULT_LOCATION;
    }
  }

  /**
   * Get the current stored location
   */
  get(): StoredLocation {
    return { ...this.location };
  }

  /**
   * Update the location and persist to localStorage
   */
  update(lat: number, lng: number): void {
    this.location = { lat, lng };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.location));
  }

  /**
   * Clear stored location and revert to default
   */
  clear(): void {
    this.location = DEFAULT_LOCATION;
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Export singleton instance
export const locationStore = new LocationStore();
