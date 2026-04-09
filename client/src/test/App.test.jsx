import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import App from '../App';

// Mock the Google Maps components — they require an API key and browser APIs
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }) => <div data-testid="api-provider">{children}</div>,
  Map: ({ children }) => <div data-testid="google-map">{children}</div>,
  AdvancedMarker: ({ position }) => (
    <div data-testid="map-marker" data-lat={position.lat} data-lng={position.lng} />
  ),
  useMap: () => ({
    panTo: vi.fn(),
    setZoom: vi.fn(),
    getZoom: vi.fn().mockReturnValue(18),
  }),
}));

// Mock the API service
vi.mock('../services/api', () => ({
  saveParking: vi.fn(),
}));

import { saveParking } from '../services/api';

/**
 * Helper to set up geolocation mock.
 */
function mockGeolocation(behavior) {
  const geo = {
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };

  if (behavior === 'success') {
    geo.watchPosition.mockImplementation((onSuccess) => {
      onSuccess({
        coords: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
      });
      return 1;
    });
  } else if (behavior === 'denied') {
    geo.watchPosition.mockImplementation((_, onError) => {
      onError({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      return 1;
    });
  } else if (behavior === 'unavailable') {
    geo.watchPosition.mockImplementation((_, onError) => {
      onError({
        code: 2,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      return 1;
    });
  } else if (behavior === 'loading') {
    geo.watchPosition.mockReturnValue(1);
  }

  navigator.geolocation = geo;
  return geo;
}

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== Rendering Tests =====

  describe('Rendering', () => {
    it('should render the header with app title', async () => {
      mockGeolocation('success');
      render(<App />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Street Parking Notifier');
    });

    it('should show loading spinner while locating', () => {
      mockGeolocation('loading');
      render(<App />);

      expect(screen.getByText('Locating you…')).toBeInTheDocument();
    });

    it('should show the map and buttons when location is available', async () => {
      mockGeolocation('success');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('google-map')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /save current parking/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /recenter/i })).toBeInTheDocument();
    });

    it('should show error message when geolocation fails (non-denied)', async () => {
      mockGeolocation('unavailable');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Location Unavailable')).toBeInTheDocument();
      });

      expect(screen.getByText('Location information is unavailable. Please try again.')).toBeInTheDocument();
    });

    it('should not show the map or buttons when loading', () => {
      mockGeolocation('loading');
      render(<App />);

      expect(screen.queryByTestId('google-map')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save current parking/i })).not.toBeInTheDocument();
    });
  });

  // ===== Permission Denied Modal =====

  describe('Permission Denied Modal', () => {
    it('should show the non-dismissible modal when permission is denied', async () => {
      mockGeolocation('denied');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Location Permission Required')).toBeInTheDocument();
      });
    });

    it('should display instructions for enabling location', async () => {
      mockGeolocation('denied');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('To enable location access:')).toBeInTheDocument();
        expect(screen.getByText('Refresh this page')).toBeInTheDocument();
      });
    });

    it('modal should have proper ARIA attributes', async () => {
      mockGeolocation('denied');
      render(<App />);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'permission-modal-title');
      });
    });

    it('modal should not have a close button', async () => {
      mockGeolocation('denied');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Location Permission Required')).toBeInTheDocument();
      });

      // Ensure there's no close/dismiss button inside the modal
      const dialog = screen.getByRole('dialog');
      const buttons = dialog.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });
  });

  // ===== Save Parking Button =====

  describe('Save Parking Button', () => {
    it('should display "Save Parking" by default', async () => {
      mockGeolocation('success');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Save Parking')).toBeInTheDocument();
      });
    });

    it('should call saveParking API when clicked', async () => {
      mockGeolocation('success');
      saveParking.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Save Parking')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save current parking/i }));

      expect(saveParking).toHaveBeenCalledWith({ lat: 40.7128, lng: -74.006 });
    });

    it('should show "Saving..." while the request is in progress', async () => {
      mockGeolocation('success');
      // Make the save hang so we can check the intermediate state
      saveParking.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Save Parking')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save current parking/i }));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show "Saved!" after successful save', async () => {
      mockGeolocation('success');
      saveParking.mockResolvedValue({ success: true });
      const user = userEvent.setup();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Save Parking')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save current parking/i }));

      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument();
      });
    });

    it('should show "Retry" after a failed save', async () => {
      mockGeolocation('success');
      saveParking.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Save Parking')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /save current parking/i }));

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should be disabled while saving', async () => {
      mockGeolocation('success');
      saveParking.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Save Parking')).toBeInTheDocument();
      });

      const btn = screen.getByRole('button', { name: /save current parking/i });
      await user.click(btn);

      expect(btn).toBeDisabled();
    });
  });

  // ===== Recenter Button =====

  describe('Recenter Button', () => {
    it('should render the recenter button', async () => {
      mockGeolocation('success');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /recenter/i })).toBeInTheDocument();
      });
    });

    it('should be clickable without error', async () => {
      mockGeolocation('success');
      const user = userEvent.setup();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /recenter/i })).toBeInTheDocument();
      });

      // Should not throw
      await user.click(screen.getByRole('button', { name: /recenter/i }));
    });
  });

  // ===== Accessibility Tests =====

  describe('Accessibility', () => {
    it('should pass automated axe accessibility checks (WCAG)', async () => {
      mockGeolocation('success');
      const { container } = render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('google-map')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have exactly one h1 heading', async () => {
      mockGeolocation('success');
      render(<App />);

      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
    });

    it('all buttons should have accessible names', async () => {
      mockGeolocation('success');
      render(<App />);

      await waitFor(() => {
        expect(screen.getByTestId('google-map')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        // Each button must have an accessible name (via text content or aria-label)
        expect(button).toHaveAccessibleName();
      });
    });

    it('toast area should have correct ARIA role and live region', async () => {
      mockGeolocation('success');
      render(<App />);

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'polite');
    });

    it('save button should have a unique ID for testing', async () => {
      mockGeolocation('success');
      render(<App />);

      await waitFor(() => {
        expect(document.getElementById('save-parking-button')).toBeInTheDocument();
      });
    });

    it('recenter button should have a unique ID for testing', async () => {
      mockGeolocation('success');
      render(<App />);

      await waitFor(() => {
        expect(document.getElementById('recenter-button')).toBeInTheDocument();
      });
    });
  });
});
