import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ScanResult } from '@sp/contracts';
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

  it('rejects a photo of an unsupported type before any request is made', async () => {
    const user = userEvent.setup();
    renderScan();

    await user.upload(
      screen.getByLabelText('Choose a photo'),
      new File(['gif'], 'meal.gif', { type: 'image/gif' }),
    );

    expect(await screen.findByText('Please choose a JPG, PNG or WebP photo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    expect(scan).not.toHaveBeenCalled();
    expect(downscaleToJpeg).not.toHaveBeenCalled();
  });

  it('rejects a photo larger than 10 MB with a size message', async () => {
    const user = userEvent.setup();
    renderScan();

    await user.upload(
      screen.getByLabelText('Choose a photo'),
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
    );

    expect(
      await screen.findByText('That file is too large. Please choose a photo under 10 MB.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    expect(scan).not.toHaveBeenCalled();
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

  it('offers a desktop drag-and-drop zone and a mobile camera/gallery split', () => {
    renderScan();

    expect(screen.getByText('Drag and drop your food image here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse files' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Camera & Take Photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose from Gallery' })).toBeInTheDocument();
    // Camera capture goes through a dedicated input, only after an explicit choice.
    expect(screen.getByLabelText('Open Camera & Take Photo')).toHaveAttribute(
      'capture',
      'environment',
    );
  });

  it('shows a real analyzing overlay and blocks duplicate submissions while the request runs', async () => {
    const user = userEvent.setup();
    let resolveScan: (value: ScanResult) => void = () => {};
    vi.mocked(scan).mockImplementation(
      () =>
        new Promise<ScanResult>((resolve) => {
          resolveScan = resolve;
        }),
    );
    renderScan();

    await user.upload(
      screen.getByLabelText('Choose a photo'),
      new File(['photo'], 'meal.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    // The overlay reflects the real request state and never fakes success.
    expect(await screen.findByText('Analyzing your food…')).toBeInTheDocument();
    const analyzeButton = screen.getByRole('button', { name: 'Analyzing…' });
    expect(analyzeButton).toBeDisabled();

    await act(async () => {
      resolveScan({
        kind: 'dish',
        candidates: [{ dishId: 'kacchi-biryani', label: 'Kacchi Biryani', confidence: 0.8 }],
        observations: { spoilageSigns: [], imageQuality: 'good', notes: '' },
        provider: 'mock',
        cached: false,
      });
    });
  });

  it('removing the selected photo disables Analyze again', async () => {
    const user = userEvent.setup();
    renderScan();

    await user.upload(
      screen.getByLabelText('Choose a photo'),
      new File(['photo'], 'meal.jpg', { type: 'image/jpeg' }),
    );
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Remove photo' }));

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
    expect(scan).not.toHaveBeenCalled();
  });
});
