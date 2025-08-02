import React, { useState, useEffect } from 'react';
import { CameraIcon, ImageIcon, XIcon, CheckIcon, EditIcon, PlusIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RatingSlider from '../components/RatingSlider';
import ImageGrid from '../components/ImageGrid';
import RestaurantSearch from '../components/RestaurantSearch';
import DishSearch from '../components/DishSearch';
import { saveReview, processAndUploadImages, ReviewData } from '../services/reviewService';
import { getCurrentUser } from '../lib/firebase';

// Interface for review summaries
interface ReviewSummary {
  id: string;
  dish: string;
  rating: number;
  personalNote: string;
  negativeNote: string;
  serverRating: 'bad' | 'okay' | 'good' | null;
  price: string;
  currency: string;
  tags: string[];
  images: string[];
  imageFiles: File[];
  selectedMenuItem: any;
}

const Create: React.FC = () => {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Multi-review state
  const [reviewSummaries, setReviewSummaries] = useState<ReviewSummary[]>([]);
  const [currentVisitId, setCurrentVisitId] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Current form state
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [dishName, setDishName] = useState('');
  const [selectedMenuItem, setSelectedMenuItem] = useState<any>(null);
  const [rating, setRating] = useState(7.5);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [review, setReview] = useState({
    positive: '',
    negative: ''
  });
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [serverRating, setServerRating] = useState<'bad' | 'okay' | 'good' | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  // Generate visitId on component mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid || 'anonymous';
    const timestamp = Date.now();
    setCurrentVisitId(`visit_${userId}_${timestamp}`);
  }, []);

  // Reset form fields (except restaurant)
  const resetForm = () => {
    setImages([]);
    setImageFiles([]);
    setDishName('');
    setSelectedMenuItem(null);
    setRating(7.5);
    setPrice('');
    setCurrency('USD');
    setReview({ positive: '', negative: '' });
    setTags([]);
    setCurrentTag('');
    setServerRating(null);
    setEditingIndex(null);
  };

  // Load review data for editing
  const loadReviewForEdit = (reviewSummary: ReviewSummary) => {
    setDishName(reviewSummary.dish);
    setSelectedMenuItem(reviewSummary.selectedMenuItem);
    setRating(reviewSummary.rating);
    setPrice(reviewSummary.price);
    setCurrency(reviewSummary.currency);
    setReview({
      positive: reviewSummary.personalNote,
      negative: reviewSummary.negativeNote
    });
    setTags(reviewSummary.tags);
    setServerRating(reviewSummary.serverRating);
    setImages(reviewSummary.images);
    setImageFiles(reviewSummary.imageFiles);
  };

  // Add current review to summaries
  const addReviewToSummary = () => {
    if (!selectedRestaurant || !dishName.trim() || !review.positive.trim() || !review.negative.trim()) {
      alert('Please fill in all required fields before adding another item');
      return;
    }

    const newReview: ReviewSummary = {
      id: `review_${Date.now()}`,
      dish: dishName,
      rating,
      personalNote: review.positive,
      negativeNote: review.negative,
      serverRating,
      price,
      currency,
      tags: [...tags],
      images: [...images],
      imageFiles: [...imageFiles],
      selectedMenuItem
    };

    if (editingIndex !== null) {
      // Update existing review
      const updatedSummaries = [...reviewSummaries];
      updatedSummaries[editingIndex] = newReview;
      setReviewSummaries(updatedSummaries);
    } else {
      // Add new review
      setReviewSummaries(prev => [...prev, newReview]);
    }

    resetForm();
  };

  // Edit existing review
  const editReview = (index: number) => {
    setEditingIndex(index);
    loadReviewForEdit(reviewSummaries[index]);
  };

  // Remove review from summaries
  const removeReview = (index: number) => {
    setReviewSummaries(prev => prev.filter((_, i) => i !== index));
  };

  // Save all reviews to Firebase
  const saveAllReviewsToFirebase = async () => {
    try {
      const allReviews = [...reviewSummaries];
      
      // Add current form data if valid
      if (selectedRestaurant && dishName.trim() && review.positive.trim() && review.negative.trim()) {
        const currentReview: ReviewSummary = {
          id: `review_${Date.now()}`,
          dish: dishName,
          rating,
          personalNote: review.positive,
          negativeNote: review.negative,
          serverRating,
          price,
          currency,
          tags: [...tags],
          images: [...images],
          imageFiles: [...imageFiles],
          selectedMenuItem
        };
        
        if (editingIndex !== null) {
          allReviews[editingIndex] = currentReview;
        } else {
          allReviews.push(currentReview);
        }
      }

      // Save each review with shared visitId
      const reviewIds = [];
      for (const reviewSummary of allReviews) {
        // Upload images for this review
        let uploadedImageUrls: string[] = [];
        if (reviewSummary.imageFiles.length > 0) {
          uploadedImageUrls = await processAndUploadImages(reviewSummary.imageFiles);
        }

        // Create review data object
        const reviewData: ReviewData = {
          visitId: currentVisitId, // Shared visit ID
          restaurantId: selectedRestaurant?.id || null,
          menuItemId: reviewSummary.selectedMenuItem?.id || null,
          restaurant: selectedRestaurant?.name || 'Unknown Restaurant',
          location: selectedRestaurant?.cuisine || 'Unknown Location',
          dish: reviewSummary.dish,
          rating: reviewSummary.rating,
          personalNote: reviewSummary.personalNote,
          negativeNote: reviewSummary.negativeNote,
          serverRating: reviewSummary.serverRating,
          price: reviewSummary.price ? `${reviewSummary.currency} ${reviewSummary.price}` : null,
          tags: reviewSummary.tags,
          images: uploadedImageUrls,
          isPublic: isPublic
        };

        const reviewId = await saveReview(reviewData, selectedRestaurant, reviewSummary.selectedMenuItem);

        reviewIds.push(reviewId);
      }

      console.log('All reviews saved to Firebase:', reviewIds);
      return reviewIds;
    } catch (error) {
      console.error('Error saving reviews to Firebase:', error);
      throw error;
    }
  };

  // Handle final submission
  const handleSubmitAllReviews = async () => {
    // Validate at least one review exists
    const hasCurrentReview = selectedRestaurant && dishName.trim() && review.positive.trim() && review.negative.trim();
    
    if (reviewSummaries.length === 0 && !hasCurrentReview) {
      alert('Please add at least one review before submitting');
      return;
    }

    if (!selectedRestaurant) {
      alert('Please select a restaurant');
      return;
    }

    setIsPosting(true);
    
    try {
      await saveAllReviewsToFirebase();
      setIsPosting(false);
      setShowSuccess(true);
      
      // Auto-redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      setIsPosting(false);
      console.error('Failed to save reviews:', error);
      alert('Failed to save reviews. Please try again.');
    }
  };

  // Handle photo upload
  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        const newImageUrls = files.map(file => URL.createObjectURL(file));
        setImages(prev => [...prev, ...newImageUrls].slice(0, 4));
        setImageFiles(prev => [...prev, ...files].slice(0, 4));
      }
    };
    input.click();
  };

  const handleRemovePhoto = (index: number) => {
    URL.revokeObjectURL(images[index]);
    setImages(images.filter((_, i) => i !== index));
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleDishSelect = (menuItem: any) => {
    setSelectedMenuItem(menuItem);
    setDishName(menuItem.name);
    if (menuItem.price) {
      setPrice(menuItem.price.toString());
    }
  };

  const handleAddNewDish = (dishName: string, newMenuItem: any) => {
    setSelectedMenuItem(newMenuItem);
    setDishName(dishName);
  };

  const handleRestaurantSelect = (restaurant: any) => {
    setSelectedRestaurant(restaurant);
    setSelectedMenuItem(null);
    setDishName('');
  };

  const isCurrentFormValid = selectedRestaurant && dishName.trim() && review.positive.trim() && review.negative.trim();
  const canSubmit = reviewSummaries.length > 0 || isCurrentFormValid;

  const getServerEmoji = (type: string) => {
    switch (type) {
      case 'bad': return '😔';
      case 'okay': return '😐';
      case 'good': return '😊';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {showSuccess ? (
        <div className="flex flex-col items-center justify-center h-screen px-4">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
            <CheckIcon size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">
            {reviewSummaries.length + (isCurrentFormValid ? 1 : 0)} Reviews Saved!
          </h1>
          <p className="text-gray-600 text-center mb-6">
            Your restaurant visit has been saved to Firebase!
          </p>
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400 mt-4">Redirecting to your food map...</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="p-4 flex justify-between items-center bg-white sticky top-0 z-10 border-b border-gray-200">
            <button onClick={() => navigate('/')}>
              <XIcon size={24} />
            </button>
            <h1 className="font-medium">
              {reviewSummaries.length > 0 ? `${reviewSummaries.length + 1} Reviews` : 'New Review'}
            </h1>
            <button 
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                canSubmit && !isPosting
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!canSubmit || isPosting}
              onClick={handleSubmitAllReviews}
            >
              {isPosting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                `Upload ${reviewSummaries.length > 0 ? 'All' : ''} Review${reviewSummaries.length > 0 ? 's' : ''}`
              )}
            </button>
          </header>

          {/* Main Content */}
          <div className="pb-20">
            <div className="p-4 space-y-6">
              
              {/* Review Summaries */}
              {reviewSummaries.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Reviews Added ({reviewSummaries.length})
                  </h3>
                  {reviewSummaries.map((reviewSummary, index) => (
                    <div key={reviewSummary.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-sm">{reviewSummary.rating}</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{reviewSummary.dish}</h4>
                            <p className="text-sm text-gray-500">
                              {reviewSummary.personalNote.substring(0, 50)}...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => editReview(index)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"
                          >
                            <EditIcon size={16} />
                          </button>
                          <button
                            onClick={() => removeReview(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-full"
                          >
                            <XIcon size={16} />
                          </button>
                        </div>
                      </div>
                      {reviewSummary.images.length > 0 && (
                        <div className="flex space-x-2 mt-2">
                          {reviewSummary.images.slice(0, 3).map((image, imgIndex) => (
                            <img
                              key={imgIndex}
                              src={image}
                              alt="Review"
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ))}
                          {reviewSummary.images.length > 3 && (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                              <span className="text-xs text-gray-500">+{reviewSummary.images.length - 3}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Current Review Form */}
              <div className={reviewSummaries.length > 0 ? 'border-t border-gray-200 pt-6' : ''}>
                {reviewSummaries.length > 0 && (
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {editingIndex !== null ? 'Edit Review' : 'Add Another Item'}
                  </h3>
                )}
                
                {/* Photos Section */}
                <div>
                  <label className="block text-sm font-medium mb-2">Photos (Optional)</label>
                  {images.length > 0 ? (
                    <ImageGrid images={images} onRemove={handleRemovePhoto} onAdd={handleAddPhoto} maxImages={4} />
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                      <CameraIcon size={48} className="mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-500 mb-4">Add photos of your dish</p>
                      <div className="flex justify-center space-x-4">
                        <button 
                          className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200"
                          onClick={handleAddPhoto}
                        >
                          <ImageIcon size={20} />
                          <span>Gallery</span>
                        </button>
                        <button 
                          className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200"
                          onClick={handleAddPhoto}
                        >
                          <CameraIcon size={20} />
                          <span>Camera</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Restaurant Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-red-500">
                    Restaurant *
                  </label>
                  <RestaurantSearch 
                    onSelect={handleRestaurantSelect}
                    disabled={reviewSummaries.length > 0} // Lock restaurant after first review
                  />
                  {selectedRestaurant && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <p className="font-medium text-green-800">{selectedRestaurant.name}</p>
                      <p className="text-sm text-green-600">{selectedRestaurant.cuisine}</p>
                    </div>
                  )}
                </div>

                {/* Dish Name */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-red-500">
                    Dish Name *
                  </label>
                  <DishSearch 
                    restaurantId={selectedRestaurant?.id || null}
                    onSelect={handleDishSelect}
                    onAddNew={handleAddNewDish}
                    disabled={!selectedRestaurant}
                  />
                  {selectedMenuItem && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-800">{selectedMenuItem.name}</p>
                          <p className="text-sm text-blue-600">{selectedMenuItem.category}</p>
                        </div>
                        {selectedMenuItem.price && (
                          <span className="text-sm font-medium text-blue-700">${selectedMenuItem.price}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium mb-2">Dish Rating</label>
                  <RatingSlider value={rating} onChange={setRating} />
                  <p className="text-center mt-3 text-2xl font-bold text-red-500">{rating.toFixed(1)}/10</p>
                </div>

                {/* Dual Review System */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-green-600">
                      ✅ What did you LOVE about this dish? *
                    </label>
                    <textarea 
                      placeholder="Tell us what made this dish amazing..."
                      value={review.positive}
                      onChange={(e) => setReview({ ...review, positive: e.target.value })}
                      className="w-full border border-green-300 rounded-xl p-3 h-20 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-red-600">
                      ❌ What could be improved? *
                    </label>
                    <textarea 
                      placeholder="What wasn't perfect about this dish?"
                      value={review.negative}
                      onChange={(e) => setReview({ ...review, negative: e.target.value })}
                      className="w-full border border-red-300 rounded-xl p-3 h-20 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* Server Rating */}
                <div>
                  <label className="block text-sm font-medium mb-2">Server Rating (Optional)</label>
                  <div className="flex justify-center space-x-6">
                    {[
                      { type: 'bad', emoji: '😔', label: 'Poor' },
                      { type: 'okay', emoji: '😐', label: 'Okay' },
                      { type: 'good', emoji: '😊', label: 'Great' }
                    ].map(({ type, emoji, label }) => (
                      <button
                        key={type}
                        onClick={() => setServerRating(serverRating === type ? null : type as any)}
                        className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                          serverRating === type 
                            ? 'bg-blue-100 ring-2 ring-blue-500' 
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <span className="text-3xl mb-1">{emoji}</span>
                        <span className="text-xs text-gray-600">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium mb-2">Price (Optional)</label>
                  <div className="flex">
                    <select 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="border border-r-0 border-gray-300 rounded-l-xl px-3 bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">$</option>
                      <option value="EUR">€</option>
                      <option value="GBP">£</option>
                    </select>
                    <input 
                      type="number" 
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      className="flex-1 border border-gray-300 rounded-r-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2">Tags (Optional)</label>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {tags.map((tag, index) => (
                        <div key={index} className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 flex items-center">
                          <span className="text-sm">#{tag}</span>
                          <button 
                            className="ml-2 text-blue-600 hover:text-blue-800"
                            onClick={() => setTags(tags.filter((_, i) => i !== index))}
                          >
                            <XIcon size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex">
                    <input 
                      type="text" 
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Add tags (e.g. pasta, spicy, vegetarian)"
                      className="flex-1 border border-gray-300 rounded-l-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button 
                      onClick={handleAddTag}
                      className="bg-blue-500 text-white px-4 rounded-r-xl hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Add Another Item Button */}
                {(reviewSummaries.length < 5 || editingIndex !== null) && (
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={addReviewToSummary}
                      disabled={!isCurrentFormValid}
                      className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center space-x-2 ${
                        isCurrentFormValid
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <PlusIcon size={20} />
                      <span>
                        {editingIndex !== null ? 'Update Review' : 'Add Another Item'}
                      </span>
                    </button>
                    {reviewSummaries.length >= 5 && editingIndex === null && (
                      <p className="text-center text-sm text-gray-500 mt-2">
                        Maximum 5 items per visit
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Create;