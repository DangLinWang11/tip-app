import React, { useState } from 'react';
import { CameraIcon, ImageIcon, XIcon, CheckIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RatingSlider from '../components/RatingSlider';
import ImageGrid from '../components/ImageGrid';
import RestaurantSearch from '../components/RestaurantSearch';
import { saveReview, processAndUploadImages, ReviewData } from '../services/reviewService';

const Create: React.FC = () => {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [dishName, setDishName] = useState('');
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

  // Handle photo upload
  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        // Create preview URLs
        const newImageUrls = files.map(file => URL.createObjectURL(file));
        setImages(prev => [...prev, ...newImageUrls].slice(0, 4)); // Max 4 images
        setImageFiles(prev => [...prev, ...files].slice(0, 4));
      }
    };
    input.click();
  };

  const handleRemovePhoto = (index: number) => {
    // Revoke the object URL to free memory
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

  const saveReviewToFirebase = async () => {
    try {
      // Upload images to Firebase Storage if any
      let uploadedImageUrls: string[] = [];
      if (imageFiles.length > 0) {
        uploadedImageUrls = await processAndUploadImages(imageFiles);
      }

      // Create review data object
      const reviewData: ReviewData = {
        restaurant: selectedRestaurant?.name || 'Unknown Restaurant',
        location: selectedRestaurant?.cuisine || 'Unknown Location',
        dish: dishName,
        rating: rating,
        personalNote: review.positive,
        negativeNote: review.negative,
        serverRating: serverRating,
        price: price ? `${currency} ${price}` : null,
        tags: tags,
        images: uploadedImageUrls,
        isPublic: isPublic
      };

      // Save review to Firestore
      const reviewId = await saveReview(reviewData);
      
      console.log('Review saved to Firebase with ID:', reviewId);
      return reviewId;
    } catch (error) {
      console.error('Error saving review to Firebase:', error);
      throw error;
    }
  };

  const handlePost = async () => {
    // Validate required fields
    if (!selectedRestaurant || !dishName.trim() || !review.positive.trim() || !review.negative.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsPosting(true);
    
    try {
      // Save review to Firebase
      await saveReviewToFirebase();
      setIsPosting(false);
      setShowSuccess(true);
      
      // Auto-redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      setIsPosting(false);
      console.error('Failed to save review:', error);
      alert('Failed to save review. Please try again.');
    }
  };

  const isFormValid = selectedRestaurant && dishName.trim() && review.positive.trim() && review.negative.trim();

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
          <h1 className="text-2xl font-bold text-center mb-4">Review Saved!</h1>
          <p className="text-gray-600 text-center mb-6">
            Your review has been saved to Firebase!
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
            <h1 className="font-medium">New Review</h1>
            <button 
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                isFormValid && !isPosting
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              disabled={!isFormValid || isPosting}
              onClick={handlePost}
            >
              {isPosting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                'Save Review'
              )}
            </button>
          </header>

          {/* Main Content */}
          <div className="pb-20">
            <div className="p-4 space-y-6">
              
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
                <RestaurantSearch onSelect={setSelectedRestaurant} />
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
                <input 
                  type="text" 
                  value={dishName} 
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="What did you eat?"
                  className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
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

              {/* Privacy Toggle - Hidden for MVP */}
              <div style={{ display: 'none' }}>
                <label className="block text-sm font-medium mb-2">Privacy</label>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <span className="font-medium">Make this review public</span>
                    <p className="text-sm text-gray-600 mt-1">
                      {isPublic ? 'Visible to all users' : 'Only visible to you'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsPublic(!isPublic)}
                    className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
                      isPublic ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-200 ${
                      isPublic ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Create;