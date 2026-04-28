import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { X } from "lucide-react";

export function PostViewer({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { user: _user } = useAuth();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, media_url, media_type, caption, created_at, profiles(username, display_name, avatar_url)")
        .eq("id", postId)
        .maybeSingle();
      if (!cancelled) {
        setPost((data as any) ?? null);
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto animate-float-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed top-3 right-3 z-[60] rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="mx-auto max-w-2xl p-4 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p className="text-center text-sm text-white/80 py-12">Loading…</p>}
        {!loading && !post && <p className="text-center text-sm text-white/80 py-12">Post not found.</p>}
        {post && <PostCard post={post} />}
      </div>
    </div>
  );
}
