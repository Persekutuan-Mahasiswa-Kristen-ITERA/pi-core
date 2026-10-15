/**
 * The PI-CORE organization tree as seed data — `docs/ARCHITECTURE.md` §2.
 *
 * Tree: `organization` (root) -> `bph` | 7 `department` | 1 `bureau`; each department -> `division`s.
 *
 * ⚠️ Discrepancy (2026-10-15): the §2 table lists **15** divisions, while §2's prose and story
 * 2.2's acceptance criteria say **16**. The detailed table is treated as authoritative here;
 * the missing 16th is an open question for the owner. Re-running the seed after an answer
 * updates names/counts without duplicating anything.
 */

export interface SeedUnit {
  name: string;
  slug: string;
}

export interface SeedDepartment extends SeedUnit {
  divisions: SeedUnit[];
}

/** Root of the tree (`organization`). */
export const ORG_ROOT: SeedUnit = { name: "PMK ITERA", slug: "pmk-itera" };

/** BPH — a single `bph` unit directly under the root; no divisions. */
export const BPH: SeedUnit = { name: "BPH PMK ITERA", slug: "bph" };

/** The 7 departments and their divisions. */
export const DEPARTMENTS: SeedDepartment[] = [
  {
    name: "Departemen Internal",
    slug: "departemen-internal",
    divisions: [{ name: "EO & Harmonisasi", slug: "eo-harmonisasi" }],
  },
  {
    name: "Departemen Eksternal",
    slug: "departemen-eksternal",
    divisions: [
      { name: "Intra Kampus", slug: "intra-kampus" },
      { name: "Ekstra Kampus", slug: "ekstra-kampus" },
    ],
  },
  {
    name: "Departemen Pelayanan Khusus",
    slug: "departemen-pelayanan-khusus",
    divisions: [
      { name: "Worship", slug: "worship" },
      { name: "Worship Creator", slug: "worship-creator" },
      { name: "Musik", slug: "musik" },
    ],
  },
  {
    name: "Departemen Talenta",
    slug: "departemen-talenta",
    divisions: [
      { name: "Art Interest", slug: "art-interest" },
      { name: "Ekstra Youth", slug: "ekstra-youth" },
    ],
  },
  {
    name: "Departemen Operasional",
    slug: "departemen-operasional",
    divisions: [
      { name: "Logistik", slug: "logistik" },
      { name: "Akomodasi", slug: "akomodasi" },
    ],
  },
  {
    name: "Departemen CMIT",
    slug: "departemen-cmit",
    divisions: [
      { name: "Pubdok", slug: "pubdok" },
      { name: "Desain", slug: "desain" },
      { name: "IT", slug: "it" },
    ],
  },
  {
    name: "Departemen Pembinaan Rohani",
    slug: "departemen-pembinaan-rohani",
    divisions: [
      { name: "Gospel Group", slug: "gospel-group" },
      { name: "Doa", slug: "doa" },
    ],
  },
];

/** The single bureau — directly under the root; no divisions. */
export const BUREAU: SeedUnit = { name: "Biro Kewirausahaan", slug: "biro-kewirausahaan" };

/** Expected row counts, used to assert the seed. */
export const EXPECTED_COUNTS = {
  organization: 1,
  bph: 1,
  department: DEPARTMENTS.length,
  bureau: 1,
  division: DEPARTMENTS.reduce((n, d) => n + d.divisions.length, 0),
} as const;
