import { useCallback, useEffect, useMemo, useState } from 'react';
import { NH_CONFIG } from '../../config/constants';
import {
  copyDayToDays,
  getDayProgress,
  getMealKey,
  getNextMealNavLabel,
  isDayComplete,
  isLastMealSlot,
  isMealSlotComplete,
  isNoneMeal,
  mealHasItems,
  NH_MEAL_TYPES
} from '../../utils/nursingHomeOrderUtils';

const DAYS_OF_WEEK = NH_CONFIG.MEALS.DAYS;

const draftHasContent = (draft) => {
  if (!draft) return false;
  if (draft.none) return true;
  return Array.isArray(draft.items) && draft.items.length > 0;
};

/**
 * Shared weekly meal builder state for create + edit order screens.
 */
export default function useWeeklyMealBuilder(initialMeals = {}) {
  const [meals, setMeals] = useState(initialMeals);
  const [drafts, setDrafts] = useState({});
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [isDirty, setIsDirty] = useState(false);
  const [highlightSummary, setHighlightSummary] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState([]);

  const replaceMeals = useCallback((nextMeals, { markDirty = true } = {}) => {
    setMeals(nextMeals || {});
    setDrafts({});
    if (markDirty) setIsDirty(true);
    else setIsDirty(false);
  }, []);

  const markClean = useCallback(() => setIsDirty(false), []);

  const mealKey = getMealKey(selectedDay, selectedMealType);
  const committedMeal = meals[mealKey];
  const initialMealForForm = drafts[mealKey] ?? committedMeal ?? null;

  const handleDraftChange = useCallback((day, mealType, draft) => {
    const key = getMealKey(day, mealType);
    setDrafts((prev) => {
      if (!draftHasContent(draft)) {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          day,
          mealType,
          items: draft.none ? [] : (draft.items || []),
          bagelType: draft.none ? null : (draft.bagelType || null),
          none: !!draft.none
        }
      };
    });
    if (draftHasContent(draft)) setIsDirty(true);
  }, []);

  const handleMealCommit = useCallback((day, mealType, items, bagelType = null, none = false) => {
    const key = getMealKey(day, mealType);
    setMeals((prev) => ({
      ...prev,
      [key]: {
        day,
        mealType,
        items: none ? [] : items,
        bagelType: none ? null : bagelType,
        none: !!none
      }
    }));
    setDrafts((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleMealClear = useCallback((day, mealType) => {
    const key = getMealKey(day, mealType);
    setMeals((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDrafts((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setIsDirty(true);
  }, []);

  const advanceToNextSlot = useCallback(() => {
    const mealIndex = NH_MEAL_TYPES.indexOf(selectedMealType);
    if (mealIndex < NH_MEAL_TYPES.length - 1) {
      setSelectedMealType(NH_MEAL_TYPES[mealIndex + 1]);
      return;
    }
    const dayIndex = DAYS_OF_WEEK.indexOf(selectedDay);
    if (dayIndex < DAYS_OF_WEEK.length - 1) {
      setSelectedDay(DAYS_OF_WEEK[dayIndex + 1]);
      setSelectedMealType('breakfast');
      return;
    }
    setHighlightSummary(true);
    requestAnimationFrame(() => {
      document.querySelector('.order-summary')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('nh-order-submit')?.focus();
    });
  }, [selectedDay, selectedMealType]);

  const jumpToMeal = useCallback((day, mealType) => {
    setSelectedDay(day);
    setSelectedMealType(mealType);
  }, []);

  const lastSlot = isLastMealSlot(selectedDay, selectedMealType, DAYS_OF_WEEK, NH_MEAL_TYPES);
  const nextLabel = getNextMealNavLabel(selectedDay, selectedMealType, DAYS_OF_WEEK, NH_MEAL_TYPES);

  const mealSlotFilled = useCallback(
    (day, mealType) => isMealSlotComplete(meals[getMealKey(day, mealType)]),
    [meals]
  );

  const totalMeals = useMemo(
    () => Object.values(meals).filter((meal) => mealHasItems(meal)).length,
    [meals]
  );

  const buildMealArray = useCallback(
    () => Object.values(meals).filter((meal) => mealHasItems(meal) || isNoneMeal(meal)),
    [meals]
  );

  const dayIsComplete = useCallback((day) => isDayComplete(meals, day), [meals]);
  const dayProgress = useCallback((day) => getDayProgress(meals, day), [meals]);

  const sourceDayCopyable = dayIsComplete(selectedDay);

  const openCopyPanel = useCallback(() => {
    setCopyTargets(DAYS_OF_WEEK.filter((d) => d !== selectedDay));
    setCopyOpen(true);
  }, [selectedDay]);

  const applyCopyDay = useCallback(() => {
    if (!sourceDayCopyable || copyTargets.length === 0) return;
    setMeals((prev) => copyDayToDays(prev, selectedDay, copyTargets));
    setDrafts((prev) => {
      const next = { ...prev };
      copyTargets.forEach((day) => {
        NH_MEAL_TYPES.forEach((mealType) => {
          delete next[getMealKey(day, mealType)];
        });
      });
      return next;
    });
    setIsDirty(true);
    setCopyOpen(false);
  }, [copyTargets, selectedDay, sourceDayCopyable]);

  const confirmLeave = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved meal changes. Leave this page anyway?');
  }, [isDirty]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!highlightSummary) return undefined;
    const timer = window.setTimeout(() => setHighlightSummary(false), 2500);
    return () => window.clearTimeout(timer);
  }, [highlightSummary]);

  return {
    DAYS_OF_WEEK,
    MEAL_TYPES: NH_MEAL_TYPES,
    meals,
    drafts,
    selectedDay,
    setSelectedDay,
    selectedMealType,
    setSelectedMealType,
    isDirty,
    markClean,
    replaceMeals,
    initialMealForForm,
    committedMeal,
    handleDraftChange,
    handleMealCommit,
    handleMealClear,
    advanceToNextSlot,
    jumpToMeal,
    nextLabel,
    isLastSlot: lastSlot,
    mealSlotFilled,
    totalMeals,
    buildMealArray,
    dayIsComplete,
    dayProgress,
    sourceDayCopyable,
    copyOpen,
    setCopyOpen,
    copyTargets,
    setCopyTargets,
    openCopyPanel,
    applyCopyDay,
    confirmLeave,
    highlightSummary
  };
}
