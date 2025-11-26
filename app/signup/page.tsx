"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [dealerName, setDealerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [dealerAddress, setDealerAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!dealerName || !contactName || !contactEmail || !contactPhone || !dealerAddress || !password) {
      setError("Please fill in all required fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealerName,
          contactName,
          contactEmail,
          contactPhone,
          dealerAddress,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Dispatch auth event to update UI
      window.dispatchEvent(new Event("auth:login"));

      // Redirect to app management page on success
      router.push("/overview");
      router.refresh();
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Image src="/logo.png" alt="Hrafn AI" width={48} height={48} style={{ height: "auto" }} />
          </div>
          <CardTitle className="text-2xl text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Register your dealership to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="dealerName" className="text-sm font-medium">
                Dealer Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="dealerName"
                name="dealerName"
                type="text"
                placeholder="ABC Auto Dealership"
                value={dealerName}
                onChange={(e) => setDealerName(e.target.value)}
                required
                disabled={loading}
                autoComplete="organization"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="contactName" className="text-sm font-medium">
                Contact Person Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="contactName"
                name="contactName"
                type="text"
                placeholder="John Doe"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                disabled={loading}
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="contactEmail" className="text-sm font-medium">
                Contact Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="contactEmail"
                name="contactEmail"
                type="email"
                placeholder="contact@dealership.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="contactPhone" className="text-sm font-medium">
                Contact Phone Number <span className="text-destructive">*</span>
              </label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                placeholder="(555) 123-4567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                disabled={loading}
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dealerAddress" className="text-sm font-medium">
                Dealer Address <span className="text-destructive">*</span>
              </label>
              <Input
                id="dealerAddress"
                name="dealerAddress"
                type="text"
                placeholder="123 Main St, City, State ZIP"
                value={dealerAddress}
                onChange={(e) => setDealerAddress(e.target.value)}
                required
                disabled={loading}
                autoComplete="street-address"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password <span className="text-destructive">*</span>
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password (min. 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password <span className="text-destructive">*</span>
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="hover:underline text-primary">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

