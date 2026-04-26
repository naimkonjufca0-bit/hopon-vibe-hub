import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/PostCard";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/_app/messages/$userId")({ component: Chat });

type Msg = { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };

function Chat() {
  const { userId } = useParams({ from: "/_app/messages/$userId" });
  const { user } = useAuth();
  const [other, setOther] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("profiles").select("username, avatar_url").eq("id", userId).maybeSingle()
      .then(({ data }) => setOther(data));
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages((data as any) ?? []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    };
    load();
    const ch = supabase
      .channel(`chat-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Msg;
        if ((m.sender_id === user.id && m.receiver_id === userId) || (m.sender_id === userId && m.receiver_id === user.id)) {
          setMessages((prev) => [...prev, m]);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, userId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const content = text.trim();
    setText("");
    await supabase.from("messages").insert({ sender_id: user.id, receiver_id: userId, content });
  };

  return (
    <div className="flex h-[calc(100vh-180px)] md:h-[calc(100vh-120px)] flex-col -m-4 md:-m-8">
      <header className="flex items-center gap-3 border-b border-border bg-card/60 p-3 backdrop-blur">
        <Link to="/messages" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar src={other?.avatar_url ?? null} name={other?.username ?? "?"} size={36} />
        <p className="font-semibold">{other?.username ?? "Loading…"}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-brand-gradient text-white shadow-glow" : "bg-card border border-border"}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-border bg-card/60 p-3 backdrop-blur">
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Send a message…"
          className="flex-1 rounded-2xl border border-border bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}
