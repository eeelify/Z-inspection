import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Lock, Save } from "lucide-react";
import { api } from "../api";
import { User } from "../types";

type RoleCategory = "admin" | "expert" | "viewer";

type ExpertComment = {
  expertId?: string;
  expertName?: string;
  commentText?: string;
  updatedAt?: string;
};

type ReportDoc = {
  _id?: string;
  id?: string;
  title?: string;
  status?: "draft" | "final" | "archived";
  generatedAt?: string;
  createdAt?: string;
  finalizedAt?: string;
  projectId?: { _id?: string; id?: string; title?: string } | string;
  expertComments?: ExpertComment[];
};

const getRoleCategory = (role: string | undefined): RoleCategory => {
  const r = String(role || "").toLowerCase();
  if (r.includes("admin")) return "admin";
  if (r.includes("viewer")) return "viewer";
  return "expert";
};

export function ReportReview({
  reportId,
  currentUser,
  onBack,
}: {
  reportId: string;
  currentUser: User;
  onBack: () => void;
}) {
  const roleCategory = useMemo(() => getRoleCategory(currentUser.role), [currentUser.role]);
  const [loading, setLoading] = useState(true);
  const [savingComment, setSavingComment] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [report, setReport] = useState<ReportDoc | null>(null);
  const [expertCommentDraft, setExpertCommentDraft] = useState<string>("");

  const isLocked = report?.status === "final";
  const canFinalize = roleCategory === "admin" && !isLocked;
  const canSaveExpertComment = roleCategory === "expert" && !isLocked;

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(api(`/api/reports/${reportId}?userId=${currentUser.id}`));
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error || "Report could not be loaded");
      }
      const data = (await res.json()) as ReportDoc;
      setReport(data);
      if (roleCategory === "expert") {
        const comments = Array.isArray(data.expertComments) ? data.expertComments : [];
        const mine = comments.find((c) => String(c.expertId) === String(currentUser.id)) || null;
        setExpertCommentDraft(String(mine?.commentText || ""));
      }
    } catch (e: any) {
      alert(e?.message || "Report could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, currentUser.id]);

  const handleSaveExpertComment = async () => {
    if (!canSaveExpertComment) return;
    setSavingComment(true);
    try {
      const res = await fetch(
        api(`/api/reports/${reportId}/expert-comment`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.id,
            commentText: expertCommentDraft,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error || "Failed to save comment");
      }
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to save comment");
    } finally {
      setSavingComment(false);
    }
  };

  const handleFinalize = async () => {
    if (!canFinalize) return;
    const ok = window.confirm(
      "Finalize & Lock this report?\n\nAfter finalization, experts will no longer be able to edit or comment."
    );
    if (!ok) return;

    setFinalizing(true);
    try {
      const res = await fetch(api(`/api/reports/${reportId}/finalize`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as any));
        throw new Error(err.error || "Failed to finalize report");
      }
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to finalize report");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </button>
            <div>
              <div className="text-sm text-gray-500">Report Review</div>
              <div className="text-lg font-semibold text-gray-900">{report?.title || "Report"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLocked && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold">
                <Lock className="h-3.5 w-3.5" />
                Final & Locked
              </span>
            )}

            {roleCategory === "expert" && (
              <button
                type="button"
                onClick={handleSaveExpertComment}
                disabled={!canSaveExpertComment || savingComment}
                className="relative z-50 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60 disabled:hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                style={{
                  display: "inline-flex",
                  backgroundColor: "#059669",
                  color: "#ffffff",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  boxShadow: "0 10px 24px rgba(16, 185, 129, 0.20)",
                  opacity: 1,
                  visibility: "visible",
                }}
              >
                {savingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingComment ? "Saving..." : "Save"}
              </button>
            )}

            {canFinalize && (
              <button
                onClick={handleFinalize}
                disabled={finalizing || loading}
                className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Finalize & Lock
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-6xl mx-auto">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 flex items-center justify-center text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading report...
          </div>
        ) : (
          <div className="space-y-6">
            {roleCategory === "expert" && (
              <>
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="p-6">
                    <textarea
                      value={expertCommentDraft}
                      onChange={(e) => setExpertCommentDraft(e.target.value)}
                      disabled={!canSaveExpertComment}
                      rows={14}
                      className="w-full border border-gray-200 rounded-2xl p-5 text-sm text-gray-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 disabled:bg-gray-50"
                      placeholder={isLocked ? "This report is read-only." : "Write your expert comment here..."}
                    />
                  </div>
                </div>
              </>
            )}

            {roleCategory === "admin" && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="text-sm font-semibold text-gray-900">Expert Comments</div>
                </div>
                <div className="p-5 space-y-4">
                  {Array.isArray(report?.expertComments) && report!.expertComments!.length > 0 ? (
                    report!.expertComments!.map((c, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-semibold text-gray-900">{c.expertName || "Expert"}</div>
                          <div className="text-xs text-gray-500">
                            {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : ""}
                          </div>
                        </div>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">{c.commentText || ""}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No expert comments yet.</div>
                  )}
                </div>
              </div>
            )}

            {roleCategory === "viewer" && <div />}
          </div>
        )}
      </div>
    </div>
  );
}


