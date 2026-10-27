import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { I18nProvider, registerMessages } from '../src/i18n/i18n';
import { RiskGauge } from '../src/components/RiskGauge';
import { EvidenceList } from '../src/components/EvidenceList';
import { NoticeBanner } from '../src/components/NoticeBanner';
import { StatusBadge } from '../src/components/StatusBadge';

registerMessages({
  'safety.level.high': { en: 'High', bn: 'উচ্চ' },
  'safety.level.moderate': { en: 'Moderate', bn: 'মাঝারি' },
  'safety.level.low': { en: 'Low', bn: 'কম' },
  'safety.no_signals': { en: 'No warning signs found', bn: 'কোনো সতর্কতা নেই' },
  'safety.mold': { en: 'Mold visible', bn: 'ছাতা' },
  'notice.chemical_limit': { en: 'This check cannot detect invisible chemicals.', bn: '...' },
  'badge.estimated': { en: 'estimated', bn: 'আনুমানিক' },
  'badge.draft': { en: 'draft rules', bn: 'খসড়া' },
  'evidence.title': { en: 'Why this score?', bn: 'এই স্কোর কেন?' },
  'evidence.source': { en: 'Source', bn: 'উৎস' },
});

const wrap = (ui: ReactElement) => render(<I18nProvider lang="en">{ui}</I18nProvider>);

afterEach(() => {
  cleanup();
});

describe('result components', () => {
  it('gauge shows the score, the level word and an accessible label', () => {
    wrap(<RiskGauge score={72} level="high" />);
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    const label = screen.getByRole('img').getAttribute('aria-label');
    expect(label).toContain('72');
    expect(label).toContain('High');
  });

  it('evidence list shows evidence, points, source, and a draft badge', async () => {
    const user = userEvent.setup();
    wrap(
      <EvidenceList
        rulesStatus="draft"
        signals={[
          {
            ruleId: 'm',
            labelKey: 'safety.mold',
            points: 40,
            evidence: 'Photo shows: visible_mold',
            sourceRef: 'S1',
          },
        ]}
      />,
    );
    expect(screen.getByText('Why this score?')).toBeInTheDocument();
    expect(screen.getByText('draft rules')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Why this score/ }));

    expect(screen.getByText('Mold visible')).toBeInTheDocument();
    expect(screen.getByText(/Photo shows: visible_mold/)).toBeInTheDocument();
    expect(screen.getByText('+40')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('evidence list says so when there are no signals', () => {
    wrap(<EvidenceList rulesStatus="approved" signals={[]} />);
    expect(screen.getByText('No warning signs found')).toBeInTheDocument();
  });

  it('notice banner renders every notice', () => {
    wrap(<NoticeBanner noticeKeys={['notice.chemical_limit']} />);
    expect(screen.getByText(/cannot detect invisible chemicals/)).toBeInTheDocument();
  });

  it('status badge uses the localized estimated and draft labels', () => {
    wrap(
      <>
        <StatusBadge kind="estimated" />
        <StatusBadge kind="draft" />
      </>,
    );
    expect(screen.getByText('estimated')).toBeInTheDocument();
    expect(screen.getByText('draft rules')).toBeInTheDocument();
  });
});
