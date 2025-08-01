import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, StarIcon, MapPinIcon, PhoneIcon, ClockIcon, BookmarkIcon, ShareIcon, ChevronRightIcon, Utensils, Soup, Salad, Coffee, Cake, Fish, Pizza, Sandwich, ChefHat, ChevronDown } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  phone: string;
  cuisine: string;
  coordinates: { latitude: number; longitude: number };
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price?: number;
  description?: string;
}

interface Review {
  id: string;
  userId: string;
  dish: string;
  rating: number;
  personalNote: string;
  negativeNote: string;
  images: string[];
  createdAt: string;
}
const RestaurantDetail: React.FC = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [menuItemRatings, setMenuItemRatings] = useState<{[key: string]: {rating: number, count: number}}>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  // Helper function to group menu items by category
  const groupMenuByCategory = (items: MenuItem[]) => {
    return items.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  };

  // Helper function to calculate quality score from reviews
  const calculateQualityScore = (reviewsArray: Review[]) => {
    if (reviewsArray.length === 0) return null;
    const avgRating = reviewsArray.reduce((sum, review) => sum + review.rating, 0) / reviewsArray.length;
    return Math.round((avgRating / 10) * 100);
  };

  // Helper function to get all images from reviews
  const getAllReviewImages = (reviewsArray: Review[]) => {
    return reviewsArray.flatMap(review => review.images || []);
  };

  // Helper function to get category icon
  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('soup') || categoryLower.includes('bowl')) return Soup;
    if (categoryLower.includes('salad') || categoryLower.includes('green') || categoryLower.includes('vegetable')) return Salad;
    if (categoryLower.includes('coffee') || categoryLower.includes('tea') || categoryLower.includes('drink') || categoryLower.includes('beverage')) return Coffee;
    if (categoryLower.includes('dessert') || categoryLower.includes('cake') || categoryLower.includes('sweet')) return Cake;
    if (categoryLower.includes('fish') || categoryLower.includes('seafood')) return Fish;
    if (categoryLower.includes('pizza')) return Pizza;
    if (categoryLower.includes('sandwich') || categoryLower.includes('burger')) return Sandwich;
    if (categoryLower.includes('chef') || categoryLower.includes('special')) return ChefHat;
    return Utensils; // Default icon
  };

  const qualityScore = calculateQualityScore(reviews);
  const reviewImages = getAllReviewImages(reviews);
  const groupedMenu = groupMenuByCategory(menuItems);
  
  // Initialize first section as open when menu items are loaded
  useEffect(() => {
    if (menuItems.length > 0 && !initializedRef.current) {
      const categories = Object.keys(groupedMenu);
      if (categories.length > 0) {
        setOpenSections(new Set([categories[0]]));
        initializedRef.current = true;
      }
    }
  }, [menuItems, groupedMenu]);
  
  // Toggle section open/closed
  const toggleSection = (category: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(category)) {
      newOpenSections.delete(category);
    } else {
      newOpenSections.add(category);
    }
    setOpenSections(newOpenSections);
  };

  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // Fetch restaurant
        const restaurantDoc = await getDoc(doc(db, 'restaurants', id));
        if (restaurantDoc.exists()) {
          setRestaurant({ id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant);
        }
        
        // Fetch menu items
        const menuQuery = query(collection(db, 'menuItems'), where('restaurantId', '==', id));
        const menuSnapshot = await getDocs(menuQuery);
        const menuData = menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
        setMenuItems(menuData);
        
        // Fetch reviews
        const reviewsQuery = query(collection(db, 'reviews'), where('restaurantId', '==', id));
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsData = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
        setReviews(reviewsData);
        
        // Calculate individual menu item ratings
        const ratingsMap: {[key: string]: {rating: number, count: number}} = {};
        reviewsData.forEach(review => {
          if (review.menuItemId) {
            if (!ratingsMap[review.menuItemId]) {
              ratingsMap[review.menuItemId] = { rating: 0, count: 0 };
            }
            ratingsMap[review.menuItemId].rating += review.rating;
            ratingsMap[review.menuItemId].count += 1;
          }
        });
        
        // Calculate averages
        Object.keys(ratingsMap).forEach(menuItemId => {
          ratingsMap[menuItemId].rating = ratingsMap[menuItemId].rating / ratingsMap[menuItemId].count;
        });
        
        setMenuItemRatings(ratingsMap);
        
      } catch (error) {
        console.error('Error fetching restaurant data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRestaurantData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-dark-gray">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-dark-gray mb-4">Restaurant not found</p>
          <Link to="/" className="text-primary hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }
  return <div className="min-h-screen bg-light-gray pb-16">
      <div className="relative h-64">
        <img src="https://source.unsplash.com/800x400/food" alt={restaurant.name} className="w-full h-full object-cover" />
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4">
          <Link to="/" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <ArrowLeftIcon size={20} />
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="bg-white px-3 py-1 rounded-full inline-flex items-center">
            <div className={`w-3 h-3 rounded-full ${
              qualityScore === null ? 'bg-gray-400' : 
              qualityScore >= 90 ? 'bg-green-500' : 
              qualityScore >= 75 ? 'bg-yellow-500' : 'bg-red-500'
            } mr-2`}></div>
            <span className="font-medium text-sm">
              {qualityScore === null ? 'Not rated yet' : `${qualityScore}% Quality`}
            </span>
          </div>
        </div>
      </div>
      <div className="bg-white p-4 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
            <div className="flex items-center text-dark-gray mt-1">
              <span>{restaurant.cuisine}</span>
              <span className="mx-1">•</span>
              <div className="flex items-center">
                <MapPinIcon size={14} className="mr-1" />
                <span>{restaurant.address}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-2 flex items-center bg-light-gray px-3 py-1 rounded-full">
              <StarIcon size={16} className="text-accent mr-1" />
              <span className="font-medium">{reviews.length > 0 ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : 'N/A'}</span>
            </div>
          </div>
        </div>
        <div className="flex mt-4 space-x-3">
          <button 
            onClick={() => navigate('/create', { state: { selectedRestaurant: restaurant } })}
            className="flex-1 bg-primary text-white py-2 rounded-full font-medium"
          >
            Write Review
          </button>
          <button onClick={() => setSaved(!saved)} className="w-10 h-10 rounded-full border border-medium-gray flex items-center justify-center">
            <BookmarkIcon size={18} className={saved ? 'text-secondary fill-secondary' : ''} />
          </button>
          <button className="w-10 h-10 rounded-full border border-medium-gray flex items-center justify-center">
            <ShareIcon size={18} />
          </button>
        </div>
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">Info</h2>
        </div>
        <div className="mt-3 space-y-3">
          <div className="flex items-center">
            <MapPinIcon size={18} className="text-dark-gray mr-3" />
            <div>
              <p>{restaurant.address || 'Address not available'}</p>
              <p className="text-sm text-secondary">Get Directions</p>
            </div>
          </div>
          <div className="flex items-center">
            <PhoneIcon size={18} className="text-dark-gray mr-3" />
            <p>{restaurant.phone || 'Phone not available'}</p>
          </div>
          <div className="flex items-center">
            <ClockIcon size={18} className="text-dark-gray mr-3" />
            <div>
              <p>Hours not available</p>
              <p className="text-sm text-dark-gray">Contact restaurant for hours</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 px-4">
        <h2 className="font-semibold text-2xl mb-6 text-gray-900">Menu</h2>
        {menuItems.length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedMenu).map(([category, items]) => {
              const isOpen = openSections.has(category);
              const IconComponent = getCategoryIcon(category);
              return (
                <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggleSection(category)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mr-4">
                        <IconComponent size={20} className="text-red-500" style={{ color: '#ff3131' }} />
                      </div>
                      <h3 className="font-semibold text-lg text-gray-900">{category}</h3>
                    </div>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 space-y-4">
                      {items.map(item => (
                        <div 
                          key={item.id} 
                          className="flex cursor-pointer hover:bg-gray-50 p-4 rounded-xl transition-colors group"
                          onClick={() => navigate(`/dish/${item.id}`)}
                        >
                          <img 
                            src="https://source.unsplash.com/100x100/food" 
                            alt={item.name} 
                            className="w-20 h-20 rounded-xl object-cover" 
                          />
                          <div className="ml-4 flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold text-gray-900 flex-1 mr-2 group-hover:text-red-500 transition-colors" style={{ color: isOpen ? undefined : '#ff3131' }}>{item.name}</h4>
                              <div className="text-right">
                                <div className="text-sm text-gray-500 mb-1">
                                  {menuItemRatings[item.id] 
                                    ? `${menuItemRatings[item.id].rating.toFixed(1)}/10` 
                                    : '0/10 (no reviews yet)'
                                  }
                                </div>
                                {item.price && (
                                  <span className="font-semibold text-gray-900">${item.price}</span>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-600 text-sm line-clamp-2 mt-1">
                              {item.description || 'Delicious dish'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-12">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Utensils size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-600 mb-6">No menu items yet. Be the first to review a dish from this restaurant!</p>
            <button 
              onClick={() => navigate('/create', { state: { selectedRestaurant: restaurant } })}
              className="bg-red-500 text-white px-8 py-3 rounded-full font-medium hover:bg-red-600 transition-colors"
              style={{ backgroundColor: '#ff3131' }}
            >
              Add New Dish
            </button>
          </div>
        )}
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Popular Photos</h2>
        {reviewImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {reviewImages.slice(0, 6).map((image, index) => (
              <div key={index} className="aspect-square bg-medium-gray rounded-md overflow-hidden">
                <img 
                  src={image} 
                  alt="Food" 
                  className="w-full h-full object-cover" 
                />
              </div>
            ))}
          </div>
        ) : reviews.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="aspect-square bg-medium-gray rounded-md overflow-hidden">
                <img 
                  src={`https://source.unsplash.com/collection/1353633/300x300?sig=${index}`} 
                  alt="Food" 
                  className="w-full h-full object-cover" 
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-dark-gray">No photos yet. Share the first photo of this restaurant!</p>
          </div>
        )}
        {reviewImages.length > 0 && (
          <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
            View All Photos ({reviewImages.length})
          </button>
        )}
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm mb-8">
        <h2 className="font-semibold text-lg mb-4">Reviews</h2>
        <div className="space-y-4">
          {reviews.length > 0 ? reviews.slice(0, 3).map((review, index) => (
            <div key={review.id} className="border-b border-light-gray pb-4 last:border-0">
              <div className="flex items-start">
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${review.userId || 'anonymous'}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`} 
                  alt="User" 
                  className="w-10 h-10 rounded-full" 
                />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{review.dish}</p>
                      <div className="flex items-center">
                        <div className="flex">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <StarIcon 
                              key={i} 
                              size={12} 
                              className={i < review.rating ? 'text-accent fill-accent' : 'text-dark-gray'} 
                            />
                          ))}
                        </div>
                        <span className="text-xs text-dark-gray ml-2">
                          {review.rating}/10
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-dark-gray">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {review.personalNote && (
                    <div className="mt-2 p-2 bg-green-50 border-l-4 border-green-400 rounded">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">What was great:</span> {review.personalNote}
                      </p>
                    </div>
                  )}
                  
                  {review.negativeNote && (
                    <div className="mt-2 p-2 bg-red-50 border-l-4 border-red-400 rounded">
                      <p className="text-sm text-red-800">
                        <span className="font-medium">What could be better:</span> {review.negativeNote}
                      </p>
                    </div>
                  )}
                  
                  {review.images && review.images.length > 0 && (
                    <div className="flex mt-3 space-x-2">
                      {review.images.slice(0, 3).map((image, i) => (
                        <img 
                          key={i} 
                          src={image} 
                          alt="Review" 
                          className="w-16 h-16 rounded-md object-cover" 
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-8">
              <p className="text-dark-gray mb-4">No reviews yet. Be the first to share your experience!</p>
              <button 
                onClick={() => navigate('/create', { state: { selectedRestaurant: restaurant } })}
                className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-primary/90 transition-colors"
              >
                Write First Review
              </button>
            </div>
          )}
        </div>
        {reviews.length > 3 && (
          <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
            View All Reviews ({reviews.length})
          </button>
        )}
      </div>
      <BottomNavigation />
    </div>;
};
export default RestaurantDetail;