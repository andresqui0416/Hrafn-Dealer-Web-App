"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/contexts/app-context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

type App = {
  id: string;
  name: string;
  description: string | null;
  fortellisClientId: string;
  hasFortellisSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function AppsPage() {
  const router = useRouter();
  const { selectedApp, setSelectedApp } = useApp();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(false);
  const [appsFetchLoading, setAppsFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fortellisClientId, setFortellisClientId] = useState("");
  const [fortellisClientSecret, setFortellisClientSecret] = useState("");

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setAppsFetchLoading(true);
      const response = await fetch("/api/apps");
      if (response.ok) {
        const data = await response.json();
        setApps(data.apps || []);
      }
    } catch (err) {
      console.error("Failed to load apps:", err);
    } finally {
      setAppsFetchLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setFortellisClientId("");
    setFortellisClientSecret("");
    setEditingApp(null);
    setShowForm(false);
    setError(null);
    setSuccess(null);
  };

  const handleEdit = (app: App) => {
    setEditingApp(app);
    setName(app.name);
    setDescription(app.description || "");
    setFortellisClientId(app.fortellisClientId);
    setFortellisClientSecret("");
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = async (appId: string) => {
    if (!confirm("Are you sure you want to delete this app? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/apps/${appId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete app");
        setLoading(false);
        return;
      }

      setSuccess("App deleted successfully");
      // Clear selected app if it was deleted
      if (selectedApp?.id === appId) {
        setSelectedApp(null);
      }
      await loadApps();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!name || !fortellisClientId) {
      setError("Name and Fortellis Client ID are required");
      setLoading(false);
      return;
    }

    try {
      const url = editingApp ? `/api/apps/${editingApp.id}` : "/api/apps";
      const method = editingApp ? "PUT" : "POST";

      const body: any = {
        name,
        description: description || undefined,
        fortellisClientId,
      };

      // Only include secret if it's being updated (new app or editing with new value)
      if (fortellisClientSecret) {
        body.fortellisClientSecret = fortellisClientSecret;
      } else if (editingApp && !fortellisClientSecret) {
        // When editing, if secret is empty, don't send it (keep existing)
        // We need to explicitly not update it
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save app");
        setLoading(false);
        return;
      }

      setSuccess(editingApp ? "App updated successfully" : "App created successfully");
      resetForm();
      await loadApps();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6 px-4 md:px-6 lg:px-8">
      <div>
        <h2 className="text-2xl font-semibold">Apps</h2>
        <p className="text-sm text-muted-foreground">
          Manage your Fortellis app registrations and credentials
        </p>
      </div>

      {appsFetchLoading && (
        <div className="flex justify-center items-center py-10">
          <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
          <p className="text-sm text-muted-foreground ml-2">Loading apps...</p>
        </div>
      )}
      {!appsFetchLoading && (
        <>
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
          )}
          {success && (
            <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingApp ? "Edit App" : "Register New App"}</CardTitle>
                <CardDescription>
                  {editingApp
                    ? "Update your app configuration and credentials"
                    : "Register a new app with Fortellis credentials"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      App Name *
                    </label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Inventory Sync App"
                      required
                      disabled={loading}
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">
                      Description
                    </label>
                    <Input
                      id="description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional description"
                      disabled={loading}
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="fortellisClientId" className="text-sm font-medium">
                      Fortellis Client ID *
                    </label>
                    <Input
                      id="fortellisClientId"
                      type="text"
                      value={fortellisClientId}
                      onChange={(e) => setFortellisClientId(e.target.value)}
                      placeholder="Enter your Fortellis Client ID"
                      required
                      disabled={loading}
                      autoComplete="off"
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
                        editingApp
                          ? "Enter new secret to update, or leave blank to keep current"
                          : "Enter your Fortellis Client Secret"
                      }
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    {editingApp && editingApp.hasFortellisSecret && (
                      <p className="text-xs text-muted-foreground">
                        A secret is already configured. Enter a new value to update it.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving..." : editingApp ? "Update App" : "Create App"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Apps List */}
          {!showForm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Registered Apps</h3>
                {!showForm && (
                  <Button onClick={() => setShowForm(true)}>Register New App</Button>
                )}
              </div>

              {apps.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No apps registered yet.</p>
                    <Button onClick={() => setShowForm(true)} className="mt-4">
                      Register Your First App
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {apps.map((app) => (
                    <Card key={app.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{app.name}</CardTitle>
                            {app.description && (
                              <CardDescription className="mt-1">{app.description}</CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Client ID</p>
                            <p className="mt-1 font-mono text-sm">{app.fortellisClientId}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Secret Status</p>
                            <p className="mt-1 text-sm">
                              {app.hasFortellisSecret ? (
                                <span className="text-green-600 dark:text-green-400">Configured</span>
                              ) : (
                                <span className="text-muted-foreground">Not configured</span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedApp(app);
                                router.push(`/apps/${app.id}/overview`);
                              }}
                              disabled={loading}
                              className="flex-1"
                            >
                              Select App
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(app)}
                              disabled={loading}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(app.id)}
                              disabled={loading}
                              className="text-destructive hover:text-destructive"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

