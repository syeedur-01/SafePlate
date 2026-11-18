import { useState } from 'react';
import type { AnalysisResult } from '@sp/contracts';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useT } from '../i18n/i18n';
import { ResultView } from '../pages/Result';
import { runScenario } from '../demo/run-scenario';
import { SCENARIOS, type Scenario } from '../demo/scenarios';
import { getDish } from '../state/useAnalysis';

interface ActiveRun {
  scenario: Scenario;
  analysis: AnalysisResult;
}

/** Returns the offline demo page where each scripted scenario runs the real engine. */
export function Demo() {
  const { t } = useT();
  const [active, setActive] = useState<ActiveRun | null>(null);
  const [servings, setServings] = useState(1);

  function run(scenario: Scenario) {
    const today = new Date().toISOString().slice(0, 10);
    setActive({ scenario, analysis: runScenario(scenario, today) });
    setServings(scenario.servings);
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="demo-title" className="space-y-2">
        <h1 id="demo-title" className="text-xl font-bold tracking-tight">
          {t('demo.title')}
        </h1>
        <p className="text-sm leading-relaxed text-muted-fg">{t('demo.intro')}</p>
      </section>

      <ul className="space-y-3">
        {SCENARIOS.map((scenario) => (
          <li
            key={scenario.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4"
          >
            <span className="font-semibold">{t(scenario.titleKey)}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t('scan.sample.noAiCall')}</Badge>
              <Button type="button" onClick={() => run(scenario)}>
                {t('demo.run')}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {active === null ? null : (
        <section aria-labelledby="demo-result-title" className="space-y-4">
          <h2 id="demo-result-title" className="text-lg font-semibold">
            {t(active.scenario.titleKey)}
          </h2>
          <ResultView
            analysis={active.analysis}
            dish={getDish(active.scenario.dishId)}
            hasProfile={
              active.scenario.profile.conditions.length > 0 ||
              active.scenario.profile.allergies.length > 0
            }
            servings={servings}
            onServingsChange={setServings}
          />
        </section>
      )}
    </div>
  );
}
