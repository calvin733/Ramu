import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
export const formatRupiah = (value: number) =>
  `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
export const formatNumber = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value);
export const formatPercentage = (value: number) =>
  `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
export const formatDate = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${value}T00:00:00Z`));
export const normalizeName = (name: string) =>
  name.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
export const DAY_MS = 86_400_000;
export const dateMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const isoDay = (time: number) =>
  new Date(time).toISOString().slice(0, 10);
