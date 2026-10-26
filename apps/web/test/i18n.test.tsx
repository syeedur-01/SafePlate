import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useT, registerMessages } from '../src/i18n/i18n';

function Show({ k, p }: { k: string; p?: Record<string, string | number> }) {
  const { t } = useT();
  return <span>{t(k, p)}</span>;
}

describe('i18n', () => {
  it('returns the key and warns when missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <I18nProvider lang="en">
        <Show k="no.such.key" />
      </I18nProvider>,
    );
    expect(screen.getByText('no.such.key')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
  });
  it('looks up registered messages per language and fills params', () => {
    registerMessages({ 'test.hello': { en: 'Hello {name}', bn: 'হ্যালো {name}' } });
    const { rerender } = render(
      <I18nProvider lang="en">
        <Show k="test.hello" p={{ name: 'Rima' }} />
      </I18nProvider>,
    );
    expect(screen.getByText('Hello Rima')).toBeInTheDocument();
    rerender(
      <I18nProvider lang="bn">
        <Show k="test.hello" p={{ name: 'Rima' }} />
      </I18nProvider>,
    );
    expect(screen.getByText('হ্যালো Rima')).toBeInTheDocument();
  });
});
