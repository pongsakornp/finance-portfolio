"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ThemeSetting() {
  const { resolvedTheme, setTheme } = useTheme();
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
