import { useState } from 'react';
import type { AnalysisResult, Dish } from '@sp/contracts';
import runtimeJson from '@sp/knowledge/data/runtime/runtime.json';
import { Navigate, useLocation } from 'react-router-dom';
import { ForYouCard } from '../components/ForYouCard';
import { SafetyCard } from '../components/SafetyCard';
import { ShoppingList } from '../components/ShoppingList';
import { SwapList } from '../components/SwapList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useT } from '../i18n/i18n';

const DISH_NAMES = {
  en: Object.fromEntries(runtimeJson.dishes.map((dish) => [dish.id, dish.name_en])),
  bn: Object.fromEntries(runtimeJson.dishes.map((dish) => [dish.id, dish.name_bn])),
};

const INGREDIENT_NAMES = {
  en: Object.fromEntries(runtimeJson.ingredients.map((item) => [item.id, item.name_en])),
  bn: Object.fromEntries(runtimeJson.ingredients.map((item) => [item.id, item.name_bn])),
};

export interface ResultViewProps {
  analysis: AnalysisResult;
  dish: Dish | null;
  hasProfile: boolean;
}

/** Returns the result tabs for an analysis, with safety, personalized warnings, swaps and the shopping list. */
export function ResultView({ analysis, hasProfile }: ResultViewProps) {
  const { t, lang } = useT();
  const [servings, setServings] = useState(1);

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
        <p className="text-sm">{t('result.coming_soon')}</p>
      </TabsContent>
      <TabsContent value="swap" className="space-y-6">
        <SwapList swaps={analysis.swaps} dishNames={DISH_NAMES[lang]} />
        <ShoppingList
          items={analysis.shoppingList}
          ingredientNames={INGREDIENT_NAMES[lang]}
          servings={servings}
          onServingsChange={setServings}
        />
      </TabsContent>
    </Tabs>
  );
}

interface ResultRouteState {
  analysis?: AnalysisResult;
  dish?: Dish | null;
  hasProfile?: boolean;
}

/** Returns the result page, which renders the result view for the analysis held in router state. */
export function Result() {
  const state = useLocation().state as ResultRouteState | null;

  if (state?.analysis === undefined) {
    return <Navigate to="/" replace />;
  }

  return (
    <ResultView
      analysis={state.analysis}
      dish={state.dish ?? null}
      hasProfile={state.hasProfile ?? false}
    />
  );
}
