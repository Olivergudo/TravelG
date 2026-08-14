"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyData, repository } from "@/lib/repository";
import type { AppData } from "@/lib/types";

export function useAppData() {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const next = await repository.load();
    setData(next);
    setReady(true);
  }, []);

  useEffect(() => {
    repository.load().then((next) => {
      setData(next);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const update = (fn: (current: AppData) => AppData) => setData((current) => {
    const next = fn(current);
    repository.save(next).catch(() => undefined);
    return next;
  });

  return { data, update, ready, reload };
}
