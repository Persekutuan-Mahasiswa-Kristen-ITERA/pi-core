"use client";

import { useState, type FormEvent, type JSX } from "react";
import { UserPlus, Edit3, X, CheckCircle2, Save } from "lucide-react";

export type MemberForm = {
  fullName: string;
  email: string;
  nim: string;
  faculty: string;
  studyProgram: string;
  cohortYear: string;
  phone: string;
};

type FieldErrors = Partial<Record<keyof MemberForm, string>>;

const initialForm: MemberForm = {
  fullName: "",
  email: "",
  nim: "",
  faculty: "",
  studyProgram: "",
  cohortYear: "",
  phone: "",
};

function validate(form: MemberForm): FieldErrors {
  const errors: FieldErrors = {};
  if (form.fullName.trim().length < 2) errors.fullName = "Nama lengkap minimal 2 karakter.";
  if (!/^[^\s@]+@(itera\.ac\.id|student\.itera\.ac\.id)$/i.test(form.email.trim())) {
    errors.email = "Gunakan email resmi @itera.ac.id atau @student.itera.ac.id.";
  }
  if (form.nim.trim() !== "" && !/^\d{6,20}$/.test(form.nim.trim())) errors.nim = "NIM harus berupa 6–20 digit.";
  if (form.cohortYear.trim() !== "" && !/^\d{4}$/.test(form.cohortYear.trim())) errors.cohortYear = "Tahun angkatan harus 4 digit angka.";
  if (form.phone.trim() !== "" && !/^\+?[0-9 ()-]{8,20}$/.test(form.phone.trim())) errors.phone = "Format nomor telepon tidak valid.";
  return errors;
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  inputMode,
  placeholder,
}: {
  label: string;
  name: keyof MemberForm;
  value: string;
  onChange: (name: keyof MemberForm, value: string) => void;
  error?: string | undefined;
  type?: string | undefined;
  required?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
  placeholder?: string;
}) {
  const id = `member-${name}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span style={{ color: "var(--color-negative)", marginLeft: 2 }}>*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
      />
      {error !== undefined && (
        <span className="field-error" id={`${id}-error`} role="alert" style={{ fontSize: 11.5, color: "var(--color-negative)", marginTop: 2 }}>
          {error}
        </span>
      )}
    </div>
  );
}

export function MemberSheet({
  canCreate = true,
  mode = "create",
  initialValues = initialForm,
  onSave,
}: {
  canCreate?: boolean;
  mode?: "create" | "edit";
  initialValues?: MemberForm;
  onSave?: (form: MemberForm) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MemberForm>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  function update(name: keyof MemberForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSaved(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSaved(true);
      if (onSave) {
        onSave(form);
      }
      setTimeout(() => {
        setOpen(false);
        setSaved(false);
      }, 600);
    }
  }

  if (!canCreate) {
    return (
      <div className="state-panel forbidden-panel" role="alert">
        <div>
          <strong>Akses Dibatasi</strong>
          <p>Anda tidak memiliki izin untuk mengelola data anggota.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className={`button ${mode === "create" ? "button-gold" : "button-secondary"}`}
        type="button"
        style={mode === "edit" ? { minHeight: 32, padding: "4px 10px", fontSize: 12 } : undefined}
        onClick={() => {
          setForm(initialValues);
          setErrors({});
          setOpen(true);
          setSaved(false);
        }}
      >
        {mode === "create" ? (
          <>
            <UserPlus size={16} />
            <span>Tambah Anggota</span>
          </>
        ) : (
          <>
            <Edit3 size={13} />
            <span>Ubah</span>
          </>
        )}
      </button>

      {open && (
        <div
          className="sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <aside className="member-sheet" role="dialog" aria-modal="true" aria-labelledby="member-sheet-title">
            <div className="sheet-heading">
              <div>
                <p className="eyebrow">Direktori Anggota</p>
                <h2 id="member-sheet-title">{mode === "create" ? "Pendaftaran Anggota Baru" : "Perbarui Data Anggota"}</h2>
                <p className="subtitle">Lengkapi identitas akademik dan kontak mahasiswa PMK ITERA.</p>
              </div>
              <button className="icon-button" type="button" aria-label="Tutup formulir" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div className="form-grid" style={{ marginBottom: 20 }}>
                <Field
                  label="Nama Lengkap"
                  name="fullName"
                  value={form.fullName}
                  onChange={update}
                  error={errors.fullName}
                  placeholder="Contoh: Jonathan Sitorus"
                  required
                />
                <Field
                  label="Email ITERA"
                  name="email"
                  value={form.email}
                  onChange={update}
                  error={errors.email}
                  type="email"
                  placeholder="nama.nim@student.itera.ac.id"
                  required
                />
                <Field
                  label="NIM"
                  name="nim"
                  value={form.nim}
                  onChange={update}
                  error={errors.nim}
                  placeholder="121140001"
                />
                <Field
                  label="Tahun Angkatan"
                  name="cohortYear"
                  value={form.cohortYear}
                  onChange={update}
                  error={errors.cohortYear}
                  inputMode="numeric"
                  placeholder="2022"
                />
                <Field
                  label="Fakultas"
                  name="faculty"
                  value={form.faculty}
                  onChange={update}
                  error={errors.faculty}
                  placeholder="FTI / FS / FTSP"
                />
                <Field
                  label="Program Studi"
                  name="studyProgram"
                  value={form.studyProgram}
                  onChange={update}
                  error={errors.studyProgram}
                  placeholder="Teknik Informatika"
                />
                <Field
                  label="Nomor WhatsApp"
                  name="phone"
                  value={form.phone}
                  onChange={update}
                  error={errors.phone}
                  type="tel"
                  placeholder="+62 812-3456-7890"
                />
              </div>

              {saved && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 8,
                    backgroundColor: "rgba(5, 150, 105, 0.1)",
                    color: "var(--color-positive)",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                  role="status"
                >
                  <CheckCircle2 size={16} />
                  <span>Data anggota berhasil disimpan!</span>
                </div>
              )}

              <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <button className="button button-secondary" type="button" onClick={() => setOpen(false)}>
                  Batal
                </button>
                <button className="button button-gold" type="submit">
                  <Save size={15} />
                  <span>Simpan Data</span>
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
