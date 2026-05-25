"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Paper } from "@/app/api/papers/route";

const SESSION_KEY = "paperswipe_feed_cache";
export const GUEST_FILTERS_KEY = "paperswipe_guest_filters";
const PREFETCH_THRESHOLD = 5;

export interface GuestFilters {
  keywords: string[];
  dateRange: string;
  venues: string[];
}

function readGuestFilters(): GuestFilters | null {
  try {
    const raw = sessionStorage.getItem(GUEST_FILTERS_KEY);
    return raw ? (JSON.parse(raw) as GuestFilters) : null;
  } catch {
    return null;
  }
}

function buildPapersUrl(): string {
  const filters = readGuestFilters();
  if (!filters) return "/api/papers";
  const params = new URLSearchParams({ dateRange: filters.dateRange });
  filters.keywords.forEach((k) => params.append("keyword", k));
  filters.venues.forEach((v) => params.append("venue", v));
  return `/api/papers?${params}`;
}

async function fetchBatch(): Promise<Paper[]> {
  const res = await fetch(buildPapersUrl());
  if (!res.ok) throw new Error("Failed to fetch papers");
  const data = await res.json();
  return data.papers as Paper[];
}

async function markSeen(ids: string[]) {
  if (ids.length === 0) return;
  // Silently ignore 401 for guests
  fetch("/api/user/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => {});
}

export function usePaperFeed() {
  const [queue, setQueue] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefetching = useRef(false);
  const undoStack = useRef<Paper[]>([]);

  const prefetch = useCallback(async () => {
    if (prefetching.current) return;
    prefetching.current = true;
    try {
      const papers = await fetchBatch();
      setQueue((prev) => {
        const updated = [...prev, ...papers];
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {}
    prefetching.current = false;
  }, []);

  const loadInitial = useCallback(async () => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        const papers: Paper[] = JSON.parse(cached);
        if (papers.length > 0) {
          setQueue(papers);
          setLoading(false);
          return;
        }
      }
    } catch {}

    try {
      const papers = await fetchBatch();
      setQueue(papers);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(papers));
    } catch {
      setError("Could not load papers. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFront = useCallback(
    (paper: Paper) => {
      undoStack.current.push(paper);
      if (undoStack.current.length > 5) undoStack.current.shift();

      setQueue((prev) => {
        const next = prev.slice(1);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        if (next.length <= PREFETCH_THRESHOLD) prefetch();
        return next;
      });

      markSeen([paper.id]);
    },
    [prefetch]
  );

  const skip = useCallback((paper: Paper) => removeFront(paper), [removeFront]);
  const save = useCallback((paper: Paper) => removeFront(paper), [removeFront]);
  const maybe = useCallback((paper: Paper) => removeFront(paper), [removeFront]);

  const undo = useCallback(() => {
    const paper = undoStack.current.pop();
    if (!paper) return;
    setQueue((prev) => {
      const next = [paper, ...prev];
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return { papers: queue, loading, error, skip, save, maybe, undo, isEmpty: !loading && queue.length === 0 };
}
