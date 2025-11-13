"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type UserData = {
  id: string;
  email: string;
};

type CrmData = {
  dealerId: string;
  dealerName: string;
  fortellisClientId: string | null;
  hasFortellisSecret: boolean;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"personal" | "crm">("personal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Personal info state
  const [userData, setUserData] = useState<UserData | null>(null);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // CRM info state
  const [crmData, setCrmData] = useState<CrmData | null>(null);
  const [fortellisClientId, setFortellisClientId] = useState("");
  const [fortellisClientSecret, setFortellisClientSecret] = useState("");

  // Load user data
  useEffect(() => {
    if (activeTab === "personal") {
      loadUserData();
    } else {
      loadCrmData();
    }
  }, [activeTab]);

  const loadUserData = async () => {
    try {
      const response = await fetch("/api/settings/user");
      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
        setEmail(data.user.email);
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    }
  };

  const loadCrmData = async () => {
    try {
      const response = await fetch("/api/settings/crm");
      if (response.ok) {
        const data = await response.json();
        setCrmData(data.crm);
        setFortellisClientId(data.crm.fortellisClientId || "");
        setFortellisClientSecret("");
      }
    } catch (err) {
      console.error("Failed to load CRM data:", err);
    }
  };

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    // Validate password if changing
    if (newPassword) {
      if (newPassword.length < 8) {
        setError("Password must be at least 8 characters long");
        setLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match");
        setLoading(false);
        return;
      }
      if (!currentPassword) {
        setError("Current password is required to change password");
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/settings/user", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email !== userData?.email ? email : undefined,
          currentPassword: newPassword ? currentPassword : undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update settings");
        setLoading(false);
        return;
      }

      setSuccess("Personal information updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await loadUserData();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCrmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!fortellisClientId && !fortellisClientSecret) {
      setError("Please provide at least one field to update");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/settings/crm", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fortellisClientId: fortellisClientId || undefined,
          fortellisClientSecret: fortellisClientSecret || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update CRM settings");
        setLoading(false);
        return;
      }

      setSuccess("CRM settings updated successfully");
      setFortellisClientSecret("");
      await loadCrmData();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your account and CRM integration settings</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("personal")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors",
              activeTab === "personal"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            Personal Information
          </button>
          <button
            onClick={() => setActiveTab("crm")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors",
              activeTab === "crm"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            CRM Integration
          </button>
        </nav>
      </div>

      {/* Personal Information Tab */}
      {activeTab === "personal" && (
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your email address and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePersonalSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
              )}
              {success && (
                <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
                  {success}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-4 border-t border-white/10 pt-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Change Password</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Leave blank if you don&apos;t want to change your password
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="currentPassword" className="text-sm font-medium">
                    Current Password
                  </label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium">
                    New Password
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm New Password
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    minLength={8}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* CRM Integration Tab */}
      {activeTab === "crm" && (
        <Card>
          <CardHeader>
            <CardTitle>CRM Integration</CardTitle>
            <CardDescription>
              Configure your Fortellis API credentials for CRM integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCrmSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
              )}
              {success && (
                <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
                  {success}
                </div>
              )}

              {crmData && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="font-medium">Dealer: {crmData.dealerName}</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="fortellisClientId" className="text-sm font-medium">
                  Fortellis Client ID (API Key)
                </label>
                <Input
                  id="fortellisClientId"
                  type="text"
                  value={fortellisClientId}
                  onChange={(e) => setFortellisClientId(e.target.value)}
                  placeholder="Enter your Fortellis Client ID"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="fortellisClientSecret" className="text-sm font-medium">
                  Fortellis Client Secret
                </label>
                <Input
                  id="fortellisClientSecret"
                  type="password"
                  value={fortellisClientSecret}
                  onChange={(e) => setFortellisClientSecret(e.target.value)}
                  placeholder={
                    crmData?.hasFortellisSecret
                      ? "Enter new secret to update, or leave blank to keep current"
                      : "Enter your Fortellis Client Secret"
                  }
                  disabled={loading}
                />
                {crmData?.hasFortellisSecret && (
                  <p className="text-xs text-muted-foreground">
                    A secret is already configured. Enter a new value to update it.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
