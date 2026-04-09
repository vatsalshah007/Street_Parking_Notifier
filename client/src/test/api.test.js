import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveParking } from '../services/api';

describe('saveParking', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should POST the location to /save_current_parking', async () => {
    const mockResponse = { success: true };
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const location = { lat: 40.7128, lng: -74.006 };
    const result = await saveParking(location);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/save_current_parking',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: 40.7128, longitude: -74.006 }),
      }
    );
    expect(result).toEqual(mockResponse);
  });

  it('should throw an error when the server returns a non-ok response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Internal server error' }),
    });

    const location = { lat: 40.7128, lng: -74.006 };
    await expect(saveParking(location)).rejects.toThrow('Internal server error');
  });

  it('should throw a generic error when server returns non-ok and no JSON body', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    });

    const location = { lat: 40.7128, lng: -74.006 };
    await expect(saveParking(location)).rejects.toThrow('Server error (502)');
  });

  it('should propagate network errors', async () => {
    global.fetch.mockRejectedValue(new Error('Network failure'));

    const location = { lat: 40.7128, lng: -74.006 };
    await expect(saveParking(location)).rejects.toThrow('Network failure');
  });
});
