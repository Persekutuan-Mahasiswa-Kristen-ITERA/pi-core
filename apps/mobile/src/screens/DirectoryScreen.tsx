import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenState } from "../components/ScreenState";
import { checkApiHealth } from "../api/client";
import { useMobileRealtime } from "../realtime/useRealtime";
import { tokens } from "../theme/tokens";

type DirectoryTab = "Members" | "Roles" | "Periods";

type Member = { id: string; name: string; role: string; unit: string; period: string; nim: string };

const initialMembers: Member[] = [
  { id: "1", name: "Jonathan Sitorus", role: "Ketua Umum", unit: "BPH", period: "2026/2027", nim: "121140001" },
  { id: "2", name: "Maria Simanjuntak", role: "Sekretaris", unit: "Dept Pelayanan", period: "2026/2027", nim: "121140045" },
  { id: "3", name: "Daniel Hutapea", role: "Kepala Divisi", unit: "Divisi Ibadah", period: "2026/2027", nim: "122140023" },
  { id: "4", name: "Ruth Lumbantobing", role: "Staff", unit: "Divisi Media", period: "2026/2027", nim: "123140012" },
  { id: "5", name: "Samuel Sinaga", role: "Anggota", unit: "Anggota Biasa", period: "2026/2027", nim: "124140089" },
];

