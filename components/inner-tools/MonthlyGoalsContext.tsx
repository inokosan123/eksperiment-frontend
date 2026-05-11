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
  return goals.reduce<Record<string, MonthlyGoal[]>>((acc, goal) => {
    if (!acc[goal.month]) acc[goal.month] = [];
    acc[goal.month].push(goal);
    return acc;
  }, {});
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
    setGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
    const saved = await upsertMonthlyGoal(goal);
    setGoals(prev => prev.map(g => g.id === saved.id ? saved : g));
    return saved;
  }, []);

  const toggleGoal = useCallback(async (id: string) => {
    const target = goals.find(g => g.id === id);
    if (!target) return;
    const next: MonthlyGoal = { ...target, isCompleted: !target.isCompleted };
    await updateGoal(next);
  }, [goals, updateGoal]);

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
