"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  admin: Admin | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);

  const fetchUser = async () => {
    // Prevent duplicate concurrent calls
    if (fetchingRef.current) {
      return;
    }

    const isAdminRoute = pathname?.startsWith("/admin");

    fetchingRef.current = true;
    try {
      setLoading(true);
      
      // If on admin route, fetch admin auth
      if (isAdminRoute) {
        const res = await fetch("/api/admin/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data?.user || data?.admin) {
            setAdmin(data.user || data.admin);
            setUser(null); // Clear user when admin is logged in
          } else {
            setAdmin(null);
          }
        } else {
          setAdmin(null);
        }
      } else {
        // Regular user auth
        const res = await fetch("/api/me");
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setUser(data.user);
            setAdmin(null); // Clear admin when user is logged in
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
      setAdmin(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // Protect routes - redirect unauthenticated users to login
  useEffect(() => {
    // Don't redirect while loading
    if (loading) {
      return;
    }

    const isAdminRoute = pathname?.startsWith("/admin");

    // Public routes that don't require authentication
    const publicRoutes = ["/", "/login", "/signup"];
    const adminPublicRoutes = ["/admin/login"];
    const isPublicRoute = publicRoutes.includes(pathname) || adminPublicRoutes.includes(pathname);

    // Skip protection for admin routes (handled by admin layout)
    if (isAdminRoute) {
      return;
    }

    // If user is not authenticated and trying to access a protected route
    if (!user && !isPublicRoute) {
      router.push("/login");
      router.refresh();
    }
  }, [user, admin, loading, pathname, router]);

  useEffect(() => {
    const handleAuthChange = () => {
      fetchUser();
      lastPathnameRef.current = pathname;
    };

    const handleAuthLogout = () => {
      const isAdminRoute = pathname?.startsWith("/admin");
      setUser(null);
      setAdmin(null);
      if (isAdminRoute) {
        router.push("/admin/login");
      } else {
        router.push("/");
      }
      router.refresh();
    };

    const handleAdminLogin = () => {
      fetchUser();
      lastPathnameRef.current = pathname;
    };

    const handleAdminLogout = () => {
      setAdmin(null);
      router.push("/admin/login");
      router.refresh();
    };

    window.addEventListener("auth:login", handleAuthChange);
    window.addEventListener("auth:logout", handleAuthLogout);
    window.addEventListener("admin:login", handleAdminLogin);
    window.addEventListener("admin:logout", handleAdminLogout);

    return () => {
      window.removeEventListener("auth:login", handleAuthChange);
      window.removeEventListener("auth:logout", handleAuthLogout);
      window.removeEventListener("admin:login", handleAdminLogin);
      window.removeEventListener("admin:logout", handleAdminLogout);
    };
  }, [pathname, router]);

  const logout = async () => {
    const isAdminRoute = pathname?.startsWith("/admin");
    try {
      if (isAdminRoute && admin) {
        await fetch("/api/admin/auth/logout", { method: "POST" });
        setAdmin(null);
        window.dispatchEvent(new Event("admin:logout"));
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        window.dispatchEvent(new Event("auth:logout"));
      }
    } catch (error) {
      console.error("Logout error:", error);
      // Still redirect even if API call fails
      if (isAdminRoute) {
        setAdmin(null);
        router.push("/admin/login");
      } else {
        setUser(null);
        router.push("/");
      }
      router.refresh();
    }
  };

  const isAdmin = !!admin;

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        loading,
        refetch: fetchUser,
        logout,
        isAdmin,
      }}
    >
      {loading ? (
        <div className="flex justify-center items-center py-10 h-screen">
          <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
          <p className="text-sm text-muted-foreground ml-2">Loading...</p>
        </div>
      ) : (
        children
      )}
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
