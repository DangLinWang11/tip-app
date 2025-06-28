import React, { useState } from 'react';
import { CameraIcon, ImageIcon, XIcon } from 'lucide-react';
import RatingSlider from '../components/RatingSlider';
import ImageGrid from '../components/ImageGrid';
import RestaurantSearch from '../components/RestaurantSearch';
const Create: React.FC = () => {
  const [step, setStep] = useState<'capture' | 'review'>('capture');
  const [images, setImages] = useState<string[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
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
  // Simulate photo upload
  const handleAddPhoto = () => {
    const mockImage = `https://source.unsplash.com/collection/1353633/500x500?random=${images.length}`;
    setImages([...images, mockImage]);
  };
  const handleRemovePhoto = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };
  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };
  return <div className="min-h-screen bg-white pb-16">
      {step === 'capture' ? <div className="flex flex-col h-screen">
          <header className="p-4 flex justify-between items-center bg-white sticky top-0 z-10">
            <button onClick={() => setStep('capture')}>
              <XIcon size={24} />
            </button>
            <h1 className="font-medium">New Post</h1>
            <button className="text-primary font-medium disabled:opacity-50" disabled={images.length === 0} onClick={() => setStep('review')}>
              Next
            </button>
          </header>
          <div className="flex-1 bg-black flex items-center justify-center p-4">
            {images.length > 0 ? <ImageGrid images={images} onRemove={handleRemovePhoto} onAdd={handleAddPhoto} maxImages={4} /> : <div className="text-center text-white">
                <div className="mb-4">
                  <CameraIcon size={64} className="mx-auto" />
                </div>
                <p className="mb-8">Take a photo of your dish</p>
                <div className="flex justify-center space-x-8">
                  <button className="flex flex-col items-center" onClick={handleAddPhoto}>
                    <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center mb-2">
                      <ImageIcon size={24} className="text-white" />
                    </div>
                    <span className="text-sm">Gallery</span>
                  </button>
                  <button className="flex flex-col items-center" onClick={handleAddPhoto}>
                    <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center mb-2"></div>
                    <span className="text-sm">Photo</span>
                  </button>
                  <button className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center mb-2">
                      <span className="text-white font-medium">60s</span>
                    </div>
                    <span className="text-sm">Video</span>
                  </button>
                </div>
              </div>}
          </div>
        </div> : <div className="h-screen overflow-y-auto">
          <header className="p-4 flex justify-between items-center sticky top-0 bg-white z-10 border-b border-light-gray">
            <button onClick={() => setStep('capture')}>
              <XIcon size={24} />
            </button>
            <h1 className="font-medium">Review</h1>
            <button className="px-4 py-1 bg-primary text-white rounded-full font-medium">
              Post
            </button>
          </header>
          <div className="p-4 space-y-6">
            {/* Photo Grid */}
            <ImageGrid images={images} onRemove={handleRemovePhoto} onAdd={handleAddPhoto} maxImages={4} />
            {/* Restaurant Search */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Restaurant
              </label>
              <RestaurantSearch onSelect={setSelectedRestaurant} />
            </div>
            {/* Dish Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Dish Name
              </label>
              <input type="text" value={dishName} onChange={e => setDishName(e.target.value)} placeholder="What did you eat?" className="w-full border border-medium-gray rounded-xl p-3" />
            </div>
            {/* Rating */}
            <div>
              <label className="block text-sm font-medium mb-2">Rating</label>
              <RatingSlider value={rating} onChange={setRating} />
            </div>
            {/* Review */}
            <div>
              <label className="block text-sm font-medium mb-2">Review</label>
              <div className="space-y-3">
                <textarea placeholder="What did you like about this dish?" value={review.positive} onChange={e => setReview({
              ...review,
              positive: e.target.value
            })} className="w-full border border-medium-gray rounded-xl p-3 h-24" />
                <textarea placeholder="What could be improved?" value={review.negative} onChange={e => setReview({
              ...review,
              negative: e.target.value
            })} className="w-full border border-medium-gray rounded-xl p-3 h-24" />
              </div>
            </div>
            {/* Price */}
            <div>
              <label className="block text-sm font-medium mb-2">Price</label>
              <div className="flex">
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="border border-r-0 border-medium-gray rounded-l-xl px-3">
                  <option value="USD">$</option>
                  <option value="EUR">€</option>
                  <option value="GBP">£</option>
                </select>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" className="flex-1 border border-medium-gray rounded-r-xl p-3" />
              </div>
            </div>
            {/* Tags */}
            <div>
              <label className="block text-sm font-medium mb-2">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => <div key={index} className="bg-light-gray rounded-full px-3 py-1 flex items-center">
                    <span className="text-sm">#{tag}</span>
                    <button className="ml-1 text-dark-gray" onClick={() => setTags(tags.filter((_, i) => i !== index))}>
                      <XIcon size={16} />
                    </button>
                  </div>)}
              </div>
              <div className="flex">
                <input type="text" value={currentTag} onChange={e => setCurrentTag(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }} placeholder="Add tags (e.g. pasta, spicy)" className="flex-1 border border-medium-gray rounded-l-xl p-3" />
                <button onClick={handleAddTag} className="bg-secondary text-white px-4 rounded-r-xl">
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>}
    </div>;
};
export default Create;