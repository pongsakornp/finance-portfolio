"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const emptySubscribe = () => () => {};

export function ThemeSetting() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return (
      <ToggleGroup variant="outline" size="sm" value={["light"]}>
        <ToggleGroupItem value="light" disabled>
          <SunIcon data-icon="inline-start" /> Light
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" disabled>
          <MoonIcon data-icon="inline-start" /> Dark
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }

  const current = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[current]}
      onValueChange={(v) => {
        const next = v[0];
        if (next === "light" || next === "dark") setTheme(next);
      }}
    >
      <ToggleGroupItem value="light">
        <SunIcon data-icon="inline-start" /> Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <MoonIcon data-icon="inline-start" /> Dark
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
