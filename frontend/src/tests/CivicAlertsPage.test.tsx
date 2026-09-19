// @ts-nocheck
/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CivicAlertsPage } from '../pages/CivicAlertsPage';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { BrowserRouter } from 'react-router-dom';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: vi.fn(),
}));

const mockAdvisories = [
  {
    id: '1',
    public_id: 'ADV-0001',
    title: 'Water cut in Downtown',
    description: 'No water from 10 AM to 5 PM',
    category_id: 'cat-1',
    ward_id: 'ward-1',
    starts_at: '2023-10-01T10:00:00Z',
    expires_at: '2023-10-01T17:00:00Z',
    status: 'ACTIVE'
  },
  {
    id: '2',
    public_id: 'ADV-0002',
    title: 'Road repair on Main St',
    description: 'Traffic diversion due to road repair',
    category_id: null,
    ward_id: null, // Global
    starts_at: '2023-10-02T10:00:00Z',
    expires_at: '2023-10-05T17:00:00Z',
    status: 'ACTIVE'
  }
];

const mockCategories = [{ id: 'cat-1', name: 'Water Supply' }];
const mockWards = [{ id: 'ward-1', ward_number: 1, ward_name: null }];

describe('CivicAlertsPage Filters & Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api as any).mockImplementation((path: string) => {
      if (path === '/advisories?active_only=true') return Promise.resolve(mockAdvisories);
      if (path === '/categories') return Promise.resolve(mockCategories);
      if (path === '/pune-wards') return Promise.resolve(mockWards);
      return Promise.resolve();
    });
  });

  const renderPage = () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <CivicAlertsPage />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('renders all active advisories by default', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Water cut in Downtown')).toBeInTheDocument();
      expect(screen.getByText('Road repair on Main St')).toBeInTheDocument();
    });
  });

  it('filters by search query', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Water cut in Downtown')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search alerts by title or description...');
    fireEvent.change(searchInput, { target: { value: 'Road' } });

    expect(screen.queryByText('Water cut in Downtown')).not.toBeInTheDocument();
    expect(screen.getByText('Road repair on Main St')).toBeInTheDocument();
  });

  it('filters by category', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Water cut in Downtown')).toBeInTheDocument();
    });

    // The second combobox is the category filter
    const selects = screen.getAllByRole('combobox');
    const categorySelect = selects[1];

    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    expect(screen.getByText('Water cut in Downtown')).toBeInTheDocument();
    expect(screen.queryByText('Road repair on Main St')).not.toBeInTheDocument();
  });

  it('filters by ward (Global remains visible)', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Water cut in Downtown')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const wardSelect = selects[0];

    // Filter by specific ward
    fireEvent.change(wardSelect, { target: { value: 'ward-1' } });

    // Both should be visible since global advisories (ward_id = null) remain visible
    expect(screen.getByText('Water cut in Downtown')).toBeInTheDocument();
    expect(screen.getByText('Road repair on Main St')).toBeInTheDocument();
  });

  it('opens AdvisoryModal on Read Full Advisory click', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Water cut in Downtown')).toBeInTheDocument();
    });

    const buttons = screen.getAllByText('Read Full Advisory →');
    fireEvent.click(buttons[0]);

    // Modal opens, we should see the Starts time etc.
    expect(screen.getByText('Starts')).toBeInTheDocument();
  });
});
