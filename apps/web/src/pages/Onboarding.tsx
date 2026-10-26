import { useId, useState, type FormEvent } from 'react';
import {
  AllergenSchema,
  ConditionSchema,
  EMPTY_PROFILE,
  type Allergen,
  type Condition,
  type UserProfile,
} from '@sp/contracts';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT, type Lang } from '../i18n/i18n';
import { cn } from '../lib/cn';
import type { ProfileStore } from '../state/profile-store';

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export interface ProfileFormProps {
  initialProfile: UserProfile;
  now: () => string;
  onSave: (profile: UserProfile) => void;
  onSkip?: (language: Lang) => void;
}

/** Returns the shared profile fields used by onboarding and settings. */
export function ProfileForm({ initialProfile, now, onSave, onSkip }: ProfileFormProps) {
  const { t } = useT();
  const formId = useId();
  const [language, setLanguage] = useState<Lang>(initialProfile.language);
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
      language,
      consentedAt: consent ? now() : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('onboarding.language')}</legend>
        <div className="flex flex-wrap gap-2">
          {(['en', 'bn'] as const).map((value) => (
            <label
              key={value}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
                language === value ? 'border-primary bg-muted font-medium' : 'border-border',
              )}
            >
              <input
                type="radio"
                name={`${formId}-language`}
                value={value}
                checked={language === value}
                onChange={() => setLanguage(value)}
                className="h-5 w-5 accent-primary"
              />
              <span>{t(`language.${value}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('onboarding.conditions')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ConditionSchema.options.map((condition) => (
            <label
              key={condition}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
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
        <legend className="text-sm font-semibold">{t('onboarding.allergies')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AllergenSchema.options.map((allergen) => (
            <label
              key={allergen}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
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

      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-3 text-sm">
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
        {onSkip === undefined ? null : (
          <Button type="button" variant="secondary" onClick={() => onSkip(language)}>
            {t('onboarding.skip')}
          </Button>
        )}
      </div>
    </form>
  );
}

export interface OnboardingProps {
  store: ProfileStore;
  now: () => string;
  onDone: () => void;
}

/** Returns the first-run privacy onboarding form. */
export function Onboarding({ store, now, onDone }: OnboardingProps) {
  const { t } = useT();
  const [initialProfile] = useState<UserProfile>(() => store.load());

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('onboarding.title')}</CardTitle>
        <p className="text-sm leading-relaxed">{t('onboarding.intro')}</p>
      </CardHeader>
      <CardContent>
        <ProfileForm
          initialProfile={initialProfile}
          now={now}
          onSave={(profile) => {
            store.save(profile);
            onDone();
          }}
          onSkip={(language) => {
            store.save({
              ...EMPTY_PROFILE,
              language,
              conditions: [],
              allergies: [],
              consentedAt: null,
            });
            onDone();
          }}
        />
      </CardContent>
    </Card>
  );
}
