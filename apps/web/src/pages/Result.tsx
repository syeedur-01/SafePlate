import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult, Dish, ScanResult } from '@sp/contracts';
import runtimeJson from '@sp/knowledge/data/runtime/runtime.json';
import { Navigate, useLocation } from 'react-router-dom';
import { ForYouCard } from '../components/ForYouCard';
import { NutritionCard } from '../components/NutritionCard';
import { SafetyCard } from '../components/SafetyCard';
import { ShoppingList } from '../components/ShoppingList';
import { SwapList } from '../components/SwapList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useT } from '../i18n/i18n';
import { DEFAULT_HISTORY_STORE, type HistoryStore } from '../state/history-store';
import type { ProfileStore } from '../state/profile-store';
import { getDish, useAnalysis } from '../state/useAnalysis';
import { useProfile } from '../state/useProfile';

const DISH_NAMES = {
  en: Object.fromEntries(runtimeJson.dishes.map((dish) => [dish.id, dish.name_en])),
  bn: Object.fromEntries(runtimeJson.dishes.map((dish) => [dish.id, dish.name_bn])),
};

const INGREDIENT_NAMES = {
  en: Object.fromEntries(runtimeJson.ingredients.map((item) => [item.id, item.name_en])),
  bn: Object.fromEntries(runtimeJson.ingredients.map((item) => [item.id, item.name_bn])),
};

const systemNow = () => new Date();

export interface ResultViewProps {
  analysis: AnalysisResult;
  dish: Dish | null;
  hasProfile: boolean;
  servings: number;
  onServingsChange: (servings: number) => void;
}

/** Returns the result tabs for an analysis with nutrition, swap suggestions and the shopping list. */
export function ResultView({
  analysis,
  dish,
  hasProfile,
  servings,
  onServingsChange,
}: ResultViewProps) {
  const { t, lang } = useT();

  return (
    <Tabs defaultValue="safety" className="space-y-4">
      <TabsList className="w-full">
        <TabsTrigger value="safety" className="flex-1">
          {t('result.tab.safety')}
        </TabsTrigger>
        <TabsTrigger value="foryou" className="flex-1">
          {t('result.tab.foryou')}
        </TabsTrigger>
        <TabsTrigger value="nutrition" className="flex-1">
          {t('result.tab.nutrition')}
        </TabsTrigger>
        <TabsTrigger value="swap" className="flex-1">
          {t('result.tab.swap')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="safety">
        <SafetyCard safety={analysis.safety} />
      </TabsContent>
      <TabsContent value="foryou">
        <ForYouCard warnings={analysis.warnings} hasProfile={hasProfile} />
      </TabsContent>
      <TabsContent value="nutrition">
        <NutritionCard nutrition={analysis.nutrition} dish={dish} />
      </TabsContent>
      <TabsContent value="swap" className="space-y-6">
        <SwapList swaps={analysis.swaps} dishNames={DISH_NAMES[lang]} />
        <ShoppingList
          items={analysis.shoppingList}
          ingredientNames={INGREDIENT_NAMES[lang]}
          servings={servings}
          onServingsChange={onServingsChange}
        />
      </TabsContent>
    </Tabs>
  );
}

interface ResultRouteState {
  scanResult?: ScanResult;
  dishId?: string | null;
  thumbDataUrl?: string | null;
}

export interface ResultProps {
  profileStore?: ProfileStore;
  historyStore?: HistoryStore;
  now?: () => Date;
}

interface ResultAnalysisProps extends ResultProps {
  state: { scanResult: ScanResult; dishId: string | null; thumbDataUrl: string | null };
}

function ResultAnalysis({
  state,
  profileStore,
  historyStore = DEFAULT_HISTORY_STORE,
  now = systemNow,
}: ResultAnalysisProps) {
  const { t, lang } = useT();
  const { profile } = useProfile(profileStore);
  const [servings, setServings] = useState(1);
  const analysis = useAnalysis({
    scanResult: state.scanResult,
    dishId: state.dishId,
    servings,
    profile,
    now,
  });
  const dish = getDish(state.dishId);
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current) {
      return;
    }
    saved.current = true;

    const title =
      dish !== null
        ? (DISH_NAMES[lang][dish.id] ?? dish.name_en)
        : state.scanResult.kind === 'label'
          ? (state.scanResult.productName ?? t('scan.tab.label'))
          : t('confirm.noneOfThese');
    const at = now().toISOString();

    historyStore.add({
      id: `${at}:${state.scanResult.kind}:${state.dishId ?? 'none'}`,
      at,
      dishId: analysis.dishId,
      title,
      score: analysis.safety.score,
      level: analysis.safety.level,
      thumb: state.thumbDataUrl,
    });
  }, [
    analysis.dishId,
    analysis.safety.level,
    analysis.safety.score,
    dish,
    historyStore,
    lang,
    now,
    state,
    t,
  ]);

  return (
    <ResultView
      analysis={analysis}
      dish={dish}
      hasProfile={
        profile.conditions.length > 0 ||
        profile.allergies.length > 0 ||
        profile.consentedAt !== null
      }
      servings={servings}
      onServingsChange={setServings}
    />
  );
}

/** Returns the result page, computing the analysis on the device from the scan held in router state. */
export function Result(props: ResultProps) {
  const state = useLocation().state as ResultRouteState | null;

  if (state?.scanResult === undefined) {
    return <Navigate to="/" replace />;
  }

  return (
    <ResultAnalysis
      state={{
        scanResult: state.scanResult,
        dishId: state.dishId ?? null,
        thumbDataUrl: state.thumbDataUrl ?? null,
      }}
      {...props}
    />
  );
}
