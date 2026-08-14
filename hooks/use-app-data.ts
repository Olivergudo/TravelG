"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyData, repository } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { AppData } from "@/lib/types";

export function useAppData(userId?: string) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (isSupabaseConfigured && !userId) {
      setData(emptyData);
      setReady(false);
      return;
    }
    setReady(false);
    setData(emptyData);
    const next = await repository.load();
    setData(next);
    setReady(true);
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (isSupabaseConfigured && !userId) {
      queueMicrotask(() => {
        if (!active) return;
        setData(emptyData);
        setReady(false);
      });
      return () => { active = false; };
    }
    queueMicrotask(() => {
      if (!active) return;
      setData(emptyData);
      setReady(false);
    });
    repository.load().then((next) => {
      if (!active) return;
      setData(next);
      setReady(true);
    }).catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [userId]);

  const update = (fn: (current: AppData) => AppData) => setData((current) => {
    const next = fn(current);
    repository.save(next).catch(() => undefined);
    return next;
  });

  return { data, update, ready, reload };
}
