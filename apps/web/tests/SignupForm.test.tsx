import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../src/i18n/index.js';
import { SignupPage } from '../src/features/auth/SignupPage.js';
import { ToastProvider } from '../src/lib/toast.js';
import { ThemeProvider } from '../src/lib/theme.js';

// The form should never call the API when validation fails.
const signup = vi.fn();
vi.mock('../src/lib/api.js', () => ({ authApi: { signup: (...a: unknown[]) => signup(...a) } }));

describe('SignupPage validation', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    signup.mockReset();
  });

  it('shows a validation error for a weak password and does not submit', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ThemeProvider>
          <ToastProvider>
            <SignupPage />
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('Full name'), 'Test User');
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });
});
