export const restaurants = [{
  id: 1,
  name: "Pasta Paradise",
  cuisine: "Italian",
  rating: 4.7,
  qualityPercentage: 92,
  distance: "0.8 mi",
  priceRange: "$$",
  location: {
    lat: 27.3364,
    lng: -82.5307
  },
  coverImage: "https://images.unsplash.com/photo-1579684947550-22e945225d9a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
  posts: [{
    id: 101,
    dish: "Truffle Pasta",
    rating: 4.9,
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
    likes: 342,
    comments: 56,
    price: "$18",
    description: "Homemade pasta with black truffle cream sauce. Absolutely divine!",
    tags: ["pasta", "truffle", "creamy"]
  }, {
    id: 102,
    dish: "Margherita Pizza",
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
    likes: 215,
    comments: 31,
    price: "$15",
    description: "Classic margherita with fresh buffalo mozzarella and basil",
    tags: ["pizza", "classic", "vegetarian"]
  }]
}, {
  id: 2,
  name: "Sushi Sensation",
  cuisine: "Japanese",
  rating: 4.8,
  qualityPercentage: 96,
  distance: "1.2 mi",
  priceRange: "$$$",
  location: {
    lat: 27.3389,
    lng: -82.5435
  },
  coverImage: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
  posts: [{
    id: 201,
    dish: "Rainbow Roll",
    rating: 5.0,
    image: "https://images.unsplash.com/photo-1553621042-f6e147245754?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
    likes: 428,
    comments: 89,
    price: "$24",
    description: "Fresh assortment of fish on top of a California roll. Melts in your mouth!",
    tags: ["sushi", "fresh", "seafood"]
  }, {
    id: 202,
    dish: "Tuna Tartare",
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
    likes: 312,
    comments: 45,
    price: "$22",
    description: "Spicy tuna tartare with avocado and crispy wonton chips",
    tags: ["tuna", "spicy", "appetizer"]
  }]
}, {
  id: 3,
  name: "Burger Bistro",
  cuisine: "American",
  rating: 4.5,
  qualityPercentage: 88,
  distance: "0.5 mi",
  priceRange: "$$",
  location: {
    lat: 27.3295,
    lng: -82.5373
  },
  coverImage: "https://images.unsplash.com/photo-1550547660-d9450f859349?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
  posts: [{
    id: 301,
    dish: "Truffle Burger",
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
    likes: 386,
    comments: 67,
    price: "$19",
    description: "Wagyu beef with truffle aioli, caramelized onions, and arugula on a brioche bun",
    tags: ["burger", "truffle", "gourmet"]
  }, {
    id: 302,
    dish: "Sweet Potato Fries",
    rating: 4.6,
    image: "https://images.unsplash.com/photo-1604908177453-7462950dfd4c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
    likes: 245,
    comments: 28,
    price: "$8",
    description: "Crispy sweet potato fries with chipotle aioli",
    tags: ["fries", "sides", "crispy"]
  }]
}];

export const notifications = [{
  id: 1,
  type: "like",
  user: {
    name: "Emma Wilson",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg"
  },
  content: "liked your review of Truffle Pasta",
  restaurant: "Pasta Paradise",
  time: "2h ago"
}, {
  id: 2,
  type: "comment",
  user: {
    name: "James Rodriguez",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg"
  },
  content: "commented: \"Looks amazing! Was it worth the price?\"",
  restaurant: "Sushi Sensation",
  time: "5h ago"
}, {
  id: 3,
  type: "follow",
  user: {
    name: "Sophia Chen",
    avatar: "https://randomuser.me/api/portraits/women/23.jpg"
  },
  content: "started following you",
  time: "1d ago"
}, {
  id: 4,
  type: "foodie_activity",
  user: {
    name: "Michael Brown",
    avatar: "https://randomuser.me/api/portraits/men/91.jpg"
  },
  content: "posted a review of Burger Bistro",
  restaurant: "Burger Bistro",
  image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
  time: "2d ago"
}];

