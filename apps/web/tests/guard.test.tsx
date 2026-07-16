import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { AuthUser } from '@studyshare/shared';
import { RequireAuth } from '../src/components/RouteGuards.js';

// Control the auth state per test.
const mockAuth = vi.fn();
vi.mock('../src/lib/auth.js', () => ({
  useAuth: () => mockAuth(),
}));

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>secret content</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('redirects unauthenticated users to /login', () => {
    mockAuth.mockReturnValue({ user: null, loading: false });
    renderGuarded();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders protected content for an authenticated user', () => {
    mockAuth.mockReturnValue({
      user: { id: 'u1', role: 'STUDENT' } as AuthUser,
      loading: false,
    });
    renderGuarded();
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
