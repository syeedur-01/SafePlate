import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../src/i18n/i18n';
import { Scan } from '../src/pages/Scan';
import { scan, ApiClientError } from '../src/api/client';
import { downscaleToJpeg } from '../src/lib/downscale';

vi.mock('../src/lib/downscale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/downscale')>();
  return { ...actual, downscaleToJpeg: vi.fn() };
});

vi.mock('../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client')>();
  return { ...actual, scan: vi.fn() };
});

function renderScan() {
  render(
    <I18nProvider lang="en">
      <MemoryRouter initialEntries={['/']}>
        <Scan />
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(downscaleToJpeg).mockResolvedValue({
    base64: 'A'.repeat(200),
    mimeType: 'image/jpeg',
  });
});

afterEach(() => {
  cleanup();
});

describe('Scan page', () => {
  it('disables Analyze until a photo is chosen', async () => {
    const user = userEvent.setup();
    renderScan();

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();

    await user.upload(
      screen.getByLabelText('Choose a photo'),
      new File(['photo'], 'meal.jpg', { type: 'image/jpeg' }),
    );

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeEnabled();
  });

  it('hides the cooked-hours field for label scans', async () => {
    const user = userEvent.setup();
    renderScan();

    expect(screen.getByLabelText('Hours since cooked')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Label' }));

    expect(screen.queryByLabelText('Hours since cooked')).not.toBeInTheDocument();
  });

  it('shows an error message and Retry when the scan fails', async () => {
    const user = userEvent.setup();
    vi.mocked(scan).mockRejectedValue(new ApiClientError('ai_unavailable', 'x'));
    renderScan();

    await user.upload(
      screen.getByLabelText('Choose a photo'),
      new File(['photo'], 'meal.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(
      await screen.findByText('Could not analyze the photo. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
