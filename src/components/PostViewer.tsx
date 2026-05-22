import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PostViewer({
  post,
  onClose,
  onDeleted,
}: {
  post: Omit<FeedPost, "profiles">;
  onClose: () => void;
  onDeleted?: (postId: string) => void;
}) {
  const { user } = useAuth();
  const [fullPost, setFullPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = !!user && user.id === post.user_id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", post.user_id)
        .maybeSingle();
      if (!cancelled) {
        setFullPost({ ...post, profiles: profile ?? null });
        setLoadError(error?.message ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [post]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    setDeleting(false);
    setConfirmOpen(false);
    if (error) return toast.error(error.message);
    toast.success("Post deleted");
    onDeleted?.(post.id);
    onClose();
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center"
        role="dialog"
        aria-modal="true"
      >
        <p className="text-sm text-white/80">Loading…</p>
      </div>
    );
  }
  if (!fullPost) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <p className="px-6 text-center text-sm text-white/80">
          {loadError ? "Couldn't open this post." : "Post not found."}
        </p>
      </div>
    );
  }
  return (
    <>
      <PostCard post={fullPost} defaultOpen onCloseModal={onClose} hideArticle />
      {isOwner && (
        <button
          onClick={() => setConfirmOpen(true)}
          aria-label="Delete post"
          className="fixed top-3 right-14 z-[60] rounded-full bg-black/60 p-2 text-white hover:bg-destructive transition"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The post will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
