"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faUser, faGear, faSignOut, faMobileScreen, faChartLine } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";

export function UserAvatar() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (loading) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />;
  }

  if (!user) {
    return (
      <Button asChild>
        <Link href="/login">Login</Link>
      </Button>
    );
  }

  // Extract initials from name when available, fallback to email-derived
  const getInitials = (name?: string, email?: string): string => {
    const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
    const parts = source.split(/[\s._-]+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] || "").toUpperCase() + (parts[1][0] || "").toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(user.name, user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="hover:bg-white/10">
        <Button
          variant="ghost"
          className="relative flex items-center gap-2 h-auto p-1 focus-visible:outline-none active:outline-none active:ring-0 active:ring-offset-0 data-[state=closed]:outline-none data-[state=closed]:ring-0 data-[state=closed]:ring-offset-0"
        >
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name || "User avatar"}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover border-2 border-white/10"
              unoptimized
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center bg-primary rounded-full text-primary-foreground text-sm font-medium">
              {initials}
            </div>
          )}
          <FontAwesomeIcon icon={faChevronDown} className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-background" align="end">
        <DropdownMenuLabel className="py-2">
          <p className="text-sm font-medium">{user.email}</p>
          {/* <p className="text-xs text-muted-foreground">{user.role}</p> */}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={() => router.push("/dashboard")}
          className="py-2 hover:bg-white/10"
        >
          <FontAwesomeIcon icon={faChartLine} className="h-3 w-3 text-muted-foreground" />
          <div className="text-sm font-medium ml-2">Dashboard</div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/apps")}
          className="py-2 hover:bg-white/10"
        >
          <FontAwesomeIcon icon={faMobileScreen} className="h-3 w-3 text-muted-foreground" />
          <div className="text-sm font-medium ml-2">App Management</div>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />

        <DropdownMenuItem
          onClick={() => router.push("/profile")}
          className="py-2 hover:bg-white/10"
        >
          <FontAwesomeIcon icon={faUser} className="h-3 w-3 text-muted-foreground" />
          <div className="text-sm font-medium ml-2">Profile</div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          className="py-2 hover:bg-white/10"
        >
          <FontAwesomeIcon icon={faGear} className="h-3 w-3 text-muted-foreground" />
          <div className="text-sm font-medium ml-2">Settings</div>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive py-2 hover:bg-white/10"
        >
          <FontAwesomeIcon icon={faSignOut} className="h-3 w-3 text-muted-foreground" />
          <div className="text-sm font-medium ml-2">Log out</div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
