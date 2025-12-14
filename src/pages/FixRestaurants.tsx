import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { checkAndFixRinglingGrill } from '../utils/fixRinglingGrill';
import { fixRinglingGrillSimple } from '../utils/fixRinglingGrillSimple';

const FixRestaurants: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFixRinglingGrill = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const restaurantId = await checkAndFixRinglingGrill();
      setResult(
        restaurantId
          ? `✅ Success! Restaurant ID: ${restaurantId}. All reviews have been linked.`
          : '✅ Restaurant already exists and is properly linked.'
      );
    } catch (err) {
      console.error('Error fixing restaurant:', err);
      setError(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFixRinglingGrillSimple = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const restaurantId = await fixRinglingGrillSimple();
      setResult(
        restaurantId
          ? `✅ Success! Restaurant ID: ${restaurantId}. Navigate to /restaurant/${restaurantId}`
          : '✅ Fix complete!'
      );
    } catch (err) {
      console.error('Error fixing restaurant:', err);
      setError(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeftIcon size={20} className="text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Fix Restaurants</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Fix Ringling Grillroom (Simple Fix - Recommended)
          </h2>
          <p className="text-gray-600 mb-4">
            This will fix the specific Ringling Grillroom review by finding it via visitId,
            ensuring the restaurant exists, and updating the review to use the correct Firebase restaurant ID.
          </p>

          <button
            onClick={handleFixRinglingGrillSimple}
            disabled={loading}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-red-600'
            }`}
          >
            {loading ? 'Fixing...' : 'Fix Ringling Grillroom (visitId-based)'}
          </button>

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 whitespace-pre-wrap">{result}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 whitespace-pre-wrap">{error}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Fix Ringling Grill Room (Comprehensive)
          </h2>
          <p className="text-gray-600 mb-4">
            This will check if The Ringling Grill Room restaurant exists in the database.
            If not, it will create it with proper Google Places data and link all existing reviews.
          </p>

          <button
            onClick={handleFixRinglingGrill}
            disabled={loading}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-secondary text-white hover:bg-gray-700'
            }`}
          >
            {loading ? 'Checking and fixing...' : 'Check & Fix Ringling Grill Room (name-based)'}
          </button>

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 whitespace-pre-wrap">{result}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 whitespace-pre-wrap">{error}</p>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ What these tools do:</h3>
          <div className="mb-3">
            <h4 className="font-semibold text-blue-900 text-sm mb-1">Simple Fix (Recommended):</h4>
            <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside ml-2">
              <li>Finds reviews by specific visitId</li>
              <li>Checks if restaurant exists by Google Place ID</li>
              <li>Creates restaurant if needed with proper data</li>
              <li>Updates all reviews to use Firebase restaurant ID instead of Google Place ID</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 text-sm mb-1">Comprehensive Fix:</h4>
            <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside ml-2">
              <li>Searches for all reviews matching restaurant name</li>
              <li>Checks if restaurant document exists</li>
              <li>Creates restaurant with Google Places data if needed</li>
              <li>Links all matching reviews to the restaurant</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixRestaurants;
