import Link from "next/link";
import Image from "next/image";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "./ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { useTheme } from "@/contexts/theme-context";
import { usePathname } from "next/navigation";

export function Header() {
  const { toggleSidebar } = useTheme();

  const handleSidebarOpen = () => {
    toggleSidebar();
  };
  const pathname = usePathname();
  return (
    <header
      className="static lg:sticky lg:top-0 z-10 border-b border-white/15 backdrop-blur"
      style={{ background: "color-mix(in oklab, var(--background) 50%, #ffffff21)" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className={`${pathname !=='/' ?'block': 'hidden'}`}>

          <Button variant="ghost" className="cursor-pointer lg:hidden" onClick={handleSidebarOpen}>
            <FontAwesomeIcon icon={faBars} className="fa-lg" />
          </Button>
          </div>
          <div className={`${pathname !=='/' ?'hidden': 'block'} lg:block`}>
            <Link href="/">
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="Hrafn AI" width={32} height={32} />
                <span className="text-lg font-semibold text-foreground">Hrafn AI</span>
              </div>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserAvatar />
        </div>
      </div>
    </header>
  );
}
