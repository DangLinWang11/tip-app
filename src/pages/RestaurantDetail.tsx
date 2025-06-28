import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { restaurants } from '../utils/mockData';
import { ArrowLeftIcon, StarIcon, MapPinIcon, PhoneIcon, ClockIcon, BookmarkIcon, ShareIcon, ChevronRightIcon } from 'lucide-react';
const RestaurantDetail: React.FC = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const restaurant = restaurants.find(r => r.id === Number(id)) || restaurants[0];
  const [saved, setSaved] = useState(false);
  return <div className="min-h-screen bg-light-gray">
      <div className="relative h-64">
        <img src={restaurant.coverImage} alt={restaurant.name} className="w-full h-full object-cover" />
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4">
          <Link to="/" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <ArrowLeftIcon size={20} />
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="bg-white px-3 py-1 rounded-full inline-flex items-center">
            <div className={`w-3 h-3 rounded-full ${restaurant.qualityPercentage >= 90 ? 'bg-green-500' : restaurant.qualityPercentage >= 75 ? 'bg-accent' : 'bg-primary'} mr-2`}></div>
            <span className="font-medium text-sm">
              {restaurant.qualityPercentage}% Quality
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
              <span>{restaurant.priceRange}</span>
              <span className="mx-1">•</span>
              <div className="flex items-center">
                <MapPinIcon size={14} className="mr-1" />
                <span>{restaurant.distance}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="mr-2 flex items-center bg-light-gray px-3 py-1 rounded-full">
              <StarIcon size={16} className="text-accent mr-1" />
              <span className="font-medium">{restaurant.rating}</span>
            </div>
          </div>
        </div>
        <div className="flex mt-4 space-x-3">
          <button className="flex-1 bg-primary text-white py-2 rounded-full font-medium">
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
              <p>123 Main Street, New York, NY 10001</p>
              <p className="text-sm text-secondary">Get Directions</p>
            </div>
          </div>
          <div className="flex items-center">
            <PhoneIcon size={18} className="text-dark-gray mr-3" />
            <p>(123) 456-7890</p>
          </div>
          <div className="flex items-center">
            <ClockIcon size={18} className="text-dark-gray mr-3" />
            <div>
              <p>Open now: 11:00 AM - 10:00 PM</p>
              <p className="text-sm text-dark-gray">Tap for all hours</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Menu</h2>
          <Link to={`/restaurant/${id}/menu`} className="flex items-center text-secondary">
            <span className="mr-1">View Full Menu</span>
            <ChevronRightIcon size={16} />
          </Link>
        </div>
        <div className="space-y-3">
          {restaurant.posts.map(post => <div key={post.id} className="flex">
              <img src={post.image} alt={post.dish} className="w-20 h-20 rounded-lg object-cover" />
              <div className="ml-3 flex-1">
                <div className="flex justify-between">
                  <h3 className="font-medium">{post.dish}</h3>
                  <div className="flex items-center">
                    <StarIcon size={14} className="text-accent mr-1" />
                    <span className="font-medium text-sm">{post.rating}</span>
                  </div>
                </div>
                <p className="text-dark-gray text-sm line-clamp-2">
                  {post.description}
                </p>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-medium">{post.price}</span>
                  <div className="flex space-x-1">
                    <span className="text-xs text-dark-gray">
                      {post.likes} likes
                    </span>
                    <span className="text-dark-gray">•</span>
                    <span className="text-xs text-dark-gray">
                      {post.comments} comments
                    </span>
                  </div>
                </div>
              </div>
            </div>)}
        </div>
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Popular Photos</h2>
        <div className="grid grid-cols-3 gap-1">
          {restaurant.posts.flatMap((post, index) => [post.image, `https://source.unsplash.com/collection/1353633/300x300?sig=${index + 10}`, `https://source.unsplash.com/collection/1353633/300x300?sig=${index + 20}`]).slice(0, 6).map((image, index) => <div key={index} className="aspect-square bg-medium-gray rounded-md overflow-hidden">
                <img src={image} alt="Food" className="w-full h-full object-cover" />
              </div>)}
        </div>
        <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
          View All Photos
        </button>
      </div>
      <div className="bg-white mt-2 p-4 shadow-sm mb-8">
        <h2 className="font-semibold text-lg mb-4">Reviews</h2>
        <div className="space-y-4">
          {Array.from({
          length: 2
        }).map((_, index) => <div key={index} className="border-b border-light-gray pb-4 last:border-0">
              <div className="flex items-center">
                <img src={`https://randomuser.me/api/portraits/${index % 2 === 0 ? 'women' : 'men'}/${30 + index}.jpg`} alt="User" className="w-10 h-10 rounded-full" />
                <div className="ml-3">
                  <p className="font-medium">User{index + 1}</p>
                  <div className="flex items-center">
                    <div className="flex">
                      {Array.from({
                    length: 5
                  }).map((_, i) => <StarIcon key={i} size={14} className={i < 4 + index % 2 ? 'text-accent fill-accent' : 'text-dark-gray'} />)}
                    </div>
                    <span className="text-xs text-dark-gray ml-2">
                      2 days ago
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm">
                {index % 2 === 0 ? 'Absolutely loved the food here! The service was excellent and the atmosphere was very cozy. Will definitely come back again.' : 'Great place for dinner. The pasta was perfectly cooked and the wine selection is impressive. Highly recommend!'}
              </p>
              <div className="flex mt-2 space-x-2">
                {Array.from({
              length: 2
            }).map((_, i) => <img key={i} src={`https://source.unsplash.com/collection/1353633/100x100?sig=${index * 2 + i}`} alt="Review" className="w-16 h-16 rounded-md object-cover" />)}
              </div>
            </div>)}
        </div>
        <button className="w-full mt-3 py-2 border border-medium-gray rounded-full text-center font-medium">
          View All Reviews
        </button>
      </div>
    </div>;
};
export default RestaurantDetail;