import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../src/components/ui/button';
import { Badge } from '../src/components/ui/badge';

describe('ui components', () => {
  it('button has a 44px minimum height class', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).className).toContain('min-h-11');
  });
  it('badge renders its text', () => {
    render(<Badge>estimated</Badge>);
    expect(screen.getByText('estimated')).toBeInTheDocument();
  });
});
