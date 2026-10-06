export interface Transaction {
  date: string;
  orderId: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  revenue?: number;
  channel?: string;
}

export interface Product {
  id?: string;
  name: string;
  category?: string;
  sellingPrice?: number;
  cogs?: number;
}

export interface Expense {
  date: string;
  category: string;
  description?: string;
  amount: number;
}
export interface UploadedData {
  transactions: Transaction[];
  products: Product[];
  expenses: Expense[];
  source: { name: string; kind: "demo" | "upload"; loadedAt: string };
}

export interface Totals {
  revenue: number;
  orders: number;
  units: number;
  aov: number;
  cogs: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  cogsCoverage: number;
}
export interface ProductMetrics {
  name: string;
  revenue: number;
  units: number;
  cogs: number | null;
  grossProfit: number | null;
  margin: number | null;
  contribution: number;
  growth: number | null;
}
export interface TrendPoint {
  date: string;
  revenue: number;
}
export interface BusinessMetrics extends Totals {
  period: {
    start: string;
    end: string;
    days: number;
    previousStart: string | null;
    previousEnd: string | null;
  };
  dataPeriod: { start: string; end: string };
  previous: Totals | null;
  revenueGrowth: number | null;
  profitGrowth: number | null;
  orderGrowth: number | null;
  aovGrowth: number | null;
  products: ProductMetrics[];
  trends: { day: TrendPoint[]; week: TrendPoint[]; month: TrendPoint[] };
  expenses: number;
  channels: { name: string; revenue: number }[];
}
export interface BusinessInsight {
  id: string;
  kind: "opportunity" | "warning" | "performance";
  title: string;
  body: string;
  action: string;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "basic" | "gemini";
}
export type Intent =
  | "overview"
  | "revenue"
  | "profit"
  | "bestseller"
  | "profitable"
  | "margin"
  | "growth"
  | "warnings"
  | "unknown";
