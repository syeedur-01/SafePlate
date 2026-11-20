import { useEffect, useMemo, useRef, useState } from 'react';
import type { Allergen, AnalysisResult, Dish, ScanResult } from '@sp/contracts';
import runtimeJson from '@sp/knowledge/data/runtime/runtime.json';
import { Navigate, useLocation } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ForYouCard } from '../components/ForYouCard';
import { NutritionCard } from '../components/NutritionCard';
import { SafetyCard } from '../components/SafetyCard';
import { ShoppingList } from '../components/ShoppingList';
import { SwapList } from '../components/SwapList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useT } from '../i18n/i18n';
import { buildIngredientBreakdown, type IngredientBreakdown } from '../lib/ingredient-breakdown';
import { DEFAULT_HISTORY_STORE, type HistoryStore } from '../state/history-store';
import type { ProfileStore } from '../state/profile-store';
import { getDish, getIngredient, useAnalysis } from '../state/useAnalysis';
import { useProfile } from '../state/useProfile';

const DISH_NAMES = {
  en: Object.fromEntries(runtimeJson.dishes.map((dish) => [dish.id, dish.name_en])),
  bn: Object.fromEntries(runtimeJson.dishes.map((dish) => [dish.id, dish.name_bn])),
};

const CATALOGUE_NAMES = {
  en: Object.fromEntries(runtimeJson.catalogue.map((entry) => [entry.id, entry.name_en])),
  bn: Object.fromEntries(
    runtimeJson.catalogue.map((entry) => [entry.id, entry.name_bn ?? entry.name_en]),
  ),
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
  title: string;
  thumb: string | null;
  /** Optional id for the title heading, so a caller can label a surrounding section with it. */
  titleId?: string;
  allergens?: Allergen[];
  breakdown?: IngredientBreakdown | null;
}

/** Returns the result tabs for an analysis with nutrition, swap suggestions and the shopping list. */
export function ResultView({
  analysis,
  dish,
  hasProfile,
  servings,
  onServingsChange,
  title,
  thumb,
  titleId,
  allergens,
  breakdown,
}: ResultViewProps) {
  const { t, lang } = useT();

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
        {thumb === null ? (
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-mint text-primary"
          >
            <UtensilsCrossed className="h-6 w-6" />
          </span>
        ) : (
          <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-lg font-semibold text-heading">
            {title}
          </h2>
          <p className="text-xs leading-relaxed text-muted-fg">{t('result.header.source')}</p>
        </div>
      </header>

      <Tabs defaultValue="safety">
        <TabsList className="w-full">
          <TabsTrigger value="safety" className="min-w-[46%] flex-1 sm:min-w-0">
            {t('result.tab.safety')}
          </TabsTrigger>
          <TabsTrigger value="foryou" className="min-w-[46%] flex-1 sm:min-w-0">
            {t('result.tab.foryou')}
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="min-w-[46%] flex-1 sm:min-w-0">
            {t('result.tab.nutrition')}
          </TabsTrigger>
          <TabsTrigger value="swap" className="min-w-[46%] flex-1 sm:min-w-0">
            {t('result.tab.swap')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="safety">
          <SafetyCard safety={analysis.safety} />
        </TabsContent>
        <TabsContent value="foryou">
          <ForYouCard
            warnings={analysis.warnings}
            hasProfile={hasProfile}
            allergens={allergens}
            breakdown={breakdown}
          />
        </TabsContent>
        <TabsContent value="nutrition">
          <NutritionCard
            nutrition={analysis.nutrition}
            dish={dish}
            servings={servings}
            onServingsChange={onServingsChange}
          />
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
    </div>
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

/**
 * Returns the identified-but-unsupported screen: the dish is in the recognition
 * catalogue but has no approved nutrition data, so no score or nutrition is shown.
 */
function IdentifiedNoNutrition({ dishName }: { dishName: string }) {
  const { t } = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{dishName}</CardTitle>
      </CardHeader>
      <CardContent>
        <p role="status">{t('result.noNutrition.body')}</p>
      </CardContent>
    </Card>
  );
}

function ResultAnalysis({
  state,
  profileStore,
  historyStore = DEFAULT_HISTORY_STORE,
  now = systemNow,
}: ResultAnalysisProps) {
  const { lang } = useT();
  const { dishId } = state;
  const dish = dishId === null ? null : getDish(dishId);

  if (state.scanResult.kind === 'dish' && dishId !== null && dish === null) {
    return <IdentifiedNoNutrition dishName={CATALOGUE_NAMES[lang][dishId] ?? dishId} />;
  }

  return (
    <ResultWithAnalysis
      state={state}
      dish={dish}
      profileStore={profileStore}
      historyStore={historyStore}
      now={now}
    />
  );
}

function ResultWithAnalysis({
  state,
  dish,
  profileStore,
  historyStore = DEFAULT_HISTORY_STORE,
  now = systemNow,
}: ResultAnalysisProps & { dish: Dish | null }) {
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
  const saved = useRef(false);

  const breakdown = useMemo(
    () => (dish === null ? null : buildIngredientBreakdown(dish.ingredients, lang, getIngredient)),
    [dish, lang],
  );

  const allergens: Allergen[] | undefined =
    state.scanResult.kind === 'label'
      ? state.scanResult.declaredAllergens
      : (dish?.allergens ?? []);

  const headerTitle =
    dish !== null
      ? (DISH_NAMES[lang][dish.id] ?? dish.name_en)
      : state.scanResult.kind === 'label'
        ? (state.scanResult.productName ?? t('scan.tab.label'))
        : (state.scanResult.candidates[0]?.label ?? t('confirm.noneOfThese'));

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
      title={headerTitle}
      thumb={state.thumbDataUrl}
      allergens={allergens}
      breakdown={breakdown}
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
