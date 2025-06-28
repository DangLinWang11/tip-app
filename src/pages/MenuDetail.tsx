import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { restaurants } from '../utils/mockData';
import { ArrowLeftIcon, StarIcon, SearchIcon } from 'lucide-react';
const MenuDetail: React.FC = () => {
  const {
    id
  } = useParams<{
    id: string;
  }>();
  const restaurant = restaurants.find(r => r.id === Number(id)) || restaurants[0];
  const [searchQuery, setSearchQuery] = useState('');
  // Mock menu categories and items
  const menuCategories = [{
    name: 'Starters',
    items: [{
      name: 'Garlic Bread',
      price: '$6',
      rating: 4.2,
      image: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    }, {
      name: 'Bruschetta',
      price: '$8',
      rating: 4.5,
      image: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    }]
  }, {
    name: 'Main Courses',
    items: restaurant.posts.map(post => ({
      name: post.dish,
      price: post.price,
      rating: post.rating,
      image: post.image
    }))
  }, {
    name: 'Desserts',
    items: [{
      name: 'Tiramisu',
      price: '$9',
      rating: 4.8,
      image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    }, {
      name: 'Chocolate Cake',
      price: '$7',
      rating: 4.6,
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    }]
  }, {
    name: 'Drinks',
    items: [{
      name: 'Wine Selection',
      price: '$12',
      rating: 4.7,
      image: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    }, {
      name: 'Craft Cocktails',
      price: '$14',
      rating: 4.9,
      image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
    }]
  }];
  return <div className="min-h-screen bg-light-gray">
      <header className="bg-white sticky top-0 z-10 shadow-sm p-4">
        <div className="flex items-center">
          <Link to={`/restaurant/${id}`} className="mr-3">
            <ArrowLeftIcon size={24} />
          </Link>
          <h1 className="text-xl font-semibold">{restaurant.name} Menu</h1>
        </div>
        <div className="mt-3 relative">
          <SearchIcon size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-gray" />
          <input type="text" placeholder="Search menu items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-light-gray rounded-full text-sm" />
        </div>
      </header>
      <div className="p-4">
        {menuCategories.map((category, index) => <div key={index} className="mb-6">
            <h2 className="text-lg font-semibold mb-3">{category.name}</h2>
            <div className="space-y-3">
              {category.items.map((item, itemIndex) => <div key={itemIndex} className="bg-white rounded-xl shadow-sm overflow-hidden flex">
                  <img src={item.image} alt={item.name} className="w-24 h-24 object-cover" />
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between">
                        <h3 className="font-medium">{item.name}</h3>
                        <div className="flex items-center">
                          <StarIcon size={14} className="text-accent mr-1" />
                          <span className="font-medium text-sm">
                            {item.rating}
                          </span>
                        </div>
                      </div>
                      <p className="text-dark-gray text-xs">
                        {Math.floor(Math.random() * 100) + 20} ratings •{' '}
                        {Math.floor(Math.random() * 50) + 10} reviews
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-medium">{item.price}</span>
                      <button className="px-3 py-1 bg-secondary text-white rounded-full text-xs font-medium">
                        Add to Wishlist
                      </button>
                    </div>
                  </div>
                </div>)}
            </div>
          </div>)}
      </div>
    </div>;
};
export default MenuDetail;