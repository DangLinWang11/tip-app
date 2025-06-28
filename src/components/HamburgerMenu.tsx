import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MenuIcon, XIcon, MapIcon, SettingsIcon, HelpCircleIcon } from 'lucide-react';
const HamburgerMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  return <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-light-gray">
        {isOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
      </button>
      {isOpen && <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg py-2 z-50">
          <Link to="/food-map" className="flex items-center px-4 py-3 hover:bg-light-gray" onClick={() => setIsOpen(false)}>
            <MapIcon size={20} className="mr-3 text-secondary" />
            <span>My Food Map</span>
          </Link>
          <hr className="my-2 border-light-gray" />
          <Link to="/settings" className="flex items-center px-4 py-3 hover:bg-light-gray" onClick={() => setIsOpen(false)}>
            <SettingsIcon size={20} className="mr-3 text-dark-gray" />
            <span>Settings</span>
          </Link>
          <Link to="/help" className="flex items-center px-4 py-3 hover:bg-light-gray" onClick={() => setIsOpen(false)}>
            <HelpCircleIcon size={20} className="mr-3 text-dark-gray" />
            <span>Help & Support</span>
          </Link>
        </div>}
    </div>;
};
export default HamburgerMenu;