export const userPosts = [{
  id: "up1",
  restaurantId: 1,  // Added for navigation
  dishId: 101,      // Added for navigation
  author: {
    name: "Alex Johnson",
    image: "https://randomuser.me/api/portraits/women/65.jpg",
    isVerified: true
  },
  restaurant: {
    name: "Pasta Paradise",
    isVerified: true,
    qualityScore: 92  // Added quality score
  },
  dish: {
    name: "Truffle Pasta",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601",
    rating: 8.7,
    visitCount: 2
  },
  review: {
    positive: "The truffle aroma is incredible, and the pasta is perfectly al dente",
    negative: "A bit pricey for the portion size",
    date: "2024-01-15"
  },
  engagement: {
    likes: 342,
    comments: 56
  }
}, {
  id: "up2",
  restaurantId: 3,  // Added for navigation
  dishId: 301,      // Added for navigation
  author: {
    name: "Sarah Chen",
    image: "https://randomuser.me/api/portraits/women/44.jpg"
  },
  restaurant: {
    name: "Burger Bistro",
    isVerified: true,
    qualityScore: 88  // Added quality score
  },
  dish: {
    name: "Wagyu Burger",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd",
    rating: 9.2,
    visitCount: 1
  },
  review: {
    positive: "The meat is incredibly juicy and flavorful",
    negative: "The bun got a bit soggy towards the end",
    date: "2024-01-14"
  },
  engagement: {
    likes: 289,
    comments: 42
  }
}];

export const userProfile = {
  username: "dangerous_swimmer903",
  name: "Alex Johnson",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
  bio: "Always hunting for the next amazing dish 🍽️ | Food photographer 📸 | Pasta enthusiast 🍝",
  stats: {
    restaurantsTried: 450,
    reviewsGiven: 142,
    followers: "1.8k",
    following: 348,
    averageRating: 8.4,
    dishesTried: "2.6k",
    pointsEarned: 2750,
    totalVisits: 203,
    reviewCount: 142,
    favoriteCategories: ["Italian", "Japanese", "American"],
    mostVisitedRestaurants: [{
      name: "Pasta Paradise",
      visits: 12,
      averageRating: 8.9
    }, {
      name: "Sushi Sensation",
      visits: 8,
      averageRating: 9.1
    }],
    recentActivity: [{
      type: "review",
      restaurant: "Burger Bistro",
      dish: "Truffle Burger",
      rating: 8.5,
      date: "2024-01-15",
      positive: "Amazing flavor combination",
      negative: "Could use more truffle"
    }, {
      type: "visit",
      restaurant: "Sushi Sensation",
      date: "2024-01-12"
    }]
  },
  tierRankings: {
    topDish: {
      name: "Grouper Piccata",
      rating: 9.2,
      restaurant: "Marina Jack's",
      visitCount: 3,
      restaurantId: 4,
      dishId: 401
    },
    topRestaurant: {
      name: "The Capital Grille",
      qualityPercentage: 94,
      userAverage: 8.9,
      visitCount: 5,
      restaurantId: 5
    }
  },
  wishlists: [{
    id: 1,
    name: "Must Try Pasta",
    count: 8,
    type: "dishes",
    coverImage: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
  }, {
    id: 2,
    name: "Birthday Dinner Ideas",
    count: 5,
    type: "restaurants",
    coverImage: "https://images.unsplash.com/photo-1544025162-d76694265947?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
  }, {
    id: 3,
    name: "Weekend Brunch",
    count: 12,
    type: "dishes",
    coverImage: "https://images.unsplash.com/photo-1525351484163-7529414344d8?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80"
  }]
};

// Convert restaurant posts to feed format with quality scores
export const restaurantPosts = restaurants.flatMap(restaurant => 
  restaurant.posts.map(post => ({
    id: `rp${post.id}`,
    restaurantId: restaurant.id,  // Added for navigation
    dishId: post.id,              // Added for navigation
    type: "restaurant",
    author: {
      name: restaurant.name,
      image: restaurant.coverImage,
      isVerified: restaurant.qualityPercentage >= 90,
      isRestaurant: true
    },
    restaurant: {
      name: restaurant.name,
      isVerified: restaurant.qualityPercentage >= 90,
      qualityScore: restaurant.qualityPercentage  // Added quality score from restaurant data
    },
    dish: {
      name: post.dish,
      image: post.image,
      rating: post.rating,
      price: post.price
    },
    review: {
      positive: post.description,
      negative: "Price could be more reasonable",
      date: "2024-01-" + (Math.floor(Math.random() * 15) + 1).toString().padStart(2, '0')
    },
    engagement: {
      likes: post.likes,
      comments: post.comments
    }
  }))
);

