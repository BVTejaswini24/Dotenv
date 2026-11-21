import { Product } from "@/types/product.types";

export type TryOnCategory = "shirt" | "glasses" | "dress";
export type TryOnType = "clothing_ai" | "glasses_ar";

export type TryOnProduct = {
  id: number;
  title: string;
  category: string;
  tryOnCategory: TryOnCategory;
  tryOnType: TryOnType;
  srcUrl: string;
  price: number;
  brand: string;
  gender?: string;
  overlayUrl?: string;
};

export type FaceLandmark = {
  x: number;
  y: number;
  z?: number;
};

export type TryOnStatus =
  | "idle"
  | "ready"
  | "capturing"
  | "processing"
  | "completed"
  | "failed";

