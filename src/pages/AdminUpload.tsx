import React, { useState } from 'react';
import { collection, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface MenuItem {
  name: string;
  category: string;
  price: number | null;
  description: string;
}

interface RestaurantData {
  name: string;
  address: string;
  cuisine: string;
  phone: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AdminUpload: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const restaurantData: RestaurantData = {
    name: "Anna Maria Oyster Bar - UTC",
    address: "5405 University Pkwy, Unit 110, Bradenton, FL 34201",
    cuisine: "Seafood/American",
    phone: "(941) 388-0190",
    coordinates: {
      latitude: 27.390017,
      longitude: -82.46295
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const menuItems: MenuItem[] = [
    // OYSTERS
    { name: "Raw Oysters (6)", category: "Oysters", price: null, description: "Fresh local oysters - market price" },
    { name: "Raw Oysters (12)", category: "Oysters", price: null, description: "Fresh local oysters - market price" },
    { name: "Steamed Oysters (6)", category: "Oysters", price: null, description: "Fresh steamed oysters - market price" },
    { name: "Steamed Oysters (12)", category: "Oysters", price: null, description: "Fresh steamed oysters - market price" },
    { name: "Tequila Lime Oysters (6)", category: "Oysters", price: null, description: "Tequila lime preparation - market price" },
    { name: "Tequila Lime Oysters (12)", category: "Oysters", price: null, description: "Tequila lime preparation - market price" },
    { name: "Grandma Georgie's Chipotle Oysters (6)", category: "Oysters", price: null, description: "Signature chipotle preparation - market price" },
    { name: "Grandma Georgie's Chipotle Oysters (12)", category: "Oysters", price: null, description: "Signature chipotle preparation - market price" },
    { name: "Garlic Parmesan Oysters (6)", category: "Oysters", price: null, description: "Garlic parmesan preparation - market price" },
    { name: "Garlic Parmesan Oysters (12)", category: "Oysters", price: null, description: "Garlic parmesan preparation - market price" },
    { name: "Oysters Rock (6)", category: "Oysters", price: null, description: "Oysters Rockefeller style - market price" },
    { name: "Oysters Rock (12)", category: "Oysters", price: null, description: "Oysters Rockefeller style - market price" },
    { name: "Build Your Own Dozen", category: "Oysters", price: null, description: "Mix and match your favorites - market price" },

    // CHILLED STARTERS
    { name: "Shrimp Ceviche", category: "Chilled Starters", price: 14.99, description: "Fresh shrimp in citrus marinade" },
    { name: "Smoked Fish Dip", category: "Chilled Starters", price: 11.99, description: "House-made smoked fish dip" },
    { name: "Peel & Eat Shrimp (1/2 Lb)", category: "Chilled Starters", price: 15.99, description: "Steamed peel & eat shrimp" },
    { name: "Peel & Eat Shrimp (Lb)", category: "Chilled Starters", price: 29.99, description: "Steamed peel & eat shrimp" },
    { name: "Sushi Stack", category: "Chilled Starters", price: 17.99, description: "Layered sushi-style appetizer" },

    // HOT STARTERS
    { name: "Calamari", category: "Hot Starters", price: 15.99, description: "Crispy fried squid rings" },
    { name: "Coconut Shrimp", category: "Hot Starters", price: 12.49, description: "Coconut-crusted shrimp" },
    { name: "P.E.I. Mussels Provencal", category: "Hot Starters", price: 16.99, description: "Prince Edward Island mussels in provencal sauce" },
    { name: "Kaboom Shrimp", category: "Hot Starters", price: 12.99, description: "Spicy fried shrimp" },
    { name: "Conch Fritters", category: "Hot Starters", price: 10.99, description: "Traditional Florida conch fritters" },
    { name: "Crab Mac & Cheese", category: "Hot Starters", price: 18.99, description: "Macaroni and cheese with crab meat" },
    { name: "Chipotle Chicken Quesadilla", category: "Hot Starters", price: 13.99, description: "Grilled chicken with chipotle spice" },
    { name: "Southern-Fried Oysters (Half-doz)", category: "Hot Starters", price: 12.99, description: "Crispy fried oysters" },
    { name: "Southern-Fried Oysters (Doz)", category: "Hot Starters", price: 20.99, description: "Crispy fried oysters" },
    { name: "Brussels Sprouts", category: "Hot Starters", price: 9.99, description: "Roasted Brussels sprouts" },
    { name: "Crispy Portobello Mushrooms", category: "Hot Starters", price: 10.99, description: "Battered and fried portobello mushrooms" },
    { name: "Escargot", category: "Hot Starters", price: 14.99, description: "French-style escargot" },
    { name: "Onion Straws", category: "Hot Starters", price: 8.99, description: "Crispy fried onion strings" },
    { name: "Chicken Wings", category: "Hot Starters", price: 15.99, description: "Traditional chicken wings" },

    // BOWLS
    { name: "Tuna Poke Bowl", category: "Bowls", price: 15.99, description: "Fresh tuna poke with rice and vegetables" },
    { name: "Tropical Chicken Bowl", category: "Bowls", price: 15.99, description: "Grilled chicken with tropical fruits" },
    { name: "Shrimp & Grits", category: "Bowls", price: 14.99, description: "Southern-style shrimp and grits" },

    // SALADS
    { name: "House Salad", category: "Salads", price: 11.99, description: "Fresh mixed greens with house dressing" },
    { name: "Caesar Salad", category: "Salads", price: 11.99, description: "Classic Caesar with romaine and parmesan" },
    { name: "Seafood Cobb Salad", category: "Salads", price: 18.99, description: "Cobb salad topped with seafood" },
    { name: "Bourbon Salmon Salad", category: "Salads", price: 16.99, description: "Bourbon-glazed salmon over greens" },

    // FIN FISH
    { name: "Cajun Cobia", category: "Fin Fish", price: 28.99, description: "Blackened cobia with Cajun spices" },
    { name: "Old Florida Basket", category: "Fin Fish", price: 14.99, description: "Traditional Florida fish basket" },
    { name: "Fish & Chips", category: "Fin Fish", price: 17.99, description: "Beer-battered fish with fries" },

    // CRUSTACEANS
    { name: "Coconut Shrimp", category: "Crustaceans", price: 23.99, description: "Coconut-crusted shrimp dinner" },
    { name: "Florida Lobster Tail", category: "Crustaceans", price: 31.99, description: "Fresh Florida lobster tail" },
    { name: "Live Maine Lobster", category: "Crustaceans", price: null, description: "Fresh Maine lobster - market price" },
    { name: "Fried Clam Strips", category: "Crustaceans", price: 18.99, description: "Crispy fried clam strips" },
    { name: "Sea Scallops", category: "Crustaceans", price: 23.99, description: "Pan-seared sea scallops" },
    { name: "Shrimp and Scallops", category: "Crustaceans", price: 24.99, description: "Combination of shrimp and scallops" },
    { name: "Shrimp Dinner", category: "Crustaceans", price: 19.99, description: "Grilled or fried shrimp dinner" },
    { name: "Admiral's Platter", category: "Crustaceans", price: null, description: "Seafood combination platter - market price" },

    // HANDHELDS
    { name: "Build Your Own Burger", category: "Handhelds", price: 13.49, description: "Customizable burger with toppings" },
    { name: "Baja Chicken Sandwich", category: "Handhelds", price: 13.99, description: "Grilled chicken with Baja seasonings" },
    { name: "North Shore Sandwich", category: "Handhelds", price: 16.99, description: "Specialty sandwich with local flavors" },
    { name: "AMOB Tacos", category: "Handhelds", price: 15.99, description: "Anna Maria Oyster Bar signature tacos" },
    { name: "Gulf Grouper Sandwich", category: "Handhelds", price: null, description: "Fresh Gulf grouper - market price" },

    // THINGS THAT DON'T SWIM
    { name: "Danish Baby Back Ribs (Full)", category: "Things That Don't Swim", price: 23.99, description: "Full rack of Danish baby back ribs" },
    { name: "Danish Baby Back Ribs (Half)", category: "Things That Don't Swim", price: 14.99, description: "Half rack of Danish baby back ribs" },
    { name: "Baja Chicken Breast", category: "Things That Don't Swim", price: 18.99, description: "Grilled chicken breast with Baja spices" },
    { name: "Ribeye", category: "Things That Don't Swim", price: 25.99, description: "Grilled ribeye steak" },
    { name: "Churrasco Skirt Steak", category: "Things That Don't Swim", price: 26.99, description: "Marinated skirt steak" },

    // SIDES
    { name: "AMOB Coleslaw", category: "Sides", price: 3.99, description: "House-made coleslaw" },
    { name: "French Fries", category: "Sides", price: 3.99, description: "Crispy French fries" },
    { name: "Red Bliss Potatoes", category: "Sides", price: 3.99, description: "Roasted red bliss potatoes" },
    { name: "Cheese Grits", category: "Sides", price: 3.99, description: "Creamy cheese grits" },
    { name: "Cilantro Rice", category: "Sides", price: 3.99, description: "Rice with cilantro" },
    { name: "Seasonal Vegetable", category: "Sides", price: 3.99, description: "Chef's choice seasonal vegetable" },

    // PREMIUM SIDES
    { name: "Kickin' Sprouts", category: "Premium Sides", price: 4.99, description: "Spicy Brussels sprouts" },
    { name: "Chipotle Mac", category: "Premium Sides", price: 4.99, description: "Macaroni and cheese with chipotle" },
    { name: "Hush Puppies", category: "Premium Sides", price: 4.99, description: "Traditional hush puppies" },
    { name: "House Salad (small)", category: "Premium Sides", price: 4.99, description: "Small house salad" },
    { name: "Caesar Salad (small)", category: "Premium Sides", price: 4.99, description: "Small Caesar salad" },

    // SOUPS
    { name: "Lobster Bisque", category: "Soups", price: 6.99, description: "Rich and creamy lobster bisque" },
    { name: "Spicy Seafood Gumbo", category: "Soups", price: 5.99, description: "Louisiana-style seafood gumbo" },
    { name: "New England Clam Chowder", category: "Soups", price: 5.99, description: "Traditional New England clam chowder" }
  ];

  const handleUpload = async () => {
    if (!db) {
      setUploadStatus({
        type: 'error',
        message: 'Firebase not initialized. Please check your Firebase configuration.'
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      console.log("Starting upload for Anna Maria Oyster Bar - UTC...");
      
      // Add restaurant to restaurants collection
      const restaurantRef = await addDoc(collection(db, 'restaurants'), restaurantData);
      const restaurantId = restaurantRef.id;
      
      console.log(`Restaurant added with ID: ${restaurantId}`);
      
      // Add menu items to menuItems collection with restaurantId reference using batch
      const batch = writeBatch(db);
      
      menuItems.forEach((item) => {
        const menuItemRef = collection(db, 'menuItems');
        const newMenuItemRef = addDoc(menuItemRef, {
          ...item,
          restaurantId: restaurantId,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        // Note: writeBatch doesn't work with addDoc, so we'll use a different approach
      });
      
      // Since writeBatch doesn't work with addDoc, we'll use Promise.all instead
      const menuItemPromises = menuItems.map(item => 
        addDoc(collection(db, 'menuItems'), {
          ...item,
          restaurantId: restaurantId,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );
      
      await Promise.all(menuItemPromises);
      
      console.log(`Successfully uploaded ${menuItems.length} menu items for Anna Maria Oyster Bar - UTC`);
      
      setUploadStatus({
        type: 'success',
        message: `Successfully uploaded Anna Maria Oyster Bar - UTC with ${menuItems.length} menu items! Restaurant ID: ${restaurantId}`
      });
      
    } catch (error: any) {
      console.error("Error uploading data:", error);
      setUploadStatus({
        type: 'error',
        message: `Upload failed: ${error.message || 'Unknown error occurred'}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Upload</h1>
            <p className="text-gray-600">Upload restaurant data to Firebase</p>
          </div>

          {/* Restaurant Preview */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Restaurant Details</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name:</p>
                  <p className="font-medium">{restaurantData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cuisine:</p>
                  <p className="font-medium">{restaurantData.cuisine}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Address:</p>
                  <p className="font-medium">{restaurantData.address}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone:</p>
                  <p className="font-medium">{restaurantData.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Coordinates:</p>
                  <p className="font-medium">{restaurantData.coordinates.latitude}, {restaurantData.coordinates.longitude}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items Summary */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Menu Items Summary</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-lg font-medium mb-2">Total Items: {menuItems.length}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(
                  menuItems.reduce((acc, item) => {
                    acc[item.category] = (acc[item.category] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([category, count]) => (
                  <div key={category} className="text-sm">
                    <span className="font-medium">{category}:</span> {count}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upload Button */}
          <div className="mb-6">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors ${
                isUploading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isUploading ? 'Uploading...' : "Upload Anna Maria Oyster Bar - UTC"}
            </button>
          </div>

          {/* Status Messages */}
          {uploadStatus.type && (
            <div className={`p-4 rounded-lg ${
              uploadStatus.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <p className="font-medium">
                {uploadStatus.type === 'success' ? 'Success!' : 'Error!'}
              </p>
              <p className="text-sm mt-1">{uploadStatus.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUpload;