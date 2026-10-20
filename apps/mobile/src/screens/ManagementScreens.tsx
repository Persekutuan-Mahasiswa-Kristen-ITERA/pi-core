/**
 * The four drawer screens beyond the directory: roles, periods, assignments and settings.
 *
 * All four used to be hardcoded lists — ten roles with invented grant counts, two invented periods,
 * three invented assignments naming people who are not in this organization, and a domain whitelist
 * written as a string. They now read the same endpoints the web admin does.
 *
 * They are **read-only on purpose**: creating a period or an assignment needs the pickers and the
 * unit-tree context the admin web has, and doing it half-way here would write data with less
 * information than the server needs to validate. The footer on each screen says so instead of
 * offering a control that cannot complete.
 */
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenState } from "../components/ScreenState";
import {
  ApiError,
  fetchAllowedDomains,
  fetchAssignments,
  fetchOrgSettings,
  fetchPeriods,
  fetchRoles,
  type AllowedDomain,
  type AssignmentSummary,
  type OrgSettings,
  type PeriodSummary,
  type RoleSummary,
} from "../api/resources";
import { tokens } from "../theme/tokens";

type LoadState = "loading" | "ready" | "error" | "forbidden" | "offline" | "unauthorized";

function stateForError(error: unknown): LoadState {
  if (error instanceof ApiError) {
    if (error.status === 401) return "unauthorized";
    if (error.status === 403) return "forbidden";
    return "error";
  }
  return "offline";
}

function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const reload = useCallback(() => {
    setState((current) => (current === "ready" ? current : "loading"));
    loader()
      .then((value) => {
        setData(value);
        setState("ready");
      })
      .catch((error: unknown) => setState(stateForError(error)));
  }, [loader]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, state, reload };
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.eyebrow}>Struktur &amp; Konfigurasi</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {children}
      <Text style={styles.footer}>
        Data langsung dari API. Perubahan dibuat lewat admin web.
      </Text>
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  meta,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string[];
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={16} color={tokens.colors.brown} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta.map((line) => (
          <Text key={line} style={styles.rowMeta}>
            {line}
          </Text>
        ))}
      </View>
      {trailing}
    </View>
  );
}

export function RolesScreen() {
  const { data, state, reload } = useResource(fetchRoles);

  if (state !== "ready" || data === null) {
    return <ScreenState kind={state === "ready" ? "loading" : state} onRetry={reload} />;
  }

  return (
    <Shell title="Peran & Akses (RBAC)" subtitle={`${String(data.items.length)} peran tersimpan di basis data.`}>
      {data.items.map((role: RoleSummary) => (
        <Row
          key={role.id}
          icon="shield-checkmark"
          title={role.name}
          meta={[role.key, `${String(role.permissions.length)} izin`]}
          trailing={
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{role.isSystem ? "Sistem" : "Kustom"}</Text>
            </View>
          }
        />
      ))}
    </Shell>
  );
}

export function PeriodsScreen() {
  const { data, state, reload } = useResource(fetchPeriods);

  if (state !== "ready" || data === null) {
    return <ScreenState kind={state === "ready" ? "loading" : state} onRetry={reload} />;
  }

  const ordered = [...data.items].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <Shell
      title="Periode Kepengurusan"
      subtitle={`${String(ordered.length)} periode, ${String(ordered.filter((item) => item.isActive).length)} aktif.`}
    >
      {ordered.map((period: PeriodSummary) => (
        <Row
          key={period.id}
          icon="calendar"
          title={period.label}
          meta={[`${period.startDate} — ${period.endDate}`]}
          trailing={
            period.isActive ? (
              <View style={[styles.badge, styles.badgeActive]}>
                <Text style={[styles.badgeText, styles.badgeTextActive]}>Aktif</Text>
              </View>
            ) : undefined
          }
        />
      ))}
    </Shell>
  );
}

export function AssignmentsScreen() {
  const { data, state, reload } = useResource(fetchAssignments);

  if (state !== "ready" || data === null) {
    return <ScreenState kind={state === "ready" ? "loading" : state} onRetry={reload} />;
  }

  return (
    <Shell title="Penugasan Pengurus" subtitle={`${String(data.items.length)} penugasan dalam cakupan Anda.`}>
      {data.items.map((assignment: AssignmentSummary) => (
        <Row
          key={assignment.id}
          icon="briefcase"
          title={assignment.memberName ?? assignment.memberId}
          meta={[
            `${assignment.orgUnitName ?? "—"} · ${assignment.positionName ?? "—"} (rank ${String(assignment.positionRank ?? "—")})`,
            `Periode ${assignment.periodLabel ?? "—"} · ${assignment.endsOn === null ? "Aktif" : `Selesai ${assignment.endsOn}`}`,
          ]}
        />
      ))}
    </Shell>
  );
}

export function SettingsScreen() {
  const settings = useResource(fetchOrgSettings);
  const domains = useResource(fetchAllowedDomains);

  const state = settings.state !== "ready" ? settings.state : domains.state;
  if (state !== "ready" || settings.data === null || domains.data === null) {
    return (
      <ScreenState
        kind={state === "ready" ? "loading" : state}
        onRetry={() => {
          settings.reload();
          domains.reload();
        }}
      />
    );
  }

  const org: OrgSettings | null = settings.data.settings;
  const list: AllowedDomain[] = domains.data.items;

  return (
    <Shell title="Pengaturan Organisasi" subtitle="Identitas organisasi dan domain yang boleh masuk.">
      <View style={styles.card}>
        <Text style={styles.cardLabel}>NAMA RESMI ORGANISASI</Text>
        <Text style={styles.cardValue}>{org?.orgName ?? "Belum diatur"}</Text>
        <Text style={styles.rowMeta}>
          {org?.logoKey === null || org === null ? "Belum ada logo tersimpan." : `Logo tersimpan: ${String(org.logoKey)}`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>DOMAIN EMAIL DIIZINKAN</Text>
        {list.length === 0 ? (
          <Text style={styles.rowMeta}>Belum ada domain terdaftar.</Text>
        ) : (
          <View style={styles.chips}>
            {list.map((domain) => (
              <View
                key={domain.id}
                style={[styles.chip, domain.isActive ? styles.chipActive : styles.chipInactive]}
              >
                <Text style={[styles.chipText, domain.isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                  {`@${domain.domain}${domain.isActive ? "" : " (nonaktif)"}`}
                </Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.rowMeta}>Hanya akun berdomain resmi yang diizinkan masuk.</Text>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: tokens.colors.cream },
  container: { padding: tokens.spacing.screen, gap: tokens.spacing.md, paddingBottom: 40 },
  eyebrow: { color: tokens.colors.accent, fontSize: tokens.typography.meta, fontWeight: "700", letterSpacing: 1 },
  title: { color: tokens.colors.heading, fontSize: tokens.typography.title, fontWeight: "800", marginTop: 2 },
  subtitle: { color: tokens.colors.muted, fontSize: tokens.typography.small, marginTop: 4 },
  footer: { color: tokens.colors.muted, fontSize: tokens.typography.meta, textAlign: "center", marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
    padding: tokens.spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tokens.colors.warmTint,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: tokens.colors.heading, fontSize: tokens.typography.body, fontWeight: "700" },
  rowMeta: { color: tokens.colors.muted, fontSize: tokens.typography.meta, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.pill, backgroundColor: "rgba(90,62,27,0.08)" },
  badgeActive: { backgroundColor: "rgba(5,150,105,0.08)" },
  badgeText: { color: tokens.colors.brown, fontSize: tokens.typography.meta, fontWeight: "700" },
  badgeTextActive: { color: tokens.colors.success },
  card: {
    backgroundColor: tokens.colors.white,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
    padding: tokens.spacing.md,
    gap: 6,
  },
  cardLabel: { color: tokens.colors.muted, fontSize: tokens.typography.meta, fontWeight: "700", letterSpacing: 0.5 },
  cardValue: { color: tokens.colors.heading, fontSize: 16, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: tokens.radius.pill, borderWidth: 1 },
  chipActive: { backgroundColor: "rgba(230,198,92,0.18)", borderColor: "rgba(90,62,27,0.25)" },
  chipInactive: { backgroundColor: "rgba(100,116,139,0.08)", borderColor: "rgba(100,116,139,0.25)" },
  chipText: { fontSize: tokens.typography.small, fontWeight: "700" },
  chipTextActive: { color: tokens.colors.brown },
  chipTextInactive: { color: tokens.colors.muted },
});
