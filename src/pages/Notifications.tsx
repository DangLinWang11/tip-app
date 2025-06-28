import React, { useState } from 'react';
import { notifications } from '../utils/mockData';
import { HeartIcon, MessageCircleIcon, UserPlusIcon } from 'lucide-react';
const Notifications: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'foodie'>('all');
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <HeartIcon size={18} className="text-primary" />;
      case 'comment':
        return <MessageCircleIcon size={18} className="text-secondary" />;
      case 'follow':
        return <UserPlusIcon size={18} className="text-accent" />;
      default:
        return <HeartIcon size={18} className="text-primary" />;
    }
  };
  const foodieActivity = notifications.filter(notif => notif.type === 'foodie_activity');
  const allNotifications = notifications;
  const displayNotifications = activeTab === 'all' ? allNotifications : foodieActivity;
  return <div className="min-h-screen bg-light-gray pb-16">
      <header className="bg-white sticky top-0 z-10 shadow-sm">
        <h1 className="text-xl font-semibold p-4">Notifications</h1>
        <div className="flex border-b border-light-gray">
          <button className={`flex-1 py-3 text-center ${activeTab === 'all' ? 'border-b-2 border-primary text-primary font-medium' : 'text-dark-gray'}`} onClick={() => setActiveTab('all')}>
            All
          </button>
          <button className={`flex-1 py-3 text-center ${activeTab === 'foodie' ? 'border-b-2 border-primary text-primary font-medium' : 'text-dark-gray'}`} onClick={() => setActiveTab('foodie')}>
            Foodie Activity
          </button>
        </div>
      </header>
      <div className="p-4">
        <div className="space-y-4">
          {displayNotifications.map(notification => <div key={notification.id} className="bg-white rounded-xl p-4 shadow-sm flex">
              <div className="mr-3">
                <img src={notification.user.avatar} alt={notification.user.name} className="w-12 h-12 rounded-full object-cover" />
              </div>
              <div className="flex-1">
                <div className="flex items-start">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium">
                        {notification.user.name}
                      </span>
                      <div className="ml-2 p-1 rounded-full bg-light-gray">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                    <p className="text-sm">{notification.content}</p>
                    {notification.restaurant && <p className="text-sm text-secondary">
                        at {notification.restaurant}
                      </p>}
                    <p className="text-xs text-dark-gray mt-1">
                      {notification.time}
                    </p>
                  </div>
                  {notification.image && <div className="ml-2">
                      <img src={notification.image} alt="Post" className="w-16 h-16 rounded-lg object-cover" />
                    </div>}
                </div>
              </div>
            </div>)}
        </div>
        {displayNotifications.length === 0 && <div className="text-center py-8">
            <p className="text-dark-gray">No notifications yet</p>
          </div>}
      </div>
    </div>;
};
export default Notifications;