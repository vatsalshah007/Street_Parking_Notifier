import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to watch the user's geolocation continuously.
 * Uses watchPosition so the GPS can refine over time for better accuracy.
 * Returns { location, accuracy, error, permissionDenied, loading }.
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    const onSuccess = (position) => {
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setAccuracy(position.coords.accuracy); // accuracy in meters
      setLoading(false);
    };

    const onError = (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          setPermissionDenied(true);
          setError('Location access was denied.');
          break;
        case err.POSITION_UNAVAILABLE:
          setError('Location information is unavailable. Please try again.');
          break;
        case err.TIMEOUT:
          setError('Location request timed out. Please try again.');
          break;
        default:
          setError('An unknown error occurred while fetching your location.');
      }
      setLoading(false);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });

    // Clean up the watcher when the component unmounts
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { location, accuracy, error, permissionDenied, loading };
}
