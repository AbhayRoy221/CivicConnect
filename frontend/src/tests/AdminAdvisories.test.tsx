// @ts-nocheck
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminAdvisories from '../pages/AdminAdvisories';
import { api } from '../services/api';

// Mock dependencies
vi.mock('../services/api', () => ({
  api: vi.fn()
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin1', role: 'administrator', name: 'Admin' },
    token: 'fake-token',
  })
}));

describe('AdminAdvisories Form Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the initial data fetches
    (api as any).mockImplementation((url: string) => {
      if (url === '/advisories') return Promise.resolve([]);
      if (url === '/categories') return Promise.resolve([
        { id: 'cat-uuid-1', name: 'Pothole / Road Damage' }
      ]);
      if (url === '/pune-wards') return Promise.resolve([
        { id: 'ward-uuid-1', ward_number: 39, ward_name: null }
      ]);
      return Promise.resolve();
    });
  });

  it('displays human-readable labels and submits UUIDs', async () => {
    render(<AdminAdvisories />);

    // Wait for the mock data to load
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/categories', 'fake-token');
      expect(api).toHaveBeenCalledWith('/pune-wards', 'fake-token');
    });

    // Click "New Advisory" to show the form
    fireEvent.click(screen.getByText('New Advisory'));

    // Check if the select options have human readable names
    const categorySelect = screen.getByText('Category (Optional)').nextElementSibling as HTMLElement;
    const wardSelect = screen.getByText('Target Ward (Optional)').nextElementSibling as HTMLElement;

    expect(screen.getByText('Pothole / Road Damage')).toBeInTheDocument();
    expect(screen.getByText('Ward 39')).toBeInTheDocument();

    fireEvent.change(screen.getByText('Title').nextElementSibling as HTMLElement, { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByText('Description').nextElementSibling as HTMLElement, { target: { value: 'Test Description' } });
    fireEvent.change(screen.getByText('Starts At (Optional)').nextElementSibling as HTMLElement, { target: { value: '2026-01-01T10:00' } });
    fireEvent.change(screen.getByText('Expires At (Optional)').nextElementSibling as HTMLElement, { target: { value: '2026-01-02T10:00' } });

    // Select specific values
    fireEvent.change(categorySelect, { target: { value: 'cat-uuid-1' } });
    fireEvent.change(wardSelect, { target: { value: 'ward-uuid-1' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Publish Advisory/i }));

    // Verify submission payload
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/advisories', 'fake-token', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"category_id":"cat-uuid-1"')
      }));
      expect(api).toHaveBeenCalledWith('/advisories', 'fake-token', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"ward_id":"ward-uuid-1"')
      }));
    });
  });

  it('submits null when Global options are selected', async () => {
    render(<AdminAdvisories />);

    // Wait for the mock data to load
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/categories', 'fake-token');
    });

    fireEvent.click(screen.getByText('New Advisory'));

    fireEvent.change(screen.getByText('Title').nextElementSibling as HTMLElement, { target: { value: 'Global Alert' } });
    fireEvent.change(screen.getByText('Description').nextElementSibling as HTMLElement, { target: { value: 'Global Desc' } });
    fireEvent.change(screen.getByText('Starts At (Optional)').nextElementSibling as HTMLElement, { target: { value: '2026-01-01T10:00' } });
    fireEvent.change(screen.getByText('Expires At (Optional)').nextElementSibling as HTMLElement, { target: { value: '2026-01-02T10:00' } });

    // Keep the selects empty ("" value) which means Global
    const categorySelect = screen.getByText('Category (Optional)').nextElementSibling as HTMLElement;
    const wardSelect = screen.getByText('Target Ward (Optional)').nextElementSibling as HTMLElement;
    fireEvent.change(categorySelect, { target: { value: '' } });
    fireEvent.change(wardSelect, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /Publish Advisory/i }));

    await waitFor(() => {
      const call = (api as any).mock.calls.find((c: any) => c[0] === '/advisories' && c[2]?.method === 'POST');
      expect(call).toBeTruthy();
      const body = JSON.parse(call[2].body);
      expect(body.category_id).toBeNull();
      expect(body.ward_id).toBeNull();
    });
  });
});
