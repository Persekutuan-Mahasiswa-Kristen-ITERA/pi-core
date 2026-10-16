export const tokens = {
  colors: {
    brown: "#5A3E1B",
    dashboardBrown: "#924603",
    gold: "#E6C65C",
    cream: "#F8F7F6",
    warmTint: "#F2E6D9",
    warmBorder: "#E5D5C4",
    accent: "#A15912",
    heading: "#0F172A",
    secondaryHeading: "#1E293B",
    body: "#475569",
    muted: "#64748B",
    success: "#059669",
    danger: "#E11D48",
    white: "#FFFFFF",
    onLogin: "#2A1E09",
    welcomeEyebrow: "#FBECC8",
    welcomeBody: "#F8EBDD",
    black: "#000000",
    drawerOverlay: "rgba(0,0,0,0.35)",
    drawerActive: "rgba(255,255,255,0.32)",
    drawerBorder: "rgba(90,62,27,0.2)",
  },
  typography: {
    title: 24,
    screenTitle: 18,
    body: 14,
    small: 12,
    meta: 11,
  },
  radius: {
    card: 12,
    small: 8,
    pill: 30,
    phone: 40,
  },
  spacing: {
    screen: 16,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 19,
    card: 17,
  },
} as const;

export type AppTab = "home" | "directory" | "reports" | "profile";

export const tabLabels: Record<AppTab, string> = {
  home: "Home",
  directory: "Directory",
  reports: "Reports",
  profile: "Profile",
};
