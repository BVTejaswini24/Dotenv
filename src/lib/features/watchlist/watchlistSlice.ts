import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/lib/store";

export type WatchlistEntry = {
  id: string; // `${userId}_${productId}`
  userId: string;
  productId: number;
  productTitle: string;
  productSrcUrl: string;
  productCategory: string;
  currentPrice: number;
  originalPrice: number;
  discountPercentage: number;
  targetPrice: number;
  status: "watching" | "reached" | "notified";
  addedAt: string;
  updatedAt: string;
  notifiedAt: string | null;
};

interface PriceWatchlistState {
  entries: WatchlistEntry[];
}

const initialState: PriceWatchlistState = {
  entries: [],
};

export const watchlistSlice = createSlice({
  name: "watchlist",
  initialState,
  reducers: {
    addToWatchlist: (
      state,
      action: PayloadAction<
        Omit<WatchlistEntry, "id" | "addedAt" | "updatedAt" | "notifiedAt">
      >
    ) => {
      const { userId, productId, targetPrice } = action.payload;
      const id = `${userId}_${productId}`;
      const existing = state.entries.find((e) => e.id === id);
      const now = new Date().toISOString();

      if (existing) {
        // Update targetPrice on existing active entry
        existing.targetPrice = targetPrice;
        existing.currentPrice = action.payload.currentPrice;
        existing.updatedAt = now;
        if (existing.status === "reached" || existing.status === "notified") {
          existing.status = "watching";
        }
      } else {
        state.entries.push({
          ...action.payload,
          id,
          addedAt: now,
          updatedAt: now,
          notifiedAt: null,
        });
      }
    },

    updateTargetPrice: (
      state,
      action: PayloadAction<{
        id: string;
        targetPrice: number;
        currentPrice: number;
      }>
    ) => {
      const entry = state.entries.find((e) => e.id === action.payload.id);
      if (entry) {
        entry.targetPrice = action.payload.targetPrice;
        entry.currentPrice = action.payload.currentPrice;
        entry.updatedAt = new Date().toISOString();
        if (entry.status === "reached" || entry.status === "notified") {
          entry.status = "watching";
        }
      }
    },

    removeFromWatchlist: (state, action: PayloadAction<string>) => {
      state.entries = state.entries.filter((e) => e.id !== action.payload);
    },

    checkPriceDrops: (
      state,
      action: PayloadAction<{ productId: number; newPrice: number }>
    ) => {
      const { productId, newPrice } = action.payload;
      const now = new Date().toISOString();
      state.entries.forEach((entry) => {
        if (
          entry.productId === productId &&
          entry.status === "watching" &&
          newPrice <= entry.targetPrice
        ) {
          entry.status = "reached";
          entry.currentPrice = newPrice;
          entry.notifiedAt = now;
          entry.updatedAt = now;
        }
      });
    },

    markNotified: (state, action: PayloadAction<string>) => {
      const entry = state.entries.find((e) => e.id === action.payload);
      if (entry) {
        entry.status = "notified";
        entry.updatedAt = new Date().toISOString();
      }
    },

    clearWatchlist: (state) => {
      state.entries = [];
    },
  },
});

export const {
  addToWatchlist,
  updateTargetPrice,
  removeFromWatchlist,
  checkPriceDrops,
  markNotified,
  clearWatchlist,
} = watchlistSlice.actions;

export const selectWatchlistEntries = (state: RootState) =>
  state.watchlist.entries;

export const selectUserWatchlist = (userId: string) => (state: RootState) =>
  state.watchlist.entries.filter((e) => e.userId === userId);

export const selectIsWatching =
  (productId: number, userId: string) => (state: RootState) =>
    state.watchlist.entries.some(
      (e) => e.productId === productId && e.userId === userId
    );

export const selectWatchlistEntry =
  (productId: number, userId: string) => (state: RootState) =>
    state.watchlist.entries.find(
      (e) => e.productId === productId && e.userId === userId
    );

export const selectWatchlistCount = (userId: string) => (state: RootState) =>
  state.watchlist.entries.filter((e) => e.userId === userId).length;

export default watchlistSlice.reducer;
