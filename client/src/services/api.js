const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Calls the backend to save the current parking location.
 * @param {{ lat: number, lng: number }} location
 * @returns {Promise<object>} Response data from the server
 */
export async function saveParking(location) {
  const response = await fetch(`${API_BASE_URL}/save_current_parking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: location.lat,
      longitude: location.lng,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Server error (${response.status})`);
  }

  return response.json();
}
