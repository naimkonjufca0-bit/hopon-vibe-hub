import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export type FeedPost = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

export function PostCard({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [pop, setPop] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; content: string; user_id: string; created_at: string; profiles: { username: string; avatar_url: string | null } | null }>>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ count: lc }, { count: cc }, mine] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        user ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      setLikeCount(lc ?? 0);
      setCommentCount(cc ?? 0);
      setLiked(!!mine.data);
    };
    load();

    const ch = supabase
      .channel(`post-${post.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes", filter: `post_id=eq.${post.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${post.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [post.id, user]);

  const toggleLike = async () => {
    if (!user) return;
    setPop(true);
    setTimeout(() => setPop(false), 450);
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      const { error } = await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      if (error) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("id, content, user_id, created_at, profiles(username, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data as any) ?? []);
  };

  const openComments = async () => {
    setShowComments((s) => !s);
    if (!showComments) await loadComments();
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    const content = newComment.trim();
    setNewComment("");
    const { error } = await supabase.from("comments").insert({ post_id: post.id, user_id: user.id, content });
    if (error) toast.error(error.message);
    else loadComments();
  };

  const profile = post.profiles;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft animate-float-in">
      <header className="flex items-center gap-3 p-4">
        <Link to="/u/$username" params={{ username: profile?.username ?? "" }}>
          <Avatar src={profile?.avatar_url} name={profile?.username ?? "?"} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to="/u/$username" params={{ username: profile?.username ?? "" }} className="font-semibold text-sm hover:underline">
            {profile?.username ?? "user"}
          </Link>
          <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
        </div>
      </header>

      <div className="relative bg-black/40">
        {post.media_type === "video" ? (
          <video src={post.media_url} controls className="w-full max-h-[600px] object-contain" />
        ) : (
          <img src={post.media_url} alt={post.caption ?? "post"} className="w-full max-h-[600px] object-cover" loading="lazy" />
        )}
      </div>

      <div className="flex items-center gap-2 p-3">
        <button onClick={toggleLike} className="rounded-full p-2 hover:bg-secondary">
          <Heart className={`h-6 w-6 transition ${liked ? "fill-pink-500 text-pink-500" : ""} ${pop ? "animate-heart-pop" : ""}`} />
        </button>
        <button onClick={openComments} className="rounded-full p-2 hover:bg-secondary">
          <MessageCircle className="h-6 w-6" />
        </button>
        <button className="rounded-full p-2 hover:bg-secondary"><Send className="h-6 w-6" /></button>
        <button className="ml-auto rounded-full p-2 hover:bg-secondary"><Bookmark className="h-6 w-6" /></button>
      </div>

      <div className="px-4 pb-4 text-sm">
        <p className="font-semibold">{likeCount.toLocaleString()} {likeCount === 1 ? "like" : "likes"}</p>
        {post.caption && (
          <p className="mt-1">
            <span className="font-semibold mr-1">{profile?.username}</span>{post.caption}
          </p>
        )}
        {commentCount > 0 && !showComments && (
          <button onClick={openComments} className="mt-1 text-xs text-muted-foreground hover:underline">
            View all {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </button>
        )}

        {showComments && (
          <div className="mt-3 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar src={c.profiles?.avatar_url ?? null} name={c.profiles?.username ?? "?"} size={28} />
                <div className="flex-1 text-xs">
                  <span className="font-semibold mr-1">{c.profiles?.username}</span>{c.content}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
            <form onSubmit={submitComment} className="flex gap-2">
              <input
                value={newComment} onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-2xl border border-border bg-input px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
              <button className="rounded-2xl bg-brand-gradient px-3 text-xs font-semibold text-white">Post</button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover bg-secondary" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-brand-gradient grid place-items-center text-white font-bold" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
