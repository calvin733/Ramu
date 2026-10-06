"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
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

interface BusinessState {
  data: UploadedData | null;
  metrics: BusinessMetrics | null;
  insights: BusinessInsight[];
  setData: (data: UploadedData | null) => void;
  loadDemo: () => void;
}
const BusinessContext = createContext<BusinessState | null>(null);
export function BusinessProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<UploadedData | null>(null);
  const metrics = useMemo(() => (data ? analyzeBusiness(data) : null), [data]);
  const insights = useMemo(
    () => (metrics ? generateInsights(metrics) : []),
    [metrics],
  );
  return (
    <BusinessContext.Provider
      value={{
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
