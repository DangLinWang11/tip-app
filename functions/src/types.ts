export interface ReviewDoc {
  id?: string;
  userId?: string;
  restaurantId?: string;
  createdAt?: FirebaseFirestore.Timestamp | any;
  verification?: {
    state?: string;
    proofUrls?: string[];
    matchScore?: number;
  };
}

export interface RestaurantDoc {
  id?: string;
  name?: string;
  coordinates?: { lat: number; lng: number };
}

