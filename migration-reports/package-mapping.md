# Package Migration Mapping

Current web dependencies (from tip/package.json):

- @googlemaps/react-wrapper → react-native-maps
- framer-motion → moti + react-native-reanimated
- react-router-dom → expo-router
- vite → expo (Metro)

Can keep (React Native compatible):

- firebase (JS SDK) — keep for MVP; use initializeAuth + AsyncStorage
- lucide-react → lucide-react-native (installed)
- react — managed by Expo

Notes:
- Google Sign-In: replace signInWithPopup with @react-native-google-signin/google-signin or use Expo AuthSession if preferred.
- Analytics: Firebase Web Analytics doesn’t work on RN; consider @react-native-firebase/analytics later.

