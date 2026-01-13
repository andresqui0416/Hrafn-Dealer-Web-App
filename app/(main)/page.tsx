"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/contexts/auth-context";

export default function Home() {
  const { user } = useAuth();
  return (
    <div>
      <div className="my-10  px-4 py-8">
        <p className="lg:text-6xl text-4xl font-bold text-center text-foreground mb-10">
          Automotive&apos;s
          <br />
          AI-Native OS
        </p>
        <p className="text-lg text-center text-muted-foreground max-w-2xl mx-auto">
          AI-native platform for automotive dealers.
        </p>
      </div>
      <div className="flex justify-center">
        <Button
          asChild
          className={buttonVariants({ variant: "default", size: "lg", className: "text-lg" })}
        >
          <Link href={user ? "/overview" : "/login"}>
            Get Started
            <FontAwesomeIcon icon={faArrowRight} className="w-5 h-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
