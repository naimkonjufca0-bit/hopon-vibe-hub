import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/PostCard";
import { toast } from "sonner";
import { Settings, MessageCircle, Lock, Globe, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/u/$username")({ component: ProfilePage });

type Profile = { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null; is_private: boolean };
type GridPost = { id: string; media_url: string; media_type: string };

function ProfilePage() {
  const { username } = useParams({ from: "/_app/u/$username" });
  const { user, profile: me, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<GridPost[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (cancel || !prof) return;
      setProfile(prof);
      setDisplayName(prof.display_name ?? "");
      setBio(prof.bio ?? "");
      const [{ data: ps, count: pc }, { count: fc }, { count: gc }, mineFollow] = await Promise.all([
        supabase.from("posts").select("id, media_url, media_type", { count: "exact" }).eq("user_id", prof.id).order("created_at", { ascending: false }),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", prof.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", prof.id),
        user ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", prof.id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      setPosts((ps as any) ?? []);
      setStats({ posts: pc ?? 0, followers: fc ?? 0, following: gc ?? 0 });
      setFollowing(!!mineFollow.data);
    })();
    return () => { cancel = true; };
  }, [username, user]);

  if (!profile) {
    return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  }

  const isMe = me?.id === profile.id;

  const toggleFollow = async () => {
    if (!user || isMe) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
      setFollowing(false);
      setStats((s) => ({ ...s, followers: s.followers - 1 }));
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      if (error) return toast.error(error.message);
      setFollowing(true);
      setStats((s) => ({ ...s, followers: s.followers + 1 }));
    }
  };

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({ display_name: displayName, bio }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setProfile({ ...profile, display_name: displayName, bio });
    setEditing(false);
    refreshProfile();
  };

  const togglePrivacy = async () => {
    if (!isMe) return;
    const next = !profile.is_private;
    const { error } = await supabase.from("profiles").update({ is_private: next }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    setProfile({ ...profile, is_private: next });
    toast.success(next ? "Account is now private" : "Account is now public");
  };

  const deletePost = async (postId: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return toast.error(error.message);
    setPosts((ps) => ps.filter((p) => p.id !== postId));
    setStats((s) => ({ ...s, posts: Math.max(0, s.posts - 1) }));
    toast.success("Post deleted");
  };

  const onAvatar = async (file: File) => {
    if (!user) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setAvatarUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
    setAvatarUploading(false);
    if (error) return toast.error(error.message);
    setProfile({ ...profile, avatar_url: pub.publicUrl });
    refreshProfile();
    toast.success("Avatar updated");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-5">
        <label className="relative cursor-pointer">
          <Avatar src={profile.avatar_url} name={profile.username} size={88} />
          {isMe && (
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onAvatar(f); }} />
          )}
          {avatarUploading && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white text-xs">Uploading…</span>}
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate flex items-center gap-1.5">
              {profile.username}
              {profile.is_private && <Lock className="h-4 w-4 text-muted-foreground" aria-label="Private account" />}
            </h1>
            {isMe ? (
              <div className="ml-auto flex gap-2">
                <button onClick={togglePrivacy} className="rounded-2xl border border-border bg-card px-3 py-1.5 text-xs font-semibold flex items-center gap-1" title={profile.is_private ? "Make public" : "Make private"}>
                  {profile.is_private ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                  {profile.is_private ? "Private" : "Public"}
                </button>
                <button onClick={() => setEditing((v) => !v)} className="rounded-2xl border border-border bg-card px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
                  <Settings className="h-3.5 w-3.5" /> {editing ? "Cancel" : "Edit"}
                </button>
              </div>
            ) : (
              <div className="ml-auto flex gap-2">
                <button onClick={toggleFollow} className={`rounded-2xl px-4 py-1.5 text-xs font-semibold ${following ? "bg-secondary" : "bg-brand-gradient text-white shadow-glow"}`}>
                  {following ? "Following" : "Follow"}
                </button>
                <Link to="/messages/$userId" params={{ userId: profile.id }} className="rounded-2xl border border-border bg-card p-2">
                  <MessageCircle className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-5 text-sm">
            <Stat label="Posts" value={stats.posts} />
            <Stat label="Followers" value={stats.followers} />
            <Stat label="Following" value={stats.following} />
          </div>
          {profile.display_name && <p className="mt-2 text-sm font-semibold">{profile.display_name}</p>}
          {profile.bio && <p className="text-sm text-muted-foreground whitespace-pre-line">{profile.bio}</p>}
        </div>
      </header>

      {editing && isMe && (
        <div className="rounded-3xl border border-border bg-card p-4 space-y-3">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name"
            className="w-full rounded-2xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Bio"
            className="w-full rounded-2xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          <button onClick={saveProfile} className="w-full rounded-2xl bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-glow">Save</button>
        </div>
      )}

      {posts.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {posts.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
              {p.media_type === "video" ? (
                <video src={p.media_url} className="h-full w-full object-cover" />
              ) : (
                <img src={p.media_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
              {isMe && (
                <button
                  onClick={() => deletePost(p.id)}
                  aria-label="Delete post"
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
