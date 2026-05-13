import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type TxTypeFilter = "all" | "income" | "bills";

export type TxColumnKey = "date" | "transaction" | "status";

export type TxColumns = Record<TxColumnKey, boolean>;

const DEFAULT_TX_COLUMNS: TxColumns = {
  date: true,
  transaction: true,
  status: true,
};

interface UIState {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  clearSearchQuery: () => void;
  txTypeFilter: TxTypeFilter;
  setTxTypeFilter: (f: TxTypeFilter) => void;
  txColumns: TxColumns;
  setTxColumn: (key: TxColumnKey, visible: boolean) => void;
  resetTxColumns: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      searchQuery: "",
      setSearchQuery: (q) => set({ searchQuery: q }),
      clearSearchQuery: () => set({ searchQuery: "" }),
      txTypeFilter: "all",
      setTxTypeFilter: (f) => set({ txTypeFilter: f }),
      txColumns: DEFAULT_TX_COLUMNS,
      setTxColumn: (key, visible) =>
        set((s) => ({ txColumns: { ...s.txColumns, [key]: visible } })),
      resetTxColumns: () => set({ txColumns: DEFAULT_TX_COLUMNS }),
    }),
    {
      name: "dashboard.ui.v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        txTypeFilter: s.txTypeFilter,
        txColumns: s.txColumns,
      }),
    },
  ),
);
