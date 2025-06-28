import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartIcon, MessageCircleIcon, BookmarkIcon, ShareIcon, StarIcon, MapPinIcon } from 'lucide-react';
interface Post {
  id: number;
  dish: string;
  rating: number;
  image: string;
  likes: number;
  comments: number;
  price: string;
  description: string;
  tags: string[];
}
interface RestaurantPostProps {
  id: number;
  name: string;
  cuisine: string;
  rating: number;
  qualityPercentage: number;
  distance: string;
  priceRange: string;
  coverImage: string;
  posts: Post[];
}
const RestaurantPost: React.FC<RestaurantPostProps> = ({
  id,
  name,
  cuisine,
  rating,
  qualityPercentage,
  distance,
  priceRange,
  coverImage,
  posts
}) => {
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const currentPost = posts[currentPostIndex];
  const handleLike = () => {
    setLiked(!liked);
  };
  const handleSave = () => {
    setSaved(!saved);
  };
  const handleNextPost = () => {
    setCurrentPostIndex(prev => (prev + 1) % posts.length);
  };
  const handlePrevPost = () => {
    setCurrentPostIndex(prev => prev === 0 ? posts.length - 1 : prev - 1);
  };
  return <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-6">
      <div className="relative">
        <img src={currentPost.image} alt={currentPost.dish} className="w-full h-96 object-cover" />
        {/* Post navigation dots */}
        {posts.length > 1 && <div className="absolute top-4 left-0 right-0 flex justify-center">
            <div className="bg-black bg-opacity-50 rounded-full px-3 py-1 flex space-x-1">
              {posts.map((_, index) => <div key={index} className={`w-2 h-2 rounded-full ${index === currentPostIndex ? 'bg-white' : 'bg-gray-400'}`} onClick={() => setCurrentPostIndex(index)} />)}
            </div>
          </div>}
        {/* Restaurant quality indicator */}
        <div className="absolute top-4 left-4 bg-white rounded-full px-3 py-1 flex items-center">
          <div className={`w-3 h-3 rounded-full ${qualityPercentage >= 90 ? 'bg-green-500' : qualityPercentage >= 75 ? 'bg-accent' : 'bg-primary'} mr-2`}></div>
          <span className="font-medium text-sm">
            {qualityPercentage}% Quality
          </span>
        </div>
        {/* Price tag */}
        <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1">
          <span className="font-medium text-sm">{currentPost.price}</span>
        </div>
        {/* Dish rating */}
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 rounded-full px-3 py-1 flex items-center">
          <StarIcon size={16} className="text-accent mr-1" />
          <span className="text-white font-medium">{currentPost.rating}</span>
        </div>
        {/* Left/Right navigation for multiple posts */}
        {posts.length > 1 && <>
            <button onClick={handlePrevPost} className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button onClick={handleNextPost} className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 rounded-full p-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </>}
      </div>
      <div className="p-4">
        {/* Restaurant info */}
        <Link to={`/restaurant/${id}`}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">{name}</h2>
            <div className="flex items-center">
              <StarIcon size={16} className="text-accent mr-1" />
              <span className="font-medium">{rating}</span>
            </div>
          </div>
          <div className="flex items-center text-dark-gray mb-4">
            <span className="mr-2">{cuisine}</span>
            <span>•</span>
            <span className="mx-2">{priceRange}</span>
            <span>•</span>
            <div className="flex items-center ml-2">
              <MapPinIcon size={14} className="mr-1" />
              <span>{distance}</span>
            </div>
          </div>
        </Link>
        {/* Dish name and description */}
        <h3 className="font-medium mb-1">{currentPost.dish}</h3>
        <p className="text-dark-gray text-sm mb-3">{currentPost.description}</p>
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {currentPost.tags.map((tag, index) => <span key={index} className="bg-light-gray px-2 py-1 rounded-full text-xs">
              #{tag}
            </span>)}
        </div>
        {/* Action buttons */}
        <div className="flex justify-between items-center border-t border-light-gray pt-3">
          <div className="flex items-center space-x-4">
            <button onClick={handleLike} className="flex items-center">
              <HeartIcon size={22} className={liked ? 'text-primary fill-primary' : 'text-dark-gray'} />
              <span className="ml-1 text-sm">
                {liked ? currentPost.likes + 1 : currentPost.likes}
              </span>
            </button>
            <button className="flex items-center">
              <MessageCircleIcon size={22} className="text-dark-gray" />
              <span className="ml-1 text-sm">{currentPost.comments}</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={handleSave}>
              <BookmarkIcon size={22} className={saved ? 'text-secondary fill-secondary' : 'text-dark-gray'} />
            </button>
            <button>
              <ShareIcon size={22} className="text-dark-gray" />
            </button>
          </div>
        </div>
      </div>
    </div>;
};
export default RestaurantPost;