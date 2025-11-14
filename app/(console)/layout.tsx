"use client";
import { ReactNode } from "react";

export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="px-4 md:px-6 lg:px-8 py-6 max-w-6xl mx-auto">{children}</div>;
}
