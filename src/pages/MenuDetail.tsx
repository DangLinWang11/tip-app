import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeftIcon, StarIcon, MapPinIcon, BookmarkIcon, ShareIcon, ChefHatIcon } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price?: number;
  description?: string;
  restaurantId: string;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  cuisine: string;
  phone: string;
  coordinates: { latitude: number; longitude: number };
}

interface Review {
  id: string;
  userId: string;
  restaurantId: string;
  menuItemId: string;
  dish: string;
  rating: number;
  personalNote: string;
  negativeNote: string;
  images: string[];
  createdAt: string;
  location: string;
}

const MenuDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menuItem, setMenuItem] = useState<MenuItem | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [otherDishes, setOtherDishes] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Calculate average rating from reviews
  const calculateAverageRating = (reviewsArray: Review[]) => {
    if (reviewsArray.length === 0) return 0;
    const sum = reviewsArray.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviewsArray.length;
  };

  // Get all images from reviews
  const getAllReviewImages = (reviewsArray: Review[]) => {
    return reviewsArray.flatMap(review => review.images || []);
  };

  const averageRating = calculateAverageRating(reviews);
  const reviewImages = getAllReviewImages(reviews);

  useEffect(() => {
    const fetchDishData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        // Fetch menu item
        const menuItemDoc = await getDoc(doc(db, 'menuItems', id));
        if (menuItemDoc.exists()) {
          const menuData = { id: menuItemDoc.id, ...menuItemDoc.data() } as MenuItem;
          setMenuItem(menuData);
          
          // Fetch restaurant data
          if (menuData.restaurantId) {
            const restaurantDoc = await getDoc(doc(db, 'restaurants', menuData.restaurantId));
            if (restaurantDoc.exists()) {
              setRestaurant({ id: restaurantDoc.id, ...restaurantDoc.data() } as Restaurant);
            }
            
            // Fetch other dishes from the same restaurant
            const otherDishesQuery = query(
              collection(db, 'menuItems'), 
              where('restaurantId', '==', menuData.restaurantId)
            );
            const otherDishesSnapshot = await getDocs(otherDishesQuery);
            const otherDishesData = otherDishesSnapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))
              .filter(item => item.id !== id) // Exclude current dish
              .slice(0, 6); // Limit to 6 items
            setOtherDishes(otherDishesData);
          }
        }
        
        // Fetch reviews for this specific dish
        const reviewsQuery = query(
          collection(db, 'reviews'), 
          where('menuItemId', '==', id)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsData = reviewsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Review));
        setReviews(reviewsData);
        
      } catch (error) {
        console.error('Error fetching dish data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDishData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center pb-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-dark-gray">Loading dish details...</p>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  if (!menuItem) {
    return (
      <div className="min-h-screen bg-light-gray flex items-center justify-center pb-16">
        <div className="text-center">
          <p className="text-lg font-medium text-dark-gray mb-4">Dish not found</p>
          <Link to="/discover" className="text-primary hover:underline">Back to Discover</Link>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-gray pb-16">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate(-1)} className="mr-3">
              <ArrowLeftIcon size={24} />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{menuItem.name}</h1>
              {restaurant && (
                <p className="text-sm text-dark-gray">at {restaurant.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setSaved(!saved)}>
              <BookmarkIcon size={24} className={saved ? 'text-primary fill-primary' : 'text-dark-gray'} />
            </button>
            <button>
              <ShareIcon size={24} className="text-dark-gray" />
            </button>
          </div>
        </div>
      </header>

      {/* Dish Hero Section */}
      <div className="bg-white shadow-sm">
        <div className="relative h-64">
          <img 
            src={reviewImages.length > 0 ? reviewImages[0] : `https://source.unsplash.com/800x400/?${encodeURIComponent(menuItem.name)},food`}
            alt={menuItem.name} 
            className="w-full h-full object-cover" 
          />
          {reviewImages.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              +{reviewImages.length - 1} more photos
            </div>
          )}
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-2xl font-semibold">{menuItem.name}</h2>
              <p className="text-dark-gray mt-1">{menuItem.category}</p>
              {menuItem.description && (
                <p className="text-dark-gray text-sm mt-2">{menuItem.description}</p>
              )}
            </div>
            <div className="text-right">
              {menuItem.price && (
                <p className="text-2xl font-bold text-primary">${menuItem.price}</p>
              )}
              {averageRating > 0 && (
                <div className="flex items-center mt-1">
                  <StarIcon size={16} className="text-accent mr-1" />
                  <span className="font-medium">{averageRating.toFixed(1)}</span>
                  <span className="text-sm text-dark-gray ml-1">({reviews.length})</span>
                </div>
              )}
            </div>
          </div>

          {/* Restaurant Info */}
          {restaurant && (
            <div className="bg-light-gray rounded-lg p-3 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPinIcon size={16} className="text-dark-gray mr-2" />
                  <div>
                    <Link 
                      to={`/restaurant/${restaurant.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {restaurant.name}
                    </Link>
                    <p className="text-sm text-dark-gray">{restaurant.cuisine}</p>
                  </div>
                </div>
                <Link 
                  to={`/restaurant/${restaurant.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  View Restaurant →
                </Link>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex mt-4 space-x-3">
            <button 
              onClick={() => navigate('/create', { 
                state: { 
                  selectedRestaurant: restaurant,
                  selectedDish: menuItem.name
                } 
              })}
              className="flex-1 bg-primary text-white py-3 rounded-full font-medium"
            >
              Write Review
            </button>
            <button className="px-6 py-3 border border-medium-gray rounded-full font-medium">
              Add to List
            </button>
          </div>
        </div>
      </div>

      {/* Photos Section */}
      {reviewImages.length > 0 && (
        <div className="bg-white mt-2 p-4 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Photos ({reviewImages.length})</h3>
          <div className="grid grid-cols-3 gap-1">
            {reviewImages.slice(0, 6).map((image, index) => (
              <div key={index} className="aspect-square bg-medium-gray rounded-md overflow-hidden">
                <img 
                  src={image} 
                  alt="Dish photo" 
                  className="w-full h-full object-cover" 
                />
              </div>
            ))}
          </div>
          {reviewImages.length > 6 && (
            <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
              View All Photos ({reviewImages.length})
            </button>
          )}
        </div>
      )}

      {/* Reviews Section */}
      <div className="bg-white mt-2 p-4 shadow-sm">
        <h3 className="font-semibold text-lg mb-4">Reviews ({reviews.length})</h3>
        <div className="space-y-4">
          {reviews.length > 0 ? reviews.slice(0, 5).map((review, index) => (
            <div key={review.id} className="border-b border-light-gray pb-4 last:border-0">
              <div className="flex items-start">
                <img 
                  src={`https://randomuser.me/api/portraits/${index % 2 === 0 ? 'women' : 'men'}/${30 + index}.jpg`} 
                  alt="User" 
                  className="w-10 h-10 rounded-full" 
                />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-start mb-2">
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
                      <span className="text-sm text-dark-gray ml-2">
                        {review.rating}/10
                      </span>
                    </div>
                    <span className="text-xs text-dark-gray">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {review.personalNote && (
                    <div className="mt-2 p-3 bg-green-50 border-l-4 border-green-400 rounded">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">What was great:</span> {review.personalNote}
                      </p>
                    </div>
                  )}
                  
                  {review.negativeNote && (
                    <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-400 rounded">
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
              <p className="text-dark-gray mb-4">No reviews yet. Be the first to review this dish!</p>
              <button 
                onClick={() => navigate('/create', { 
                  state: { 
                    selectedRestaurant: restaurant,
                    selectedDish: menuItem.name
                  } 
                })}
                className="bg-primary text-white px-6 py-2 rounded-full font-medium hover:bg-primary/90 transition-colors"
              >
                Write First Review
              </button>
            </div>
          )}
        </div>
        {reviews.length > 5 && (
          <button className="w-full mt-4 py-2 border border-medium-gray rounded-full text-center font-medium">
            View All Reviews ({reviews.length})
          </button>
        )}
      </div>

      {/* Other Dishes Section */}
      {restaurant && otherDishes.length > 0 && (
        <div className="bg-white mt-2 p-4 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg">Other dishes at {restaurant.name}</h3>
            <Link 
              to={`/restaurant/${restaurant.id}`}
              className="text-sm text-primary hover:underline"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {otherDishes.map(dish => (
              <Link 
                key={dish.id}
                to={`/dish/${dish.id}`}
                className="bg-light-gray rounded-lg p-3 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center mb-2">
                  <ChefHatIcon size={16} className="text-dark-gray mr-2" />
                  <span className="text-xs text-dark-gray">{dish.category}</span>
                </div>
                <h4 className="font-medium text-sm mb-1">{dish.name}</h4>
                {dish.price && (
                  <p className="text-primary font-medium text-sm">${dish.price}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
};

export default MenuDetail;