import './index.css';
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// ZUSTAND CACHE CLEAR: Clear stale/corrupted localStorage data on version change
const APP_VERSION = '1.0.1'; // Increment this to force cache clear
const VERSION_KEY = 'app_version';
const RESET_FLAG_KEY = 'force_reset';

const storedVersion = localStorage.getItem(VERSION_KEY);
const resetFlag = localStorage.getItem(RESET_FLAG_KEY);

if (storedVersion !== APP_VERSION || resetFlag === 'true') {
  console.log('🧹 [Cache] Clearing localStorage - version change or reset flag detected');
  console.log('  Previous version:', storedVersion, '→ Current version:', APP_VERSION);

  // Clear all localStorage except critical auth data
  const keysToPreserve = ['firebase:authUser', 'firebase:host'];
  const preservedData: Record<string, string> = {};

  keysToPreserve.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) preservedData[key] = value;
  });

  localStorage.clear();

  // Restore preserved keys
  Object.entries(preservedData).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });

  // Set new version
  localStorage.setItem(VERSION_KEY, APP_VERSION);
  localStorage.removeItem(RESET_FLAG_KEY);

  console.log('✅ [Cache] localStorage cleared and version updated');
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);
root.render(<App />);