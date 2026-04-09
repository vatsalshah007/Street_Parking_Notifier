import { useState, useCallback, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { useGeolocation } from './hooks/useGeolocation';
import { saveParking } from './services/api';
import './App.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const MAP_ZOOM = 20; 

function MapController({ location, recenterTrigger, saveStatus }) {
  const map = useMap();

  useEffect(() => {
    if (map && location) {
      map.panTo(location);
      map.setZoom(MAP_ZOOM);
    }
  }, [map, location, recenterTrigger, saveStatus]);

  return null;
}

function App() {
  const { location, error: geoError, permissionDenied, loading: geoLoading } = useGeolocation();
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const handleRecenter = useCallback(() => {
    setRecenterTrigger((prev) => prev + 1);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  }, []);

  const handleSaveParking = useCallback(async () => {
    if (!location || saveStatus === 'saving') return;

    setSaveStatus('saving');
    try {
      await saveParking(location);
      setSaveStatus('saved');
      showToast('Parking location saved!', 'success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      setSaveStatus('error');
      showToast(err.message || 'Failed to save parking.', 'error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  }, [location, saveStatus, showToast]);

  const getButtonContent = () => {
    switch (saveStatus) {
      case 'saving':
        return { icon: '⏳', label: 'Saving...' };
      case 'saved':
        return { icon: '✅', label: 'Saved!' };
      case 'error':
        return { icon: '⚠️', label: 'Retry' };
      default:
        return { icon: '📍', label: 'Save Parking' };
    }
  };

  const { icon, label } = getButtonContent();

  return (
    <div className="app">
      {/* Permission Denied Modal — non-dismissible */}
      {permissionDenied && (
        <div className="permission-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="permission-modal-title">
          <div className="permission-modal">
            <div className="permission-modal__icon">🚫</div>
            <h2 id="permission-modal-title" className="permission-modal__title">Location Permission Required</h2>
            <p className="permission-modal__message">
              Street Parking Notifier needs access to your location to work. Without it, we can't save your parking spot.
            </p>
            <div className="permission-modal__steps">
              <p className="permission-modal__steps-heading">To enable location access:</p>
              <ol>
                <li>Click the lock/site-settings icon in your browser's address bar</li>
                <li>Set <strong>Location</strong> to <strong>Allow</strong></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="header">
        <div className="header__logo">
          <div className="header__icon">🅿️</div>
          <h1 className="header__title">Street Parking Notifier</h1>
        </div>
      </header>

      {/* Map */}
      <main className="map-container">
        {geoLoading && (
          <div className="map-container__loading">
            <div className="map-container__spinner" />
            <span>Locating you…</span>
          </div>
        )}

        {geoError && (
          <div className="map-container__error">
            <div className="map-container__error-icon">📡</div>
            <div className="map-container__error-title">Location Unavailable</div>
            <div className="map-container__error-message">{geoError}</div>
          </div>
        )}

        {!geoLoading && !geoError && location && (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <Map
              defaultCenter={location}
              defaultZoom={MAP_ZOOM}
              gestureHandling="greedy"
              disableDefaultUI={false}
              mapId="street-parking-map"
              style={{ width: '100%', height: '100%' }}
            >
              <MapController location={location} recenterTrigger={recenterTrigger} saveStatus={saveStatus} />
              <AdvancedMarker position={location} title="You are here" />
            </Map>
          </APIProvider>
        )}
      </main>

      {/* Floating Action Buttons */}
      {!geoLoading && !geoError && location && (
        <div className="action-bar">
          <button
            id="recenter-button"
            className="action-btn action-btn--secondary"
            onClick={handleRecenter}
            aria-label="Recenter map on my location"
          >
            <span className="action-btn__icon">🎯</span>
          </button>
          <button
            id="save-parking-button"
            className={`action-btn action-btn--primary ${saveStatus !== 'idle' ? `action-btn--${saveStatus}` : ''}`}
            onClick={handleSaveParking}
            disabled={saveStatus === 'saving'}
            aria-label="Save current parking location"
          >
            <span className="action-btn__icon">{icon}</span>
            {label}
          </button>
        </div>
      )}

      {/* Toast */}
      <div
        className={`toast toast--${toastType} ${toastMessage ? 'toast--visible' : ''}`}
        role="alert"
        aria-live="polite"
      >
        {toastMessage}
      </div>
    </div>
  );
}

export default App;
