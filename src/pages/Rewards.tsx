import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, Gift, Star, Camera, MessageCircle, MapPin, Trophy, Clock, Coins, Video, ChefHat, Target, PlusIcon } from 'lucide-react';
import BottomNavigation from '../components/BottomNavigation';
import { fetchUserReviews, FirebaseReview } from '../services/reviewService';
import { getUserProfile, getCurrentUser, updateUserStats } from '../lib/firebase';

interface PointsActivity {
 id: string;
 type: 'review' | 'photo' | 'check_in' | 'bonus';
 points: number;
 description: string;
 date: string;
 restaurantName?: string;
}

const Rewards: React.FC = () => {
 const [totalPoints, setTotalPoints] = useState(0);
 const [pointsHistory, setPointsHistory] = useState<PointsActivity[]>([]);
 const [userProfile, setUserProfile] = useState<any>(null);
 const [userReviews, setUserReviews] = useState<FirebaseReview[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // Load user data on component mount
 useEffect(() => {
   const loadUserData = async () => {
     try {
       setLoading(true);
       const currentUser = getCurrentUser();
       
       if (!currentUser) {
         setError('Please sign in to view your rewards');
         return;
       }

       // Get user profile for points data
       const profileResult = await getUserProfile();
       if (profileResult.success && profileResult.profile) {
         setUserProfile(profileResult.profile);
       }
       
       // Get user's reviews to generate activity history
       const reviews = await fetchUserReviews(20);
       setUserReviews(reviews);
       
       // Convert reviews to points activity
       const activity = generatePointsActivity(reviews);
       const calculatedTotal = activity.reduce((sum, item) => sum + item.points, 0);
       setTotalPoints(calculatedTotal);
       setPointsHistory(activity);
       
       // Update Firebase profile with correct total (sync the database)
       if (profileResult.success && profileResult.profile) {
         const currentProfilePoints = profileResult.profile.stats?.pointsEarned || 0;
         if (currentProfilePoints !== calculatedTotal) {
           console.log(`Syncing points: Profile has ${currentProfilePoints}, calculated ${calculatedTotal}`);
           await updateUserStats({
             pointsEarned: calculatedTotal,
             totalReviews: reviews.length
           });
         }
       }
       
       setError(null);
     } catch (err) {
       console.error('Failed to load user data:', err);
       setError('Failed to load rewards data');
     } finally {
       setLoading(false);
     }
   };

   loadUserData();
 }, []);

 // Generate points activity from user reviews
 const generatePointsActivity = (reviews: FirebaseReview[]): PointsActivity[] => {
   const activities: PointsActivity[] = [];
   
   reviews.forEach((review) => {
     // Add points for the review itself
     activities.push({
       id: `review-${review.id}`,
       type: 'review',
       points: review.pointsEarned || 20,
       description: `Reviewed ${review.dish}`,
       date: review.createdAt,
       restaurantName: review.restaurant
     });
     
     // Add bonus points if this was marked as a first review
     if (review.rewardReason === 'First review bonus') {
       activities.push({
         id: `bonus-${review.id}`,
         type: 'bonus',
         points: 20,
         description: 'First review bonus',
         date: review.createdAt,
         restaurantName: review.restaurant
       });
     }
     
     // Add photo bonus if review has images
     if (review.images && review.images.length > 0) {
       activities.push({
         id: `photo-${review.id}`,
         type: 'photo',
         points: 10,
         description: `Added ${review.images.length} photo${review.images.length > 1 ? 's' : ''}`,
         date: review.createdAt,
         restaurantName: review.restaurant
       });
     }
   });
   
   // Sort by date (most recent first)
   return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
 };

 const getActivityIcon = (type: string) => {
   switch (type) {
     case 'review':
       return <Star size={20} className="text-white" />;
     case 'photo':
       return <Camera size={20} className="text-white" />;
     case 'check_in':
       return <MapPin size={20} className="text-white" />;
     case 'bonus':
       return <Trophy size={20} className="text-white" />;
     default:
       return <Coins size={20} className="text-white" />;
   }
 };

 const getActivityColor = (type: string) => {
   switch (type) {
     case 'review':
       return 'bg-red-500';
     case 'photo':
       return 'bg-blue-500';
     case 'check_in':
       return 'bg-green-500';
     case 'bonus':
       return 'bg-yellow-500';
     default:
       return 'bg-gray-500';
   }
 };

 const formatDate = (dateString: string) => {
   const date = new Date(dateString);
   return date.toLocaleDateString('en-US', { 
     month: 'short', 
     day: 'numeric'
   });
 };

 // Loading state
 if (loading) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
       <div className="text-center">
         <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
         <p className="text-gray-600">Loading your rewards...</p>
       </div>
     </div>
   );
 }

 // Error state
 if (error) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
       <div className="text-center p-4">
         <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Rewards</h2>
         <p className="text-gray-600 mb-4">{error}</p>
         <button 
           onClick={() => window.location.reload()} 
           className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
         >
           Try Again
         </button>
       </div>
     </div>
   );
 }

 return (
   <div className="min-h-screen bg-gray-50 pb-20">
     {/* Header */}
     <div className="bg-white shadow-sm">
       <div className="flex items-center justify-between px-4 py-4">
         <Link to="/" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
           <ArrowLeftIcon size={20} className="text-gray-700" />
         </Link>
         <h1 className="text-xl font-semibold text-gray-900">Rewards</h1>
         <div className="w-10 h-10" /> {/* Spacer */}
       </div>
     </div>

     {/* Points Balance Card */}
     <div className="px-4 py-6">
       <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #ff3131 0%, #ff1a1a 100%)' }}>
         <div className="flex items-center justify-between">
           <div>
             <p className="text-red-100 text-sm font-medium">Total Points</p>
             <p className="text-4xl font-bold">{totalPoints.toLocaleString()}</p>
             <p className="text-red-100 text-sm mt-1">Keep earning to unlock rewards!</p>
           </div>
           <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
             <div 
               className="w-10 h-10 rounded-full flex items-center justify-center"
               style={{ backgroundColor: '#FFD700' }}
             >
               <div 
                 className="w-7 h-7 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: '#F59E0B' }}
               >
                 <Star 
                   size={16} 
                   style={{ 
                     color: '#FFD700', 
                     fill: '#FFD700'
                   }} 
                 />
               </div>
             </div>
           </div>
         </div>
       </div>
     </div>

     {/* Coming Soon Section */}
     <div className="px-4 mb-6">
       <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
         <div className="text-center">
           <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
             <Gift size={24} className="text-gray-400" />
           </div>
           <h2 className="text-xl font-semibold text-gray-900 mb-2">Rewards Coming Soon!</h2>
           <p className="text-gray-600 mb-4">
             We're working on exciting rewards you can redeem with your points. Stay tuned!
           </p>
           <div className="bg-gray-50 rounded-lg p-4">
             <p className="text-sm text-gray-700 font-medium">Potential Rewards:</p>
             <div className="mt-2 space-y-1">
               <p className="text-sm text-gray-600">• Restaurant discounts</p>
               <p className="text-sm text-gray-600">• Free appetizers</p>
               <p className="text-sm text-gray-600">• Exclusive dining experiences</p>
               <p className="text-sm text-gray-600">• Gift cards</p>
             </div>
           </div>
         </div>
       </div>
     </div>

     {/* Points History */}
     <div className="px-4">
       <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
       {pointsHistory.length === 0 ? (
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
           <div className="text-center">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <PlusIcon size={24} className="text-gray-400" />
             </div>
             <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
             <p className="text-gray-600 mb-6">
               Start reviewing restaurants to earn points and see your activity here!
             </p>
             <Link 
               to="/create" 
               className="inline-block bg-primary text-white py-2 px-6 rounded-full font-medium hover:bg-red-600 transition-colors"
             >
               Write Your First Review
             </Link>
           </div>
         </div>
       ) : (
         <div className="space-y-3">
           {pointsHistory.map((activity) => (
           <div key={activity.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
             <div className="flex items-center">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${getActivityColor(activity.type)}`}>
                 {getActivityIcon(activity.type)}
               </div>
               <div className="flex-1">
                 <div className="flex justify-between items-start">
                   <div>
                     <h3 className="font-medium text-gray-900">{activity.description}</h3>
                     {activity.restaurantName && (
                       <p className="text-sm text-gray-600 mt-1">{activity.restaurantName}</p>
                     )}
                   </div>
                   <div className="text-right">
                     <p className="font-semibold flex items-center" style={{ color: '#FFD700' }}>
                       +{activity.points}
                       <div 
                         className="w-3 h-3 rounded-full flex items-center justify-center ml-1"
                         style={{ backgroundColor: '#FFD700' }}
                       >
                         <div 
                           className="w-2 h-2 rounded-full flex items-center justify-center"
                           style={{ backgroundColor: '#F59E0B' }}
                         >
                           <Star 
                             size={6} 
                             style={{ 
                               color: '#FFD700', 
                               fill: '#FFD700'
                             }} 
                           />
                         </div>
                       </div>
                     </p>
                     <p className="text-xs text-gray-500 mt-1 flex items-center">
                       <Clock size={12} className="mr-1" />
                       {formatDate(activity.date)}
                     </p>
                   </div>
                 </div>
               </div>
             </div>
           </div>
           ))}
         </div>
       )}
     </div>

     {/* How to Earn More Points */}
     <div className="px-4 mt-8 mb-8">
       <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
         <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Earn Points</h2>
         <div className="space-y-4">
           <div className="flex items-center">
             <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
               <Star size={16} className="text-red-500" style={{ color: '#ff3131' }} />
             </div>
             <div>
               <p className="font-medium text-gray-900">Write Reviews</p>
               <p className="text-sm text-gray-600">20 points per review</p>
             </div>
           </div>
           <div className="flex items-center">
             <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
               <Camera size={16} className="text-blue-500" />
             </div>
             <div>
               <p className="font-medium text-gray-900">Add Photos</p>
               <p className="text-sm text-gray-600">+10 bonus points</p>
             </div>
           </div>
           <div className="flex items-center">
             <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
               <Video size={16} className="text-purple-500" />
             </div>
             <div>
               <p className="font-medium text-gray-900">Add Videos</p>
               <p className="text-sm text-gray-600">+20 bonus points</p>
             </div>
           </div>
           <div className="flex items-center">
             <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
               <ChefHat size={16} className="text-green-500" />
             </div>
             <div>
               <p className="font-medium text-gray-900">Try New Dishes</p>
               <p className="text-sm text-gray-600">+15 bonus points</p>
             </div>
           </div>
           <div className="flex items-center">
             <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
               <Trophy size={16} className="text-yellow-500" />
             </div>
             <div>
               <p className="font-medium text-gray-900">First Restaurant Review</p>
               <p className="text-sm text-gray-600">+20 bonus points</p>
             </div>
           </div>
           <div className="flex items-center">
             <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
               <Target size={16} className="text-indigo-500" />
             </div>
             <div>
               <p className="font-medium text-gray-900">Complete Menu Categories</p>
               <p className="text-sm text-gray-600">+30 bonus points</p>
             </div>
           </div>
         </div>
       </div>
     </div>

     <BottomNavigation />
   </div>
 );
};

export default Rewards;