"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type App = {
  id: string;
  name: string;
  description: string | null;
  crmType: "CDK" | "Tekion";
  clientId: string;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

interface AppContextType {
  selectedApp: App | null;
  setSelectedApp: (app: App | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedApp, setSelectedAppState] = useState<App | null>(null);

  // Load selected app from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("selectedApp");
    if (stored) {
      try {
        setSelectedAppState(JSON.parse(stored));
      } catch {
        localStorage.removeItem("selectedApp");
      }
    }
  }, []);

  const setSelectedApp = (app: App | null) => {
    setSelectedAppState(app);
    if (app) {
      localStorage.setItem("selectedApp", JSON.stringify(app));
    } else {
      localStorage.removeItem("selectedApp");
    }
  };

  return (
    <AppContext.Provider value={{ selectedApp, setSelectedApp }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

