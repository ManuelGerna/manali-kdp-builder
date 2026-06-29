import type { BookStatus } from "@/lib/kdp/constants";

export type KdpBookSummary = {
  id: string;
  title: string;
  subtitle: string;
  authorName: string;
  language: string;
  status: BookStatus;
  format: string;
  sectionCount: number;
  lastExport: string | null;
  validationStatus: string;
  updatedAt: Date;
};

export const mockBooks: KdpBookSummary[] = [
  {
    id: "demo-cristalli",
    title: "Guida ai Cristalli per Principianti",
    subtitle: "Schede, affermazioni e pagine journaling",
    authorName: "Manali Corporate",
    language: "it",
    status: "draft",
    format: "6x9 no-bleed",
    sectionCount: 4,
    lastExport: null,
    validationStatus: "not_checked",
    updatedAt: new Date("2026-06-29T06:00:00.000Z"),
  },
];
