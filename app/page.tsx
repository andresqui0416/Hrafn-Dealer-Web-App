import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
export default function Home() {
  return (

    <div>
      {/* Content */}
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-h-[calc(100vh-9rem)]">
        <div className="my-10">
          <p className="text-6xl font-bold text-center text-zinc-900 dark:text-zinc-50 mb-10">
            Automotive&apos;s
            <br />
            AI-Native OS
          </p>
          <p className="text-lg text-center text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            AI-native platform for automotive dealers.
          </p>
        </div>
        <div className="flex justify-center">
          <Button asChild className={buttonVariants({ variant: "default", size: "lg", className: "text-lg" })}>
            <Link href="/login">
              Get Started
              <FontAwesomeIcon icon={faArrowRight} className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
