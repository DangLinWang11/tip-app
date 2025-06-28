import React, { useEffect, useState, useRef } from 'react';
import { feedPosts } from '../utils/mockData';
import FeedPost from '../components/FeedPost';
import HamburgerMenu from '../components/HamburgerMenu';

const POSTS_PER_PAGE = 5;

const Home: React.FC = () => {
  const [displayedPosts, setDisplayedPosts] = useState(feedPosts.slice(0, POSTS_PER_PAGE));
  const [loading, setLoading] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const loadMoreRef = useRef(null);

  const loadMorePosts = () => {
    setLoading(true);
    setTimeout(() => {
      const currentLength = displayedPosts.length;
      const nextPosts = feedPosts.slice(currentLength, currentLength + POSTS_PER_PAGE);
      setDisplayedPosts(prev => [...prev, ...nextPosts]);
      setLoading(false);
    }, 500); // Simulate network delay
  };

  // Scroll detection for auto-hide header
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show header if at top of page
      if (currentScrollY === 0) {
        setIsHeaderVisible(true);
      }
      // Hide header when scrolling down, show when scrolling up
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHeaderVisible(false); // Scrolling down
      } else if (currentScrollY < lastScrollY) {
        setIsHeaderVisible(true); // Scrolling up
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && displayedPosts.length < feedPosts.length) {
        loadMorePosts();
      }
    }, {
      threshold: 0.1
    });
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [loading, displayedPosts.length]);

  return (
    <div className="min-h-screen bg-light-gray">
      <header className={`bg-white sticky top-0 z-10 shadow-sm transition-transform duration-300 ${
        isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
      }`}>
        <div className="flex justify-between items-center px-4 py-1">
          <img 
            src="/images/tip-logo.png" 
            alt="Tip Logo" 
            className="h-[80px] w-auto object-contain"
          />      
          <HamburgerMenu />
        </div>
      </header>
      <div className="p-4">
        {displayedPosts.map(post => <FeedPost key={post.id} {...post} />)}
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {loading && <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>
    </div>
  );
};

export default Home;