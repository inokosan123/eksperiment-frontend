import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  deleteMonthlyGoal as dbDeleteGoal,
  listMonthlyGoals,
  upsertMonthlyGoal,
  type MonthlyGoal,
} from '@/components/inner-tools/monthlyGoalsDb';

type MonthlyGoalsContextValue = {
  ready: boolean;
  goals: MonthlyGoal[];
  goalsByMonth: Record<string, MonthlyGoal[]>;
  refresh: () => Promise<void>;
  addGoal: (month: string, text: string) => Promise<MonthlyGoal | null>;
  updateGoal: (goal: MonthlyGoal) => Promise<MonthlyGoal>;
  toggleGoal: (id: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
};

const MonthlyGoalsContext = createContext<MonthlyGoalsContextValue | null>(null);

function indexByMonth(goals: MonthlyGoal[]) {
  const indexed = goals.reduce<Record<string, MonthlyGoal[]>>((acc, goal) => {
    if (!acc[goal.month]) acc[goal.month] = [];
    acc[goal.month].push(goal);
    return acc;
  }, {});
  Object.keys(indexed).forEach(month => {
    indexed[month] = sortMonthlyGoals(indexed[month]);
  });
  return indexed;
}

// Open intentions always lead. Completed goals stay in the month's record,
// but settle below every open item so Home never hides unfinished work.
export function sortMonthlyGoals(goals: MonthlyGoal[]) {
  return [...goals].sort((left, right) => (
    Number(left.isCompleted) - Number(right.isCompleted)
    || left.sortOrder - right.sortOrder
    || left.createdAt - right.createdAt
  ));
}

function reindexMonthlyGoals(goals: MonthlyGoal[]) {
  return sortMonthlyGoals(goals).map((goal, index) => ({ ...goal, sortOrder: index }));
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isPastMonth(month: string) {
  return month < currentMonthKey();
}

export function MonthlyGoalsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);

  const refresh = useCallback(async () => {
    try {
      const rows = await listMonthlyGoals();
      setGoals(rows);
    } catch (error) {
      console.warn('Monthly goals refresh failed', error);
      setGoals([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await listMonthlyGoals();
        if (!active) return;
        setGoals(rows);
      } catch (error) {
        console.warn('Monthly goals init failed', error);
        if (!active) return;
        setGoals([]);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const goalsByMonth = useMemo(() => indexByMonth(goals), [goals]);

  const addGoal = useCallback(async (month: string, text: string) => {
    if (isPastMonth(month)) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    const existingForMonth = goals.filter(g => g.month === month);
    const goal: MonthlyGoal = {
      id: `mg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      month,
      text: trimmed,
      isCompleted: false,
      sortOrder: existingForMonth.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setGoals(prev => [...prev, goal]);
    const saved = await upsertMonthlyGoal(goal);
    setGoals(prev => prev.map(g => g.id === saved.id ? saved : g));
    return saved;
  }, [goals]);

  const updateGoal = useCallback(async (goal: MonthlyGoal) => {
    if (isPastMonth(goal.month)) return goal;
    setGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
    const saved = await upsertMonthlyGoal(goal);
    setGoals(prev => prev.map(g => g.id === saved.id ? saved : g));
    return saved;
  }, []);

  const toggleGoal = useCallback(async (id: string) => {
    const target = goals.find(g => g.id === id);
    if (!target) return;
    const reorderedMonth = reindexMonthlyGoals(
      goals
        .filter(goal => goal.month === target.month)
        .map(goal => goal.id === id ? { ...goal, isCompleted: !goal.isCompleted } : goal),
    );
    const byId = new Map(reorderedMonth.map(goal => [goal.id, goal]));

    // Move first, persist second: the UI responds instantly and its Roman
    // numerals close up at the same time as the completed item moves down.
    setGoals(prev => prev.map(goal => byId.get(goal.id) ?? goal));

    try {
      const savedGoals = await Promise.all(reorderedMonth.map(upsertMonthlyGoal));
      const savedById = new Map(savedGoals.map(goal => [goal.id, goal]));
      setGoals(prev => prev.map(goal => savedById.get(goal.id) ?? goal));
    } catch (error) {
      console.warn('Failed to reorder monthly goals after toggle', error);
      await refresh();
    }
  }, [goals, refresh]);

  const deleteGoal = useCallback(async (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    await dbDeleteGoal(id);
  }, []);

  const value = useMemo<MonthlyGoalsContextValue>(() => ({
    ready,
    goals,
    goalsByMonth,
    refresh,
    addGoal,
    updateGoal,
    toggleGoal,
    deleteGoal,
  }), [ready, goals, goalsByMonth, refresh, addGoal, updateGoal, toggleGoal, deleteGoal]);

  return (
    <MonthlyGoalsContext.Provider value={value}>
      {children}
    </MonthlyGoalsContext.Provider>
  );
}

export function useMonthlyGoals() {
  const ctx = useContext(MonthlyGoalsContext);
  if (!ctx) {
    throw new Error('useMonthlyGoals must be used inside MonthlyGoalsProvider');
  }
  return ctx;
}
