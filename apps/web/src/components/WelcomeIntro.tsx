import {
  ArrowRight,
  Camera,
  Compass,
  HeartPulse,
  Salad,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useT } from '../i18n/i18n';
import { Logo } from './Logo';

const CAPABILITIES = [
  { key: 'welcome.capability.scan', Icon: Camera },
  { key: 'welcome.capability.safety', Icon: ShieldCheck },
  { key: 'welcome.capability.nutrition', Icon: Salad },
  { key: 'welcome.capability.personal', Icon: HeartPulse },
] as const;

export interface WelcomeIntroProps {
  onCreate: () => void;
  onSkip: () => void;
}

/** Returns the welcome landing: logo, introduction and the two ways to start. */
export function WelcomeIntro({ onCreate, onSkip }: WelcomeIntroProps) {
  const { t } = useT();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center space-y-8 py-6 text-center">
      <div className="sp-anim-logo-in">
        <Logo className="h-16 sm:h-20" />
      </div>

      <div className="sp-anim-fade-up space-y-3" style={{ animationDelay: '0.15s' }}>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('welcome.tagline')}</h1>
        <p className="text-base leading-relaxed text-muted-fg">{t('welcome.intro')}</p>
      </div>

      <ul className="sp-anim-fade-up w-full space-y-3 text-left" style={{ animationDelay: '0.3s' }}>
        {CAPABILITIES.map(({ key, Icon }) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-primary">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="text-sm leading-relaxed">{t(key)}</span>
          </li>
        ))}
      </ul>

      <div
        className="sp-anim-fade-up grid w-full gap-3 sm:grid-cols-2"
        style={{ animationDelay: '0.45s' }}
      >
        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-11 flex-col items-start gap-1 rounded-2xl border border-primary bg-mint p-4 text-left transition-all hover:bg-primary hover:text-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className="flex items-center gap-2 text-base font-semibold">
            <UserPlus aria-hidden="true" className="h-5 w-5" />
            {t('welcome.createTitle')}
          </span>
          <span className="text-sm leading-snug opacity-90">{t('welcome.createBody')}</span>
          <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 self-end" />
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="flex min-h-11 flex-col items-start gap-1 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className="flex items-center gap-2 text-base font-semibold text-heading">
            <Compass aria-hidden="true" className="h-5 w-5" />
            {t('welcome.skipTitle')}
          </span>
          <span className="text-sm leading-snug text-muted-fg">{t('welcome.skipBody')}</span>
          <ArrowRight aria-hidden="true" className="mt-1 h-4 w-4 self-end text-primary" />
        </button>
      </div>

      <p
        role="note"
        className="rounded-xl bg-surface-soft px-4 py-3 text-xs leading-relaxed text-muted-fg"
      >
        {t('onboarding.intro')}
      </p>
    </div>
  );
}
