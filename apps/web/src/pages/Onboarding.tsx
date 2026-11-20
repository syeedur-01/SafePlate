import { useState, type FormEvent } from 'react';
import {
  AllergenSchema,
  ConditionSchema,
  EMPTY_PROFILE,
  type Allergen,
  type Condition,
  type UserProfile,
} from '@sp/contracts';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { WelcomeIntro } from '../components/WelcomeIntro';
import { useT } from '../i18n/i18n';
import { cn } from '../lib/cn';
import type { ProfileStore } from '../state/profile-store';

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export interface ProfileFormProps {
  initialProfile: UserProfile;
  now: () => string;
  onSave: (profile: UserProfile) => void;
}

/**
 * Returns the shared profile fields used by onboarding and settings.
 * The language lives in the global header switcher and in Settings, not here.
 */
export function ProfileForm({ initialProfile, now, onSave }: ProfileFormProps) {
  const { t } = useT();
  const [conditions, setConditions] = useState<Condition[]>(initialProfile.conditions);
  const [allergies, setAllergies] = useState<Allergen[]>(initialProfile.allergies);
  const [consent, setConsent] = useState(initialProfile.consentedAt !== null);

  const hasSelection = conditions.length > 0 || allergies.length > 0;
  const canSave = !hasSelection || consent;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    onSave({
      conditions,
      allergies,
      language: initialProfile.language,
      consentedAt: consent ? now() : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-heading">{t('onboarding.conditions')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ConditionSchema.options.map((condition) => (
            <label
              key={condition}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
                conditions.includes(condition)
                  ? 'border-primary bg-mint font-medium'
                  : 'border-border bg-card hover:border-primary',
              )}
            >
              <input
                type="checkbox"
                checked={conditions.includes(condition)}
                onChange={() => setConditions((current) => toggleValue(current, condition))}
                className="h-5 w-5 accent-primary"
              />
              <span>{t(`condition.${condition}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-heading">{t('onboarding.allergies')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AllergenSchema.options.map((allergen) => (
            <label
              key={allergen}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
                allergies.includes(allergen)
                  ? 'border-primary bg-mint font-medium'
                  : 'border-border bg-card hover:border-primary',
              )}
            >
              <input
                type="checkbox"
                checked={allergies.includes(allergen)}
                onChange={() => setAllergies((current) => toggleValue(current, allergen))}
                className="h-5 w-5 accent-primary"
              />
              <span>{t(`allergen.${allergen}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-soft px-3 py-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-5 w-5 accent-primary"
        />
        <span>{t('onboarding.consent')}</span>
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!canSave}>
          {t('onboarding.save')}
        </Button>
      </div>
    </form>
  );
}

export interface OnboardingProps {
  store: ProfileStore;
  now: () => string;
  onDone: () => void;
}

/** Returns the welcome landing that opens into the first-run profile form. */
export function Onboarding({ store, now, onDone }: OnboardingProps) {
  const { t, lang } = useT();
  const [step, setStep] = useState<'intro' | 'form'>('intro');
  const [initialProfile] = useState<UserProfile>(() => store.load());

  if (step === 'intro') {
    return (
      <WelcomeIntro
        onCreate={() => setStep('form')}
        onSkip={() => {
          store.save({
            ...EMPTY_PROFILE,
            language: lang,
            conditions: [],
            allergies: [],
            consentedAt: null,
          });
          onDone();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setStep('intro')}
        className="-ml-3 gap-1.5 text-muted-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t('welcome.back')}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t('onboarding.title')}</CardTitle>
          <p className="text-sm leading-relaxed text-muted-fg">{t('onboarding.intro')}</p>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialProfile={initialProfile}
            now={now}
            onSave={(profile) => {
              store.save(profile);
              onDone();
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