export function DirectoryScreen({ canManage = true }: { canManage?: boolean }) {
  const [tab, setTab] = useState<DirectoryTab>("Members");
  const [viewState, setViewState] = useState<"ready" | "loading" | "error" | "forbidden" | "offline">("loading");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("2026/2027");
  const [roleFilter, setRoleFilter] = useState("Semua");
  const [membersList, setMembersList] = useState<Member[]>(initialMembers);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNim, setNewNim] = useState("");
  const [newRole, setNewRole] = useState("Staff");
  const [newUnit, setNewUnit] = useState("Divisi Ibadah");

  const filteredMembers = useMemo(() => membersList.filter((member) => {
    const matchesQuery =
      member.name.toLowerCase().includes(query.toLowerCase()) ||
      member.nim.includes(query) ||
      member.unit.toLowerCase().includes(query.toLowerCase());
    const matchesPeriod = period === "Semua" || member.period === period;
    const matchesRole = roleFilter === "Semua" || member.role.includes(roleFilter);
    return matchesQuery && matchesPeriod && matchesRole;
  }), [membersList, period, query, roleFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    void checkApiHealth(controller.signal).then(() => setViewState("ready")).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      setViewState(error instanceof Error && error.name === "ApiHealthError" ? "error" : "offline");
    }).finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  function retryHealthCheck() {
    setViewState("loading");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    void checkApiHealth(controller.signal).then(() => setViewState("ready")).catch((error: unknown) => {
      if (!(error instanceof Error && error.name === "AbortError")) setViewState("offline");
    }).finally(() => clearTimeout(timeout));
  }

  useMobileRealtime({
    onEvent: (event) => {
      if (["members", "periods", "roles"].includes(event.topic)) {
        retryHealthCheck();
      }
    },
    onResync: () => {
      retryHealthCheck();
    },
  });

  function handleAddMember() {
    if (!newName.trim()) return;
    const item: Member = {
      id: String(Date.now()),
      name: newName.trim(),
      role: newRole,
      unit: newUnit,
      period: "2026/2027",
      nim: newNim.trim() || "124140099",
    };
    setMembersList((prev) => [item, ...prev]);
    setNewName("");
    setNewNim("");
    setModalOpen(false);
  }

  function handleDeleteMember(id: string) {
    setMembersList((prev) => prev.filter((m) => m.id !== id));
  }

  if (viewState !== "ready") {
    return <ScreenState kind={viewState} onRetry={retryHealthCheck} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      {/* Tab Segment Controls */}
      <View style={styles.tabContainer} accessibilityRole="tablist">
        {(["Members", "Roles", "Periods"] as DirectoryTab[]).map((item) => {
          const isActive = tab === item;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={item}
              onPress={() => setTab(item)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {item === "Members" ? "Anggota" : item === "Roles" ? "Peran" : "Periode"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "Members" ? (
        <>
          {/* Search Bar with Vector Icon */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={tokens.colors.muted} style={styles.searchIcon} />
            <TextInput
              accessibilityLabel="Cari anggota"
              onChangeText={setQuery}
              placeholder="Cari nama, NIM, atau unit..."
              placeholderTextColor={tokens.colors.muted}
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={tokens.colors.muted} />
              </Pressable>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPeriod(period === "2026/2027" ? "Semua" : "2026/2027")}
              style={[styles.filterChip, period !== "Semua" && styles.filterChipActive]}
            >
              <Ionicons name="calendar-outline" size={13} color={period !== "Semua" ? tokens.colors.brown : tokens.colors.body} />
              <Text style={[styles.filterText, period !== "Semua" && styles.filterTextActive]}>
                Periode: {period}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setRoleFilter(roleFilter === "Semua" ? "Staff" : roleFilter === "Staff" ? "Kepala" : "Semua")}
              style={[styles.filterChip, roleFilter !== "Semua" && styles.filterChipActive]}
            >
              <Ionicons name="funnel-outline" size={13} color={roleFilter !== "Semua" ? tokens.colors.brown : tokens.colors.body} />
              <Text style={[styles.filterText, roleFilter !== "Semua" && styles.filterTextActive]}>
                Peran: {roleFilter}
              </Text>
            </Pressable>
          </View>

          {/* Add Member Button */}
          {canManage && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setModalOpen(true)}
              style={styles.createButton}
            >
              <Ionicons name="person-add-outline" size={17} color={tokens.colors.brown} />
              <Text style={styles.createButtonText}>Tambah Anggota Baru</Text>
            </Pressable>
          )}

          {/* Members List */}
          <View style={styles.listContainer}>
            {filteredMembers.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={36} color={tokens.colors.muted} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>Anggota tidak ditemukan</Text>
                <Text style={styles.emptyBody}>Coba ubah kata kunci atau setelan filter.</Text>
              </View>
            ) : (
              filteredMembers.map((member) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{member.name.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText}>{member.unit}</Text>
                      </View>
                      <Text style={styles.memberRoleText}>{member.role}</Text>
                    </View>
                    <Text style={styles.memberNimText}>NIM {member.nim} · {member.period}</Text>
                  </View>
                  {canManage && (
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityLabel={`Hapus ${member.name}`}
                        hitSlop={8}
                        onPress={() => handleDeleteMember(member.id)}
                        style={styles.actionButton}
                      >
                        <Ionicons name="trash-outline" size={17} color={tokens.colors.danger} />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </>
      ) : tab === "Roles" ? (
        /* Actual Roles List */
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionHeader}>10 Peran Resmi PMK ITERA</Text>
          {[
            { name: "Super Admin", scope: "O (Full Scope)", grants: "22 Izin" },
            { name: "Organization Admin", scope: "O (Organisasi)", grants: "17 Izin" },
            { name: "BPH", scope: "O (Organisasi)", grants: "7 Izin" },
            { name: "Kepala Departemen", scope: "U (Subtree)", grants: "7 Izin" },
            { name: "Sekretaris Departemen", scope: "U (Subtree)", grants: "9 Izin" },
            { name: "Kepala Divisi", scope: "U (Divisi)", grants: "6 Izin" },
            { name: "Staff Divisi", scope: "U (Divisi)", grants: "5 Izin" },
            { name: "Bendahara", scope: "U (Biro Kas)", grants: "4 Izin" },
            { name: "Panitia", scope: "U (Event)", grants: "4 Izin" },
            { name: "Anggota Biasa", scope: "S (Mandiri)", grants: "4 Izin" },
          ].map((r) => (
            <View key={r.name} style={styles.memberCard}>
              <View style={[styles.avatar, { backgroundColor: "rgba(124, 58, 237, 0.1)" }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{r.name}</Text>
                <Text style={styles.memberNimText}>Lingkup: {r.scope}</Text>
              </View>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>{r.grants}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        /* Actual Periods List */
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionHeader}>Daftar Masa Bakti Organisasi</Text>
          <View style={[styles.memberCard, { borderColor: tokens.colors.gold, borderWidth: 1.5 }]}>
            <View style={[styles.avatar, { backgroundColor: "rgba(5, 150, 105, 0.1)" }]}>
              <Ionicons name="calendar" size={18} color={tokens.colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.memberName}>2026/2027</Text>
                <View style={[styles.unitBadge, { backgroundColor: "rgba(5, 150, 105, 0.1)" }]}>
                  <Text style={[styles.unitBadgeText, { color: tokens.colors.success }]}>AKTIF</Text>
                </View>
              </View>
              <Text style={styles.memberNimText}>01 Agu 2026 s/d 31 Jul 2027</Text>
            </View>
          </View>

          <View style={styles.memberCard}>
            <View style={styles.avatar}>
              <Ionicons name="time-outline" size={18} color={tokens.colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>2025/2026</Text>
              <Text style={styles.memberNimText}>01 Agu 2025 s/d 31 Jul 2026 (Selesai)</Text>
            </View>
            <Text style={{ fontSize: 11, color: tokens.colors.muted }}>Arsip</Text>
          </View>
        </View>
      )}

      {/* Add Member Modal */}
      {modalOpen && (
        <Modal animationType="fade" transparent visible={modalOpen} onRequestClose={() => setModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Tambah Anggota Baru</Text>
                <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={tokens.colors.muted} />
                </Pressable>
              </View>

              <View style={{ gap: 12 }}>
                <View>
                  <Text style={styles.inputLabel}>Nama Lengkap *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Contoh: Daniel Sinaga"
                    value={newName}
                    onChangeText={setNewName}
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>NIM ITERA</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Contoh: 122140089"
                    value={newNim}
                    onChangeText={setNewNim}
                    keyboardType="numeric"
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>Unit Penugasan</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newUnit}
                    onChangeText={setNewUnit}
                    placeholder="Divisi Ibadah"
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>Posisi / Peran</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={newRole}
                    onChangeText={setNewRole}
                    placeholder="Staff"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelButton} onPress={() => setModalOpen(false)}>
                  <Text style={styles.cancelText}>Batal</Text>
                </Pressable>
                <Pressable style={styles.submitButton} onPress={handleAddMember}>
                  <Text style={styles.submitText}>Simpan Anggota</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 14, padding: tokens.spacing.screen, paddingBottom: 32 },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: tokens.colors.warmTint,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: tokens.colors.white,
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    color: tokens.colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: tokens.colors.heading,
    fontWeight: "700",
  },
  searchBox: {
    height: 46,
    borderRadius: 12,
    backgroundColor: tokens.colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: tokens.colors.heading,
    fontSize: 14,
    minHeight: 46,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
  },
  filterChipActive: {
    backgroundColor: "rgba(230, 198, 92, 0.2)",
    borderColor: tokens.colors.gold,
  },
  filterText: {
    color: tokens.colors.body,
    fontSize: 12,
    fontWeight: "500",
  },
  filterTextActive: {
    color: tokens.colors.brown,
    fontWeight: "700",
  },
  createButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(230, 198, 92, 0.2)",
    borderWidth: 1.5,
    borderColor: tokens.colors.gold,
  },
  createButtonText: {
    color: tokens.colors.brown,
    fontSize: 14,
    fontWeight: "700",
  },
  listContainer: {
    gap: 10,
  },
  memberCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(230, 198, 92, 0.25)",
  },
  avatarText: {
    color: tokens.colors.brown,
    fontSize: 18,
    fontWeight: "800",
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    color: tokens.colors.heading,
    fontSize: 14.5,
    fontWeight: "700",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  unitBadge: {
    backgroundColor: "rgba(161, 89, 18, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unitBadgeText: {
    color: tokens.colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  memberRoleText: {
    color: tokens.colors.muted,
    fontSize: 12,
  },
  memberNimText: {
    color: tokens.colors.muted,
    fontSize: 11.5,
    marginTop: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 4,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(225, 29, 72, 0.06)",
  },
  empty: {
    padding: 36,
    alignItems: "center",
    backgroundColor: tokens.colors.white,
    borderRadius: 12,
  },
  emptyTitle: {
    color: tokens.colors.heading,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyBody: {
    color: tokens.colors.muted,
    fontSize: 12.5,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.heading,
    marginTop: 4,
    marginBottom: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: tokens.colors.white,
    borderRadius: 16,
    padding: 22,
    shadowColor: tokens.colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: tokens.colors.heading,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: tokens.colors.secondaryHeading,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: tokens.colors.warmBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: tokens.colors.heading,
    backgroundColor: "#FBFBFA",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.06)",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelText: {
    color: tokens.colors.muted,
    fontSize: 13.5,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: tokens.colors.brown,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  submitText: {
    color: tokens.colors.white,
    fontSize: 13.5,
    fontWeight: "700",
  },
});
