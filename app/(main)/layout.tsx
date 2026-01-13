import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background font-sans text-foreground">
      {/* <Header />
      <div className="min-h-[calc(100vh-65px)]">
        <main className="mx-auto w-full">{children}</main>
      </div>
      <Footer /> */}
      {children}
    </div>
  );
}

