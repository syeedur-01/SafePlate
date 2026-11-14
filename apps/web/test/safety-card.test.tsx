import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { SafetyCard } from '../src/components/SafetyCard';
import { kacchiAnalysis } from '../src/fixtures/analysis-kacchi';

registerMessages({
  'safety.level.moderate': { en: 'Moderate risk', bn: 'ঝুঁকি মাঝারি' },
  'safety.spoilage-discoloration': {
    en: 'Possible unusual discoloration.',
    bn: 'রঙ বদলে যেতে পারে।',
  },
  'safety.next_steps': { en: 'What you can do next', bn: 'আপনি এখন কী করতে পারেন' },
  'mitigation.discard': { en: 'Discard the food; do not eat it.', bn: 'খাবারটি ফেলে দিন।' },
  'notice.chemical_limit': {
    en: 'This check cannot detect invisible chemical contamination.',
    bn: 'এই যাচাই অদৃশ্য রাসায়নিক দূষণ শনাক্ত করতে পারে না।',
  },
  'evidence.title': { en: 'Why this score?', bn: 'এই স্কোর কেন?' },
  'evidence.source': { en: 'Source', bn: 'উৎস' },
});

const wrap = (ui: ReactElement) => render(<I18nProvider lang="en">{ui}</I18nProvider>);

afterEach(() => {
  cleanup();
});

describe('SafetyCard', () => {
  it('renders the risk score and the always-visible chemical notice', () => {
    wrap(<SafetyCard safety={kacchiAnalysis.safety} />);
    expect(screen.getByText(String(kacchiAnalysis.safety.score))).toBeInTheDocument();
    expect(screen.getByText('Moderate risk')).toBeInTheDocument();
    expect(screen.getByText(/cannot detect invisible chemical contamination/)).toBeInTheDocument();
  });

  it('lists the mitigation steps under the next-steps heading', () => {
    wrap(<SafetyCard safety={kacchiAnalysis.safety} />);
    expect(screen.getByText('What you can do next')).toBeInTheDocument();
    expect(screen.getByText('Discard the food; do not eat it.')).toBeInTheDocument();
  });
});
