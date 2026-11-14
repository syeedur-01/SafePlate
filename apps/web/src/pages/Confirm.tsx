import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { ScanResult } from '@sp/contracts';
import runtimeJson from '@sp/knowledge/data/runtime/runtime.json';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useT } from '../i18n/i18n';
import { filterDishes, type DishOption } from '../lib/filter-dishes';

const DISH_OPTIONS: DishOption[] = runtimeJson.dishes.map(({ id, name_en, name_bn, aliases }) => ({
  id,
  name_en,
  name_bn,
  aliases,
}));

const MIN_CONFIDENCE = 0.5;

export interface ConfirmState {
  result: ScanResult;
  thumbDataUrl: string;
}

/** Returns the confirm-dish screen for picking the dish from a scan result. */
export function Confirm() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ConfirmState | null;
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const result = state?.result ?? null;
  const topCandidate = result?.kind === 'dish' ? result.candidates[0] : undefined;
  const unsure =
    result?.kind === 'dish' &&
    (topCandidate === undefined ||
      topCandidate.dishId === null ||
      topCandidate.confidence < MIN_CONFIDENCE);

  useEffect(() => {
    if (unsure === true) {
      searchRef.current?.focus();
    }
  }, [unsure]);

  if (state === null || result === null) {
    return <Navigate to="/" replace />;
  }

  if (result.kind === 'label') {
    return (
      <Navigate
        to="/result"
        replace
        state={{ scanResult: result, dishId: null, thumbDataUrl: state.thumbDataUrl }}
      />
    );
  }

  const { thumbDataUrl } = state;
  const selectable = result.candidates.filter(
    (candidate): candidate is typeof candidate & { dishId: string } => candidate.dishId !== null,
  );

  function choose(dishId: string | null) {
    navigate('/result', {
      state: { scanResult: result, dishId, thumbDataUrl },
    });
  }

  function optionName(option: DishOption): string {
    return lang === 'bn' ? option.name_bn : option.name_en;
  }

  function candidateName(dishId: string, fallback: string): string {
    const option = DISH_OPTIONS.find((candidate) => candidate.id === dishId);
    return option === undefined ? fallback : optionName(option);
  }

  const matches = filterDishes(query, DISH_OPTIONS, lang);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('confirm.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {unsure === true ? (
            <p role="status">{t('confirm.notSure')}</p>
          ) : (
            <section aria-label={t('confirm.candidates')} className="space-y-2">
              <ul className="space-y-2">
                {selectable.map((candidate, index) => (
                  <li key={candidate.dishId}>
                    {index === 0 ? (
                      <p className="mb-1 text-xs font-semibold uppercase text-fg/70">
                        {t('confirm.bestGuess')}
                      </p>
                    ) : null}
                    <Button
                      variant="secondary"
                      size="lg"
                      className="w-full"
                      onClick={() => choose(candidate.dishId)}
                    >
                      {candidateName(candidate.dishId, candidate.label)}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <label htmlFor="confirm-search" className="text-sm font-semibold">
            {t('confirm.search')}
          </label>
          <input
            id="confirm-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('confirm.searchPlaceholder')}
            className="min-h-11 w-full rounded-md border border-border bg-card px-3 text-base font-normal text-fg"
          />
          {matches.length === 0 ? (
            <p className="text-sm">{t('confirm.noMatches')}</p>
          ) : (
            <ul aria-label={t('confirm.allDishes')} className="max-h-72 space-y-1 overflow-y-auto">
              {matches.map((option) => (
                <li key={option.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => choose(option.id)}
                  >
                    {optionName(option)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" className="w-full" onClick={() => choose(null)}>
            {t('confirm.noneOfThese')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
