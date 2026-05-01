import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "@/components/PostCard";

export function PostViewer({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("posts")
        .select("id, user_id, media_url, media_type, caption, created_at, profiles!posts_user_id_fkey(username, display_name, avatar_url)")
        .eq("id", postId)
        .maybeSingle();
      if (!cancelled) {
        setPost((data as any) ?? null);
        setLoadError(error?.message ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center" role="dialog" aria-modal="true">
        <p className="text-sm text-white/80">Loading…</p>
      </div>
    );
  }
  if (!post) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
        <p className="px-6 text-center text-sm text-white/80">{loadError ? "Couldn't open this post." : "Post not found."}</p>
      </div>
    );
  }
  return <PostCard post={post} defaultOpen onCloseModal={onClose} hideArticle />;
}
