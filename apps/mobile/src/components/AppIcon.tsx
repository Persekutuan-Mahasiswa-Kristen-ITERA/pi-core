import { Text } from "react-native";

import type { AppTab } from "../theme/tokens";
import { tokens } from "../theme/tokens";

type IconName = AppTab | "menu" | "bell" | "chevron" | "close";

const glyphs: Record<IconName, string> = {
  home: "⌂",
  directory: "▦",
  reports: "▥",
  profile: "○",
  menu: "☰",
  bell: "♧",
  chevron: "›",
  close: "×",
};

export function AppIcon({ name, active = false }: { name: IconName; active?: boolean }) {
  return (
    <Text
      accessibilityLabel={name}
      style={{ color: active ? tokens.colors.accent : tokens.colors.muted, fontSize: name === "menu" || name === "bell" ? 22 : 20 }}
    >
      {glyphs[name]}
    </Text>
  );
}
