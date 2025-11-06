import Link from "next/link";
import Image from "next/image";
import { UserAvatar } from "@/components/user-avatar";

export function Header() {
    return (
        <header
            className="sticky top-0 z-10 border-b border-white/15 backdrop-blur"
            style={{ background: "color-mix(in oklab, var(--background) 50%, #ffffff21)" }}
        >
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
                <Link href="/">
                    <div className="flex items-center gap-3">
                        <Image src="/logo.png" alt="Hrafn AI" width={32} height={32} />
                        <span className="text-lg font-semibold text-foreground">Hrafn AI</span>
                    </div>
                </Link>
                <div className="flex items-center gap-2">
                    <UserAvatar />
                </div>
            </div>
        </header>
    );
}