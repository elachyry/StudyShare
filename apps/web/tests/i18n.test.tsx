import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../src/i18n/index.js';
import { LanguageSwitcher } from '../src/components/layout/LanguageSwitcher.js';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('switches the active language and updates <html lang>', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);
    expect(screen.getByText('en')).toBeInTheDocument();

    await user.click(screen.getByRole('button'));
    expect(i18n.language).toBe('fr');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(screen.getByText('fr')).toBeInTheDocument();
  });
});
