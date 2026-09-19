// @ts-nocheck
/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Leaderboard } from '../pages/Leaderboard';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import { BrowserRouter } from 'react-router-dom';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: vi.fn(),
}));

const mockLeaderboard = [
  { user_id: '1', user_name: 'Aditi Deshmukh', points: 450, complaints_resolved: 9 },
  { user_id: '2', user_name: 'Rahul Kadam', points: 320, complaints_resolved: 6 },
  { user_id: '3', user_name: 'Sneha Patil', points: 280, complaints_resolved: 5 },
  { user_id: '4', user_name: 'Amit Joshi', points: 240, complaints_resolved: 4 },
  { user_id: '5', user_name: 'Pooja Kale', points: 200, complaints_resolved: 4 },
];

describe('Leaderboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api as any).mockImplementation((path: string) => {
      if (path === '/leaderboard') return Promise.resolve(mockLeaderboard);
      if (path === '/advisories?active_only=true') return Promise.resolve([]);
      return Promise.resolve();
    });
  });

  const renderPage = () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Leaderboard />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('renders top three on the podium', async () => {
    renderPage();

    await waitFor(() => {
      // 1st place
      expect(screen.getByText('Aditi Deshmukh')).toBeInTheDocument();
      expect(screen.getByText('450')).toBeInTheDocument();

      // 2nd place
      expect(screen.getByText('Rahul Kadam')).toBeInTheDocument();
      expect(screen.getByText('320')).toBeInTheDocument();

      // 3rd place
      expect(screen.getByText('Sneha Patil')).toBeInTheDocument();
      expect(screen.getByText('280')).toBeInTheDocument();
    });
  });

  it('renders others in the table', async () => {
    renderPage();

    await waitFor(() => {
      // 4th place
      expect(screen.getByText('Amit Joshi')).toBeInTheDocument();
      expect(screen.getByText('240')).toBeInTheDocument();

      // 5th place
      expect(screen.getByText('Pooja Kale')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });
  });

  it('displays correct empty state if no points earned', async () => {
    (api as any).mockImplementation((path: string) => {
      if (path === '/leaderboard') return Promise.resolve([]);
      if (path === '/advisories?active_only=true') return Promise.resolve([]);
      return Promise.resolve();
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No civic points earned yet')).toBeInTheDocument();
      expect(screen.getByText('Leaderboard data will appear as citizens contribute to the community.')).toBeInTheDocument();
    });
  });
});
