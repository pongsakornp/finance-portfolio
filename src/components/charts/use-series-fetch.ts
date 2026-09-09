"use client";

import { useEffect, useState } from "react";

export function useSeriesFetch<T>(
  url: string
): { data: T | null; loading: boolean; setLoading: (v: boolean) => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((response) => response.json())
      .then(
        (json) => {
          if (cancelled) return;
          setData(json as T);
          setLoading(false);
        },
        () => {
          if (!cancelled) setLoading(false);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, setLoading };
}
