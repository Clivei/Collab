import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/** Entity display color convention from the current team dashboard. */
export function entityColor(entityName: string | null): string {
  if (!entityName) return "#ff0000"; // Both
  if (entityName.toLowerCase().includes("grid")) return "#130fff";
  return "#00c20d"; // Nora
}

export function entityLabel(entityName: string | null): string {
  if (!entityName) return "Both";
  if (entityName.toLowerCase().includes("grid")) return "Gridline";
  return "Nora";
}
