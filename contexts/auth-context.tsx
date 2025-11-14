"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);

  const fetchUser = async () => {
    // Prevent duplicate concurrent calls
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    try {
      setLoading(true);
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      fetchUser();
      lastPathnameRef.current = pathname;
    };

    window.addEventListener("auth:login", handleAuthChange);
    window.addEventListener("auth:logout", handleAuthChange);

    return () => {
      window.removeEventListener("auth:login", handleAuthChange);
      window.removeEventListener("auth:logout", handleAuthChange);
    };
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      window.dispatchEvent(new Event("auth:logout"));
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, refetch: fetchUser, logout }}>
      {loading ? (
        <div className="flex justify-center items-center py-10 h-screen">
          <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
          <p className="text-sm text-muted-foreground ml-2">Loading...</p>
        </div>
      ) : 
        children
      }
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
