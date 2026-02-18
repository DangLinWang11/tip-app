export interface DemoReview {
  id: string;
  dish: string;
  rating: number;
  note: string;
  createdAt: string;
}

export interface DemoRestaurant {
  id: string;
  name: string;
  cuisine: string;
  location: { lat: number; lng: number };
  rating: number;
  visitCount: number;
  countryCode: string;
  lastVisit: string;
  photoUrl?: string;
  reviews: DemoReview[];
}

export const demoJourneyCenter = { lat: 41.8818, lng: -87.6232 };
export const demoJourneyZoom = 12;

export const demoJourneyRestaurants: DemoRestaurant[] = [
  {
    id: 'demo-chi-1',
    name: 'Lakeside Pasta House',
    cuisine: 'Italian',
    location: { lat: 41.8846, lng: -87.6324 },
    rating: 8.9,
    visitCount: 3,
    countryCode: 'US',
    lastVisit: '2026-01-12',
    photoUrl: '',
    reviews: [
      {
        id: 'demo-review-1',
        dish: 'Rigatoni alla Vodka',
        rating: 9.2,
        note: 'Creamy sauce, perfect spice balance.',
        createdAt: '2026-01-12'
      }
    ]
  },
  {
    id: 'demo-chi-2',
    name: 'Windy City Tacos',
    cuisine: 'Mexican',
    location: { lat: 41.8769, lng: -87.6297 },
    rating: 8.4,
    visitCount: 2,
    countryCode: 'US',
    lastVisit: '2026-01-05',
    photoUrl: '',
    reviews: [
      {
        id: 'demo-review-2',
        dish: 'Birria Taco Trio',
        rating: 8.6,
        note: 'Juicy, rich, and super comforting.',
        createdAt: '2026-01-05'
      }
    ]
  },
  {
    id: 'demo-chi-3',
    name: 'Skyline Sushi Bar',
    cuisine: 'Japanese',
    location: { lat: 41.8922, lng: -87.6261 },
    rating: 9.1,
    visitCount: 4,
    countryCode: 'US',
    lastVisit: '2025-12-20',
    photoUrl: '',
    reviews: [
      {
        id: 'demo-review-3',
        dish: 'Chef Omakase',
        rating: 9.5,
        note: 'Silky fish, perfect rice texture.',
        createdAt: '2025-12-20'
      }
    ]
  },
  {
    id: 'demo-chi-4',
    name: 'Blue Line Coffee',
    cuisine: 'Cafe',
    location: { lat: 41.8724, lng: -87.6405 },
    rating: 8.0,
    visitCount: 1,
    countryCode: 'US',
    lastVisit: '2025-12-08',
    photoUrl: '',
    reviews: [
      {
        id: 'demo-review-4',
        dish: 'Brown Sugar Latte',
        rating: 8.2,
        note: 'Smooth and cozy, not too sweet.',
        createdAt: '2025-12-08'
      }
    ]
  },
  {
    id: 'demo-chi-5',
    name: 'River North Grill',
    cuisine: 'American',
    location: { lat: 41.8884, lng: -87.6355 },
    rating: 8.7,
    visitCount: 2,
    countryCode: 'US',
    lastVisit: '2025-11-28',
    photoUrl: '',
    reviews: [
      {
        id: 'demo-review-5',
        dish: 'Smashburger Deluxe',
        rating: 8.8,
        note: 'Crispy edges, juicy center.',
        createdAt: '2025-11-28'
      }
    ]
  }
];
