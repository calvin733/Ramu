"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  BusinessInsight,
  BusinessMetrics,
  UploadedData,
} from "@/lib/types";
import { analyzeBusiness } from "@/lib/analytics";
import { createDemoData } from "@/lib/demo";
import { generateInsights } from "@/lib/insights";
import type { MappingSummaryData } from "@/components/data/mapping-summary";

import {
  calculateGoal,
  type BusinessGoal,
  type GoalProgress,
} from "@/lib/goals";
import {
  readGoals,
  serverGoals,
  subscribeGoals,
  writeGoals,
} from "@/lib/goals/store";

interface BusinessState {
  mappingSummary: MappingSummaryData | null;
  setMappingSummary: (summary: MappingSummaryData | null) => void;
  goals: BusinessGoal[];
  goalProgress: GoalProgress[];
  setGoals: (goals: BusinessGoal[]) => void;
  data: UploadedData | null;
  metrics: BusinessMetrics | null;
  insights: BusinessInsight[];
  setData: (data: UploadedData | null) => void;
  loadDemo: () => void;
}
const BusinessContext = createContext<BusinessState | null>(null);
export function BusinessProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<UploadedData | null>(null);
  const [mappingSummary, setMappingSummary] =
    useState<MappingSummaryData | null>(null);
  const goals = useSyncExternalStore(subscribeGoals, readGoals, serverGoals);
  const goalProgress = useMemo(
    () => goals.filter((g) => g.enabled).map((g) => calculateGoal(g, data)),
    [goals, data],
  );
  const metrics = useMemo(() => (data ? analyzeBusiness(data) : null), [data]);
  const insights = useMemo(
    () => (metrics ? generateInsights(metrics) : []),
    [metrics],
  );
  return (
    <BusinessContext.Provider
      value={{
        mappingSummary:
          mappingSummary?.loadedAt === data?.source.loadedAt
            ? mappingSummary
            : null,
        setMappingSummary,
        goals,
        goalProgress,
        setGoals: writeGoals,
        data,
        metrics,
        insights,
        setData,
        loadDemo: () => setData(createDemoData()),
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}
export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) throw new Error("BusinessProvider is required");
  return context;
}
