"use client";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/domain/types";

export interface UseChatOptions {
  workspaceId?: string;
  workloadId?: string;
  isDemo?: boolean;
  contextRoute?: string;
}

export function useChat(opts: UseChatOptions = {}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);

  // Hydrate last thread for workspace from localStorage (quick) + server
  useEffect(() => {
    const key = `modelatlas:chat:lastThread:${opts.workspaceId ?? "global"}`;
    const last = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (last) setThreadId(last);
  }, [opts.workspaceId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    setError(null);
    setLoading(true);
    // optimistic user
    const tmpUser: ChatMessage = {
      id: `tmp-${Date.now()}`,
      thread_id: threadId ?? "pending",
      role: "user",
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, tmpUser]);

    try {
      const qs = opts.isDemo ? "?demo=true" : "";
      const res = await fetch(`/api/chat${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: threadId ?? undefined,
          message: content.trim(),
          workspaceId: opts.workspaceId,
          workloadId: opts.workloadId,
          contextRoute: opts.contextRoute ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
          isDemo: opts.isDemo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Chat failed");

      const newThreadId = json.threadId as string;
      if (newThreadId && newThreadId !== threadId) {
        setThreadId(newThreadId);
        if (typeof window !== "undefined") {
          const key = `modelatlas:chat:lastThread:${opts.workspaceId ?? "global"}`;
          window.localStorage.setItem(key, newThreadId);
        }
      }
      setFallback(!!json.fallback);
      const assistant: ChatMessage = {
        id: json.threadId ? `as-${Date.now()}` : `as-${Date.now()}`,
        thread_id: newThreadId ?? threadId ?? "pending",
        role: "assistant",
        content: String(json.content ?? ""),
        citations: json.citations ?? null,
        confidence: json.confidence ?? null,
        model_provider: json.model_provider ?? null,
        created_at: new Date().toISOString(),
      };
      // replace tmp id thread_id
      setMessages((m) => {
        const withoutTmp = m.filter((x) => x.id !== tmpUser.id);
        // also patch thread_id for tmp if it was pending
        const patchedUser = { ...tmpUser, thread_id: newThreadId ?? tmpUser.thread_id };
        return [...withoutTmp, patchedUser, assistant];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // keep tmp but mark error
    } finally {
      setLoading(false);
    }
  }, [threadId, opts.workspaceId, opts.workloadId, opts.isDemo, opts.contextRoute]);

  const loadThread = useCallback(async (id: string) => {
    setThreadId(id);
    setError(null);
    try {
      const qs = new URLSearchParams({ threadId: id });
      if (opts.isDemo) qs.set("demo", "true");
      const res = await fetch(`/api/chat?${qs.toString()}`);
      const json = await res.json();
      if (json.messages) setMessages(json.messages as ChatMessage[]);
      if (typeof window !== "undefined") {
        const key = `modelatlas:chat:lastThread:${opts.workspaceId ?? "global"}`;
        window.localStorage.setItem(key, id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [opts.isDemo, opts.workspaceId]);

  const newChat = useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setError(null);
    setFallback(false);
    if (typeof window !== "undefined") {
      const key = `modelatlas:chat:lastThread:${opts.workspaceId ?? "global"}`;
      window.localStorage.removeItem(key);
    }
  }, [opts.workspaceId]);

  // Initial load if we have a threadId from localStorage
  useEffect(() => {
    if (threadId) {
      loadThread(threadId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount; subsequent changes via loadThread

  return { threadId, messages, loading, error, fallback, sendMessage, loadThread, newChat, setMessages };
}
