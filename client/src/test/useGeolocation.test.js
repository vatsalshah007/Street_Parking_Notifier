import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGeolocation } from '../hooks/useGeolocation';

describe('useGeolocation', () => {
  let mockGeolocation;

  beforeEach(() => {
    mockGeolocation = {
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    navigator.geolocation = mockGeolocation;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start in a loading state', () => {
    mockGeolocation.watchPosition.mockImplementation(() => 1);

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.loading).toBe(true);
    expect(result.current.location).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.permissionDenied).toBe(false);
  });

  it('should return location on successful geolocation', async () => {
    mockGeolocation.watchPosition.mockImplementation((onSuccess) => {
      onSuccess({
        coords: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
        },
      });
      return 1;
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.location).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(result.current.accuracy).toBe(10);
    expect(result.current.error).toBeNull();
    expect(result.current.permissionDenied).toBe(false);
  });

  it('should set permissionDenied to true when user denies location', async () => {
    mockGeolocation.watchPosition.mockImplementation((_, onError) => {
      onError({
        code: 1, // PERMISSION_DENIED
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      return 1;
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.permissionDenied).toBe(true);
    expect(result.current.error).toBe('Location access was denied.');
    expect(result.current.location).toBeNull();
  });

  it('should set error for position unavailable', async () => {
    mockGeolocation.watchPosition.mockImplementation((_, onError) => {
      onError({
        code: 2, // POSITION_UNAVAILABLE
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      return 1;
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.error).toBe('Location information is unavailable. Please try again.');
  });

  it('should set error for timeout', async () => {
    mockGeolocation.watchPosition.mockImplementation((_, onError) => {
      onError({
        code: 3, // TIMEOUT
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      return 1;
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Location request timed out. Please try again.');
  });

  it('should handle missing geolocation API', async () => {
    // Temporarily remove geolocation
    const original = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Geolocation is not supported by your browser.');

    // Restore
    Object.defineProperty(navigator, 'geolocation', {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it('should clear the watcher on unmount', () => {
    const watchId = 42;
    mockGeolocation.watchPosition.mockReturnValue(watchId);

    const { unmount } = renderHook(() => useGeolocation());
    unmount();

    expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(watchId);
  });

  it('should update location when watchPosition fires multiple times', async () => {
    let successCallback;
    mockGeolocation.watchPosition.mockImplementation((onSuccess) => {
      successCallback = onSuccess;
      // Fire first position immediately
      onSuccess({
        coords: { latitude: 40.0, longitude: -74.0, accuracy: 100 },
      });
      return 1;
    });

    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => {
      expect(result.current.location).toEqual({ lat: 40.0, lng: -74.0 });
    });
    expect(result.current.accuracy).toBe(100);

    // Simulate GPS refinement — better accuracy (wrapped in act)
    const { act } = await import('@testing-library/react');
    act(() => {
      successCallback({
        coords: { latitude: 40.7128, longitude: -74.006, accuracy: 5 },
      });
    });

    await waitFor(() => {
      expect(result.current.location).toEqual({ lat: 40.7128, lng: -74.006 });
      expect(result.current.accuracy).toBe(5);
    });
  });

  it('should call watchPosition with enableHighAccuracy', () => {
    mockGeolocation.watchPosition.mockReturnValue(1);

    renderHook(() => useGeolocation());

    expect(mockGeolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({
        enableHighAccuracy: true,
        maximumAge: 0,
      })
    );
  });
});
