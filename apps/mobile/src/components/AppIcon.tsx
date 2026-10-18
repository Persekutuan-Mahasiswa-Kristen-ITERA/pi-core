import { Ionicons } from "@expo/vector-icons";
import type { AppTab } from "../theme/tokens";
import { tokens } from "../theme/tokens";

export type IconName =
  | AppTab
  | "menu"
  | "bell"
  | "chevron"
  | "close"
  | "search"
  | "edit"
  | "trash"
  | "add"
  | "shield"
  | "calendar"
  | "briefcase"
  | "settings"
  | "checkmark";

type IoniconsGlyph = keyof typeof Ionicons.glyphMap;

const iconMap: Record<IconName, { active: IoniconsGlyph; inactive: IoniconsGlyph }> = {
  home: { active: "home", inactive: "home-outline" },
  directory: { active: "people", inactive: "people-outline" },
  reports: { active: "bar-chart", inactive: "bar-chart-outline" },
  profile: { active: "person", inactive: "person-outline" },
  menu: { active: "menu", inactive: "menu" },
  bell: { active: "notifications", inactive: "notifications-outline" },
  chevron: { active: "chevron-forward", inactive: "chevron-forward" },
  close: { active: "close", inactive: "close" },
  search: { active: "search", inactive: "search-outline" },
  edit: { active: "create", inactive: "create-outline" },
  trash: { active: "trash", inactive: "trash-outline" },
  add: { active: "add", inactive: "add" },
  shield: { active: "shield-checkmark", inactive: "shield-checkmark-outline" },
  calendar: { active: "calendar", inactive: "calendar-outline" },
  briefcase: { active: "briefcase", inactive: "briefcase-outline" },
  settings: { active: "settings", inactive: "settings-outline" },
  checkmark: { active: "checkmark-circle", inactive: "checkmark-circle-outline" },
};

export function AppIcon({
  name,
  active = false,
  size,
  color,
}: {
  name: IconName;
  active?: boolean;
  size?: number;
  color?: string;
}) {
  const glyph = iconMap[name] ? (active ? iconMap[name].active : iconMap[name].inactive) : "ellipse-outline";
  const defaultSize = name === "menu" || name === "bell" ? 22 : 20;
  const defaultColor = active ? tokens.colors.accent : tokens.colors.muted;

  return (
    <Ionicons
      name={glyph}
      size={size ?? defaultSize}
      color={color ?? defaultColor}
      accessibilityLabel={name}
    />
  );
}
