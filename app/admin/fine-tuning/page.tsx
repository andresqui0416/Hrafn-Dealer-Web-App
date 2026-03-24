"use client";

import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AdminPagination } from "@/components/admin-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faX,
  faPlus,
  faEdit,
  faTrash,
  faQuestionCircle,
  faUpload,
  faRotateRight,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

type FineTuningSampleType = "NLQ" | "FAQ";

type FineTuningSample = {
  id: string;
  type: FineTuningSampleType;
  question: string;
  answer: string;
  createdAt: string;
  updatedAt: string;
};

export default function FineTuningPage() {
  const [activeTab, setActiveTab] = useState<FineTuningSampleType>("NLQ");
  const [samples, setSamples] = useState<FineTuningSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSampleId, setExpandedSampleId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSample, setEditingSample] = useState<FineTuningSample | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    total: number;
    errors?: string[];
  } | null>(null);
  const [importTab, setImportTab] = useState<"CSV" | "JSON">("CSV");
  const [importMode, setImportMode] = useState<"file" | "text">("file");
  const [importText, setImportText] = useState("");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Only re-run when activeTab changes; loadSamples is intentionally omitted to avoid re-running on every loadSamples identity change.
  useEffect(() => {
    setExpandedSampleId(null);
    setSelectedIds(new Set());
    setPage(1);
    loadSamples({ nextPage: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on activeTab change
  }, [activeTab]);

  const loadSamples = async (opts?: {
    nextPage?: number;
    nextQuery?: string;
    nextPageSize?: number;
  }) => {
    const p = opts?.nextPage ?? page;
    const q = opts?.nextQuery ?? searchQuery;
    const ps = opts?.nextPageSize ?? pageSize;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("type", activeTab);
      params.set("page", String(p));
      params.set("pageSize", String(ps));
      if (q.trim()) params.set("q", q.trim());

      const response = await fetch(`/api/admin/fine-tuning?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSamples(data.samples || []);
        setTotalCount(data.pagination?.totalCount ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setPage(data.pagination?.page ?? p);
        setPageSize(data.pagination?.pageSize ?? ps);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || "Failed to load samples");
      }
    } catch (err) {
      console.error("Failed to load samples:", err);
      setError("Failed to load samples");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!question.trim() || !answer.trim()) {
      setError("Question and answer are required");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/fine-tuning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          question: question.trim(),
          answer: answer.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create sample");
        setCreating(false);
        return;
      }

      setSuccess("Sample created successfully");
      setQuestion("");
      setAnswer("");
      setShowCreateDialog(false);
      setExpandedSampleId(null);
      setPage(1);
      loadSamples({ nextPage: 1 });
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (sample: FineTuningSample) => {
    setEditingSample(sample);
    setQuestion(sample.question);
    setAnswer(sample.answer);
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingSample || !question.trim() || !answer.trim()) {
      setError("Question and answer are required");
      return;
    }

    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/fine-tuning/${editingSample.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editingSample.type,
          question: question.trim(),
          answer: answer.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update sample");
        setUpdating(false);
        return;
      }

      setSuccess("Sample updated successfully");
      setQuestion("");
      setAnswer("");
      setEditingSample(null);
      setShowEditDialog(false);
      setExpandedSampleId(null);
      loadSamples();
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sample?")) {
      return;
    }

    setDeleting(id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/fine-tuning/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete sample");
        setDeleting(null);
        return;
      }

      setSuccess("Sample deleted successfully");
      setExpandedSampleId(null);
      // If we deleted the last item on the last page, step back a page
      const remainingOnPage = samples.length - 1;
      const nextPage = page > 1 && remainingOnPage <= 0 ? page - 1 : page;
      setPage(nextPage);
      loadSamples({ nextPage });
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of filteredSamples) next.add(s.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/fine-tuning", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Failed to delete selected samples");
        return;
      }

      const deletedCount = Number(data.deleted || 0);
      setSuccess(`Deleted ${deletedCount} sample${deletedCount === 1 ? "" : "s"}`);
      setShowBulkDeleteDialog(false);
      setExpandedSampleId(null);
      clearSelection();

      const nextTotal = Math.max(0, totalCount - deletedCount);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
      const nextPage = Math.min(page, nextTotalPages);
      setPage(nextPage);
      loadSamples({ nextPage });
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setQuestion("");
    setAnswer("");
    setError(null);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setEditingSample(null);
    setQuestion("");
    setAnswer("");
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type based on selected tab
    const fileName = file.name.toLowerCase();
    const expectedExtension = importTab === "CSV" ? ".csv" : ".json";

    if (!fileName.endsWith(expectedExtension)) {
      setError(`Please select a ${importTab} file`);
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setImportFile(file);
    setError(null);
  };

  const handleImport = async () => {
    if (importMode === "file" && !importFile) {
      setError("Please select a file");
      return;
    }

    if (importMode === "text" && !importText.trim()) {
      setError("Please enter JSON data");
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);
    setImportResult(null);

    try {
      let formData: FormData;

      if (importMode === "file") {
        formData = new FormData();
        formData.append("file", importFile!);
      } else {
        // For text input, create a JSON file blob
        const blob = new Blob([importText], { type: "application/json" });
        const file = new File([blob], "import.json", { type: "application/json" });
        formData = new FormData();
        formData.append("file", file);
      }

      const response = await fetch("/api/admin/fine-tuning/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to import samples");
        if (data.details) {
          setImportResult({
            imported: 0,
            total: 0,
            errors: Array.isArray(data.details) ? data.details : [data.details],
          });
        }
        setImporting(false);
        return;
      }

      setSuccess(`Successfully imported ${data.imported} of ${data.total} samples`);
      setImportResult({
        imported: data.imported,
        total: data.total,
        errors: data.errors,
      });
      setImportFile(null);
      setImportText("");
      setExpandedSampleId(null);
      setPage(1);
      loadSamples({ nextPage: 1 }); // Reload samples after import
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImportDialog = () => {
    setShowImportDialog(false);
    setImportFile(null);
    setImportText("");
    setImportResult(null);
    setError(null);
    setImportTab("CSV"); // Reset to CSV tab
    setImportMode("file"); // Reset to file mode
    // Reset file input
    const fileInput = document.getElementById("import-file") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const filteredSamples = samples; // server already filters by type + query
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(totalCount, (page - 1) * pageSize + filteredSamples.length);
  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Manage sample questions and answers for model fine-tuning
      </p>
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowImportDialog(true)}
            variant="outline"
            className="cursor-pointer"
          >
            <FontAwesomeIcon icon={faUpload} className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button
            onClick={() => {
              setError(null);
              setSuccess(null);
              setExpandedSampleId(null);
              loadSamples();
            }}
            variant="outline"
            disabled={loading}
            className={cn(loading ? "cursor-not-allowed" : "cursor-pointer")}
          >
            <FontAwesomeIcon
              icon={loading ? faSpinner : faRotateRight}
              className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
            />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="cursor-pointer">
            <FontAwesomeIcon icon={faPlus} className="h-4 w-4 mr-2" />
            Add Sample
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <Input
            placeholder={`Search ${activeTab} samples...`}
            value={searchQuery}
            onChange={(e) => {
              const next = e.target.value;
              setSearchQuery(next);
              setExpandedSampleId(null);
              setSelectedIds(new Set());
              setPage(1);
              loadSamples({ nextQuery: next, nextPage: 1 });
            }}
            className="w-full max-w-lg"
          />
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Selected {selectedCount}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllOnPage}
                disabled={loading || filteredSamples.length === 0}
                className={cn(loading ? "cursor-not-allowed" : "cursor-pointer")}
              >
                Select page
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="cursor-pointer"
              >
                Clear
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={bulkDeleting}
                className={cn(bulkDeleting ? "cursor-not-allowed" : "cursor-pointer")}
              >
                <FontAwesomeIcon icon={faTrash} className="h-4 w-4 mr-2" />
                Delete selected
              </Button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <AdminPagination
              total={totalCount}
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              loading={loading}
              pageInput={String(page)}
              setPageInput={(value) => {
                const parsed = Number(value || "1");
                const clamped = Math.min(totalPages || 1, Math.max(1, parsed || 1));
                setPage(clamped);
                setExpandedSampleId(null);
                loadSamples({ nextPage: clamped });
              }}
              onPageChange={(nextPage) => {
                setPage(nextPage);
                setExpandedSampleId(null);
                loadSamples({ nextPage });
              }}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setExpandedSampleId(null);
                setPage(1);
                loadSamples({ nextPageSize: nextSize, nextPage: 1 });
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-500/15 p-3 text-sm text-destructive flex items-center justify-between gap-2">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-6 w-6 p-0 cursor-pointer hover:bg-red-500/20"
          >
            <FontAwesomeIcon icon={faX} className="h-3 w-3" />
          </Button>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/15 p-3 text-sm text-white flex items-center justify-between gap-2">
          <span>{success}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccess(null)}
            className="h-6 w-6 p-0 cursor-pointer hover:bg-green-500/20"
          >
            <FontAwesomeIcon icon={faX} className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/10">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("NLQ")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "NLQ"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            NLQ (Natural Language Query)
          </button>
          <button
            onClick={() => setActiveTab("FAQ")}
            className={cn(
              "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
              activeTab === "FAQ"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
            )}
          >
            FAQ (Frequently Asked Questions)
          </button>
        </nav>
      </div>

      {/* Samples List */}
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <FontAwesomeIcon icon={faSpinner} size="2x" className="animate-spin" />
        </div>
      ) : filteredSamples.length === 0 ? (
        <div className="rounded-md border border-white/10 p-10 text-center">
          <FontAwesomeIcon
            icon={faQuestionCircle}
            size="3x"
            className="text-muted-foreground mb-4"
          />
          <p className="text-muted-foreground">
            No {activeTab} samples yet. Create a new sample to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-white/10 divide-y divide-white/10 overflow-hidden">
          {filteredSamples.map((sample, idx) => {
            const expanded = expandedSampleId === sample.id;
            const rowNumber = (page - 1) * pageSize + idx + 1;
            const checked = selectedIds.has(sample.id);
            return (
              <div
                key={sample.id}
                className={cn("transition-colors", expanded ? "bg-white/5" : "hover:bg-white/5")}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedSampleId(expanded ? null : sample.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedSampleId(expanded ? null : sample.id);
                    }
                  }}
                  className="flex items-start justify-between gap-4 px-4 py-3 cursor-pointer select-none"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      aria-label={`Select sample ${rowNumber}`}
                      checked={checked}
                      onChange={(e) => toggleSelected(sample.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                    />
                    <div className="w-8 text-sm text-muted-foreground font-mono pt-0.5">
                      {rowNumber}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground whitespace-pre-wrap">
                        {sample.question}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: ReactMouseEvent) => {
                        e.stopPropagation();
                        handleEdit(sample);
                      }}
                      className="cursor-pointer"
                    >
                      <FontAwesomeIcon icon={faEdit} className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: ReactMouseEvent) => {
                        e.stopPropagation();
                        handleDelete(sample.id);
                      }}
                      disabled={deleting === sample.id}
                      className={cn(
                        deleting === sample.id ? "cursor-not-allowed" : "cursor-pointer",
                        "text-destructive hover:text-destructive",
                      )}
                    >
                      {deleting === sample.id ? (
                        <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-4 pb-4">
                    <div className="mt-2 rounded-md border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Answer</p>
                      <pre
                        className={cn(
                          "text-sm text-foreground whitespace-pre-wrap break-words",
                          sample.type === "NLQ" ? "font-mono" : "",
                        )}
                      >
                        {sample.answer}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Delete Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent className="pb-0">
          <DialogHeader className="px-0">
            <DialogTitle>Delete selected samples?</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedCount} sample{selectedCount === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="px-0">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={bulkDeleting}
              className={cn(bulkDeleting ? "cursor-not-allowed" : "cursor-pointer")}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting || selectedCount === 0}
              className={cn(
                bulkDeleting || selectedCount === 0 ? "cursor-not-allowed" : "cursor-pointer",
              )}
            >
              {bulkDeleting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faTrash} className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="pb-0">
          <DialogHeader className="px-0">
            <DialogTitle>Create New {activeTab} Sample</DialogTitle>
            <DialogDescription>
              Add a new sample question and answer for {activeTab} fine-tuning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="question" className="text-sm font-medium">
                Question <span className="text-destructive">*</span>
              </label>
              <textarea
                id="question"
                name="question"
                rows={4}
                placeholder="Enter the question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                disabled={creating}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="answer" className="text-sm font-medium">
                Answer <span className="text-destructive">*</span>
              </label>
              <textarea
                id="answer"
                name="answer"
                rows={6}
                placeholder="Enter the answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                disabled={creating}
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter className="px-0">
            <Button
              variant="outline"
              onClick={handleCloseCreateDialog}
              disabled={creating}
              className={cn(creating ? "cursor-not-allowed" : "cursor-pointer")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !question.trim() || !answer.trim()}
              className={cn(
                creating || !question.trim() || !answer.trim()
                  ? "cursor-not-allowed"
                  : "cursor-pointer",
              )}
            >
              {creating ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Sample"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="pb-0">
          <DialogHeader className="px-0">
            <DialogTitle>Edit {editingSample?.type} Sample</DialogTitle>
            <DialogDescription>
              Update the question and answer for this fine-tuning sample.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="edit-question" className="text-sm font-medium">
                Question <span className="text-destructive">*</span>
              </label>
              <textarea
                id="edit-question"
                name="edit-question"
                rows={4}
                placeholder="Enter the question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                disabled={updating}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-answer" className="text-sm font-medium">
                Answer <span className="text-destructive">*</span>
              </label>
              <textarea
                id="edit-answer"
                name="edit-answer"
                rows={6}
                placeholder="Enter the answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                required
                disabled={updating}
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter className="px-0">
            <Button
              variant="outline"
              onClick={handleCloseEditDialog}
              disabled={updating}
              className={cn(updating ? "cursor-not-allowed" : "cursor-pointer")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating || !question.trim() || !answer.trim()}
              className={cn(
                updating || !question.trim() || !answer.trim()
                  ? "cursor-not-allowed"
                  : "cursor-pointer",
              )}
            >
              {updating ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Sample"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="pb-0">
          <DialogHeader className="px-0">
            <DialogTitle>Import Fine-Tuning Samples</DialogTitle>
            <DialogDescription>
              Upload a {importTab} file to bulk import fine-tuning samples. Note: NLQ samples should
              have SQL commands as answers, while FAQ samples should have natural language
              responses.
            </DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="border-b border-white/10 mt-4">
            <nav className="flex space-x-8">
              <button
                onClick={() => {
                  setImportTab("CSV");
                  setImportFile(null);
                  setError(null);
                  const fileInput = document.getElementById("import-file") as HTMLInputElement;
                  if (fileInput) {
                    fileInput.value = "";
                  }
                }}
                className={cn(
                  "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
                  importTab === "CSV"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                CSV
              </button>
              <button
                onClick={() => {
                  setImportTab("JSON");
                  setImportFile(null);
                  setError(null);
                  const fileInput = document.getElementById("import-file") as HTMLInputElement;
                  if (fileInput) {
                    fileInput.value = "";
                  }
                }}
                className={cn(
                  "border-b-2 py-4 px-1 text-sm font-medium transition-colors cursor-pointer",
                  importTab === "JSON"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-white/20 hover:text-foreground",
                )}
              >
                JSON
              </button>
            </nav>
          </div>

          <div className="space-y-4 py-4">
            {importTab === "JSON" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Import Mode</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={importMode === "file" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setImportMode("file");
                      setImportText("");
                      setError(null);
                    }}
                    className="cursor-pointer"
                  >
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant={importMode === "text" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setImportMode("text");
                      setImportFile(null);
                      setError(null);
                      const fileInput = document.getElementById("import-file") as HTMLInputElement;
                      if (fileInput) {
                        fileInput.value = "";
                      }
                    }}
                    className="cursor-pointer"
                  >
                    Paste JSON
                  </Button>
                </div>
              </div>
            )}

            {importMode === "file" ? (
              <div className="space-y-2">
                <label htmlFor="import-file" className="text-sm font-medium">
                  {importTab} File <span className="text-destructive">*</span>
                </label>
                <Input
                  id="import-file"
                  name="import-file"
                  type="file"
                  accept={importTab === "CSV" ? ".csv" : ".json"}
                  onChange={handleFileSelect}
                  disabled={importing}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  {importTab} format only (Max size: 10MB)
                </p>
                {importFile && (
                  <p className="text-sm text-foreground">
                    Selected: <span className="font-medium">{importFile.name}</span> (
                    {(importFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="import-text" className="text-sm font-medium">
                  JSON Data <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="import-text"
                  name="import-text"
                  rows={12}
                  placeholder='Paste your JSON array here, e.g., [{"type": "NLQ", "question": "...", "answer": "..."}]'
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setError(null);
                  }}
                  disabled={importing}
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a valid JSON array of fine-tuning samples
                </p>
              </div>
            )}

            {importResult && (
              <div className="space-y-2">
                <div className="rounded-md bg-green-500/15 p-3 text-sm">
                  <p className="font-medium text-white">
                    Imported {importResult.imported} of {importResult.total} samples
                  </p>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-destructive mb-1">Errors:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-destructive">
                        {importResult.errors.slice(0, 10).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                        {importResult.errors.length > 10 && (
                          <li>... and {importResult.errors.length - 10} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {importTab === "CSV" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">CSV Format Example:</p>
                <p className="text-xs text-muted-foreground mb-2">
                  CSV files should have columns: type, question, answer (case-insensitive)
                </p>
                <pre className="text-xs bg-white/5 p-2 rounded border border-white/10 overflow-x-auto">
                  {`type,question,answer
NLQ,What cars are available?,SELECT * FROM "Inventory" WHERE status = 'available' LIMIT 10
FAQ,What are your hours?,We're open Monday-Friday 9am-6pm...`}
                </pre>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">JSON Format Example:</p>
                <p className="text-xs text-muted-foreground mb-2">
                  JSON files should be an array of objects with type, question, and answer fields
                </p>
                <pre className="text-xs bg-white/5 p-2 rounded border border-white/10 overflow-x-auto">
                  {`[
  {
    "type": "NLQ",
    "question": "What cars are available?",
    "answer": "SELECT * FROM \\"Inventory\\" WHERE status = 'available' LIMIT 10"
  },
  {
    "type": "FAQ",
    "question": "What are your hours?",
    "answer": "We're open Monday-Friday 9am-6pm..."
  }
]`}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter className="px-0">
            <Button
              variant="outline"
              onClick={handleCloseImportDialog}
              disabled={importing}
              className={cn(importing ? "cursor-not-allowed" : "cursor-pointer")}
            >
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={
                  importing ||
                  (importMode === "file" && !importFile) ||
                  (importMode === "text" && !importText.trim())
                }
                className={cn(
                  importing ||
                    (importMode === "file" && !importFile) ||
                    (importMode === "text" && !importText.trim())
                    ? "cursor-not-allowed"
                    : "cursor-pointer",
                )}
              >
                {importing ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
