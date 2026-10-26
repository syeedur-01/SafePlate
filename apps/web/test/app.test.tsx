import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App';

describe('App shell', () => {
  it('shows four navigation links', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(4);
  });
});