// Profile posts for dangerous_swimmer903 - expanded with more liked/commented activities
export const profilePosts = [
  // User's own post - MOST RECENT
  {
    id: "pp1",
    restaurantId: 4,
    dishId: 401,
    activityType: "own_post",
    author: {
      name: "dangerous_swimmer903",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      isVerified: false
    },
    restaurant: {
      name: "Marina Jack's",
      isVerified: true,
      qualityScore: 91
    },
    dish: {
      name: "Grouper Piccata",
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 9.2,
      visitCount: 3
    },
    review: {
      positive: "Perfectly prepared grouper with a tangy lemon caper sauce. The fish was flaky and fresh.",
      negative: "A bit pricey for the portion size, but worth it for special occasions",
      date: "2024-01-22"
    },
    engagement: {
      likes: 127,
      comments: 18
    }
  },

  // Liked post from SarasotaFoodie
  {
    id: "pp2",
    restaurantId: 5,
    dishId: 501,
    activityType: "liked_post",
    author: {
      name: "SarasotaFoodie",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
      isVerified: true
    },
    restaurant: {
      name: "The Capital Grille",
      isVerified: true,
      qualityScore: 94
    },
    dish: {
      name: "Dry Aged Ribeye",
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.9,
      visitCount: 1
    },
    review: {
      positive: "Exceptional dry-aged flavor with perfect char. Cooked exactly to temperature.",
      negative: "Could use a bit more seasoning on the outside crust",
      date: "2024-01-21"
    },
    engagement: {
      likes: 156,
      comments: 23
    },
    likedBy: "dangerous_swimmer903"
  },

  // Commented on FlaBayFoodie's post
  {
    id: "pp3",
    restaurantId: 12,
    dishId: 1201,
    activityType: "commented_post",
    author: {
      name: "FlaBayFoodie",
      image: "https://randomuser.me/api/portraits/women/23.jpg",
      isVerified: false
    },
    restaurant: {
      name: "Yoder's Restaurant",
      isVerified: false,
      qualityScore: 85
    },
    dish: {
      name: "Amish Fried Chicken",
      image: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.4,
      visitCount: 1
    },
    review: {
      positive: "Crispy coating with tender, juicy meat. Authentic Amish comfort food at its finest.",
      negative: "Gets busy during tourist season, expect a wait on weekends",
      date: "2024-01-20"
    },
    engagement: {
      likes: 89,
      comments: 15
    },
    commentedBy: "dangerous_swimmer903",
    userComment: "This place is a hidden gem! The pies are incredible too - try the peanut butter cream!"
  },

  // User's own post
  {
    id: "pp4",
    restaurantId: 6,
    dishId: 601,
    activityType: "own_post",
    author: {
      name: "dangerous_swimmer903",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      isVerified: false
    },
    restaurant: {
      name: "Selva Grill",
      isVerified: true,
      qualityScore: 89
    },
    dish: {
      name: "Ceviche Mixto",
      image: "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.7,
      visitCount: 1
    },
    review: {
      positive: "Fresh seafood medley with perfect acidity. Great balance of flavors and textures.",
      negative: "A bit too much cilantro for my taste, but still excellent overall",
      date: "2024-01-19"
    },
    engagement: {
      likes: 94,
      comments: 12
    }
  },

  // Liked post from GulfCoastEats
  {
    id: "pp5",
    restaurantId: 13,
    dishId: 1301,
    activityType: "liked_post",
    author: {
      name: "GulfCoastEats",
      image: "https://randomuser.me/api/portraits/men/32.jpg",
      isVerified: false
    },
    restaurant: {
      name: "Owen's Fish Camp",
      isVerified: true,
      qualityScore: 88
    },
    dish: {
      name: "Blackened Red Snapper",
      image: "https://images.unsplash.com/photo-1544943910-4c1dc44aab44?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.6,
      visitCount: 2
    },
    review: {
      positive: "Perfect blackening spice blend, fish was incredibly fresh. Great atmosphere too.",
      negative: "Service can be slow when they're packed, but worth the wait",
      date: "2024-01-18"
    },
    engagement: {
      likes: 134,
      comments: 19
    },
    likedBy: "dangerous_swimmer903"
  },

  // Commented on SRQEater's post
  {
    id: "pp6",
    restaurantId: 14,
    dishId: 1401,
    activityType: "commented_post",
    author: {
      name: "SRQEater",
      image: "https://randomuser.me/api/portraits/men/45.jpg",
      isVerified: true
    },
    restaurant: {
      name: "Michael's On East",
      isVerified: true,
      qualityScore: 92
    },
    dish: {
      name: "Duck Confit",
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 9.0,
      visitCount: 1
    },
    review: {
      positive: "Perfectly rendered duck with crispy skin. The cherry gastrique was a nice touch.",
      negative: "Portion could be a bit larger for the price point",
      date: "2024-01-17"
    },
    engagement: {
      likes: 118,
      comments: 16
    },
    commentedBy: "dangerous_swimmer903",
    userComment: "Agreed! Their wine selection pairs perfectly with this dish. Try the Pinot Noir!"
  },

  // Liked post from SarasotaSnacker
  {
    id: "pp7",
    restaurantId: 15,
    dishId: 1501,
    activityType: "liked_post",
    author: {
      name: "SarasotaSnacker",
      image: "https://randomuser.me/api/portraits/women/67.jpg",
      isVerified: false
    },
    restaurant: {
      name: "Made Restaurant",
      isVerified: true,
      qualityScore: 90
    },
    dish: {
      name: "Truffle Mac & Cheese",
      image: "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.8,
      visitCount: 1
    },
    review: {
      positive: "Incredibly rich and creamy with real truffle shavings. Comfort food elevated.",
      negative: "Very rich - hard to finish the whole portion, but that's not necessarily bad!",
      date: "2024-01-16"
    },
    engagement: {
      likes: 201,
      comments: 28
    },
    likedBy: "dangerous_swimmer903"
  },

  // User's own post
  {
    id: "pp8",
    restaurantId: 7,
    dishId: 701,
    activityType: "own_post",
    author: {
      name: "dangerous_swimmer903",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      isVerified: false
    },
    restaurant: {
      name: "Ophelia's on the Bay",
      isVerified: true,
      qualityScore: 87
    },
    dish: {
      name: "Pan Seared Scallops",
      image: "https://images.unsplash.com/photo-1559847844-d7b60ba6803a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.5,
      visitCount: 2
    },
    review: {
      positive: "Beautiful sear on the scallops with a creamy risotto base. Great waterfront views.",
      negative: "Service was a bit slow during peak hours, but the food made up for it",
      date: "2024-01-15"
    },
    engagement: {
      likes: 76,
      comments: 9
    }
  },

  // Commented on BayAreaBites's post
  {
    id: "pp9",
    restaurantId: 16,
    dishId: 1601,
    activityType: "commented_post",
    author: {
      name: "BayAreaBites",
      image: "https://randomuser.me/api/portraits/women/89.jpg",
      isVerified: false
    },
    restaurant: {
      name: "Rosemary and Thyme",
      isVerified: false,
      qualityScore: 83
    },
    dish: {
      name: "Herb Crusted Lamb",
      image: "https://images.unsplash.com/photo-1544025162-d76694265947?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.2,
      visitCount: 1
    },
    review: {
      positive: "Perfectly cooked lamb with a beautiful herb crust. Cozy neighborhood spot.",
      negative: "Limited parking, might want to arrive early or use rideshare",
      date: "2024-01-14"
    },
    engagement: {
      likes: 67,
      comments: 11
    },
    commentedBy: "dangerous_swimmer903",
    userComment: "Love this place! Their Sunday brunch is amazing too. The eggs benedict is top tier!"
  },

  // Liked post from ChefMike941
  {
    id: "pp10",
    restaurantId: 9,
    dishId: 901,
    activityType: "liked_post",
    author: {
      name: "ChefMike941",
      image: "https://randomuser.me/api/portraits/men/91.jpg",
      isVerified: true
    },
    restaurant: {
      name: "Indigenous",
      isVerified: true,
      qualityScore: 93
    },
    dish: {
      name: "Local Snapper Crudo",
      image: "https://images.unsplash.com/photo-1505253213348-cd54c92b37d8?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 9.0,
      visitCount: 1
    },
    review: {
      positive: "Incredibly fresh local fish with creative preparation. Chef really knows their craft.",
      negative: "Small portions for the price point, but quality justifies it",
      date: "2024-01-13"
    },
    engagement: {
      likes: 189,
      comments: 31
    },
    likedBy: "dangerous_swimmer903"
  },

  // Commented on SuncoastFoodie's post
  {
    id: "pp11",
    restaurantId: 17,
    dishId: 1701,
    activityType: "commented_post",
    author: {
      name: "SuncoastFoodie",
      image: "https://randomuser.me/api/portraits/men/54.jpg",
      isVerified: false
    },
    restaurant: {
      name: "Bijou Cafe",
      isVerified: true,
      qualityScore: 86
    },
    dish: {
      name: "Eggs Benedict",
      image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.3,
      visitCount: 3
    },
    review: {
      positive: "Perfect hollandaise sauce and properly poached eggs. Great downtown brunch spot.",
      negative: "Can get crowded on weekends, make reservations if possible",
      date: "2024-01-12"
    },
    engagement: {
      likes: 95,
      comments: 14
    },
    commentedBy: "dangerous_swimmer903",
    userComment: "Been here so many times! Their coffee is outstanding too. Perfect weekend spot!"
  },

  // User's own post
  {
    id: "pp12",
    restaurantId: 8,
    dishId: 801,
    activityType: "own_post",
    author: {
      name: "dangerous_swimmer903",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      isVerified: false
    },
    restaurant: {
      name: "Mattison's City Grille",
      isVerified: false,
      qualityScore: 82
    },
    dish: {
      name: "Blackened Mahi Sandwich",
      image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 7.8,
      visitCount: 1
    },
    review: {
      positive: "Good casual spot with fresh fish. Nice spice blend on the blackening seasoning.",
      negative: "Bun was a bit soggy from the fish juices, needs better construction",
      date: "2024-01-11"
    },
    engagement: {
      likes: 52,
      comments: 8
    }
  },

  // Liked post from WestCoastFlavors
  {
    id: "pp13",
    restaurantId: 18,
    dishId: 1801,
    activityType: "liked_post",
    author: {
      name: "WestCoastFlavors",
      image: "https://randomuser.me/api/portraits/women/12.jpg",
      isVerified: false
    },
    restaurant: {
      name: "State Street Eating House",
      isVerified: false,
      qualityScore: 81
    },
    dish: {
      name: "Shrimp and Grits",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.1,
      visitCount: 1
    },
    review: {
      positive: "Creamy grits with perfectly seasoned shrimp. Good Southern comfort food.",
      negative: "Could use a bit more spice in the seasoning, but still solid",
      date: "2024-01-10"
    },
    engagement: {
      likes: 73,
      comments: 12
    },
    likedBy: "dangerous_swimmer903"
  },

  // Commented on Gulf941's post
  {
    id: "pp14",
    restaurantId: 10,
    dishId: 1001,
    activityType: "commented_post",
    author: {
      name: "Gulf941",
      image: "https://randomuser.me/api/portraits/men/76.jpg",
      isVerified: false
    },
    restaurant: {
      name: "Boatyard Waterfront",
      isVerified: false,
      qualityScore: 78
    },
    dish: {
      name: "Coconut Shrimp",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 7.5,
      visitCount: 1
    },
    review: {
      positive: "Great casual waterfront dining. Shrimp was crispy with sweet coconut coating.",
      negative: "Gets crowded during sunset, make reservations ahead",
      date: "2024-01-09"
    },
    engagement: {
      likes: 84,
      comments: 13
    },
    commentedBy: "dangerous_swimmer903",
    userComment: "The sunset views make this place! Try the key lime pie if you have room for dessert 🌅"
  },

  // User's own post - OLDEST
  {
    id: "pp15",
    restaurantId: 11,
    dishId: 1101,
    activityType: "own_post",
    author: {
      name: "dangerous_swimmer903",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      isVerified: false
    },
    restaurant: {
      name: "Duval's Fresh. Local. Seafood.",
      isVerified: true,
      qualityScore: 86
    },
    dish: {
      name: "Grouper Sandwich",
      image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
      rating: 8.3,
      visitCount: 2
    },
    review: {
      positive: "Fresh local grouper, perfectly seasoned and not overcooked. Great casual lunch spot.",
      negative: "Could use a better bun, it was a bit too soft for the weight of the fish",
      date: "2024-01-08"
    },
    engagement: {
      likes: 67,
      comments: 11
    }
  }
];

// Combine all posts and sort by date
export const feedPosts = [...userPosts, ...restaurantPosts].sort((a, b) => 
  new Date(b.review.date).getTime() - new Date(a.review.date).getTime()
);