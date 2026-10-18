"use client";

import { useState, type FormEvent, type JSX } from "react";

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
    errors.email = "Gunakan email @itera.ac.id atau @student.itera.ac.id.";
  }
  if (form.nim.trim() !== "" && !/^\d{6,20}$/.test(form.nim.trim())) errors.nim = "NIM harus berupa 6–20 digit.";
  if (form.cohortYear.trim() !== "" && !/^\d{4}$/.test(form.cohortYear.trim())) errors.cohortYear = "Tahun angkatan harus 4 digit.";
  if (form.phone.trim() !== "" && !/^\+?[0-9 ()-]{8,20}$/.test(form.phone.trim())) errors.phone = "Format nomor telepon tidak valid.";
  return errors;
}

function Field({ label, name, value, onChange, error, type = "text", required = false, inputMode }: {
  label: string;
  name: keyof MemberForm;
  value: string;
  onChange: (name: keyof MemberForm, value: string) => void;
  error?: string | undefined;
  type?: string | undefined;
  required?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  const id = `member-${name}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <input id={id} name={name} type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(name, event.target.value)} aria-invalid={error !== undefined} aria-describedby={error === undefined ? undefined : `${id}-error`} />
      {error === undefined ? null : <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}
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
      }, 700);
    }
  }

  if (!canCreate) {
    return <div className="state-panel forbidden-panel" role="alert"><div><strong>Akses ditolak</strong><p>Anda tidak memiliki izin untuk menambahkan anggota.</p></div></div>;
  }

  return (
    <>
      <button className="button member-sheet-trigger" type="button" onClick={() => { setForm(initialValues); setErrors({}); setOpen(true); setSaved(false); }}>{mode === "create" ? "+ Tambah Anggota" : "Ubah Anggota"}</button>
      {open ? <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <aside className="member-sheet" role="dialog" aria-modal="true" aria-labelledby="member-sheet-title">
          <div className="sheet-heading"><div><p className="eyebrow">Direktori</p><h2 id="member-sheet-title">{mode === "create" ? "Tambah Anggota" : "Ubah Anggota"}</h2><p className="subtitle">Lengkapi data anggota.</p></div><button className="icon-button" type="button" aria-label="Tutup formulir" onClick={() => setOpen(false)}>×</button></div>
          <form onSubmit={submit} noValidate>
            <div className="form-grid">
              <Field label="Nama lengkap" name="fullName" value={form.fullName} onChange={update} error={errors.fullName} required />
              <Field label="Email ITERA" name="email" value={form.email} onChange={update} error={errors.email} type="email" required />
              <Field label="NIM" name="nim" value={form.nim} onChange={update} error={errors.nim} />
              <Field label="Tahun angkatan" name="cohortYear" value={form.cohortYear} onChange={update} error={errors.cohortYear} inputMode="numeric" />
              <Field label="Fakultas" name="faculty" value={form.faculty} onChange={update} error={errors.faculty} />
              <Field label="Program studi" name="studyProgram" value={form.studyProgram} onChange={update} error={errors.studyProgram} />
              <Field label="Nomor telepon" name="phone" value={form.phone} onChange={update} error={errors.phone} type="tel" />
            </div>
            {saved ? <div className="success-message" role="status">✓ Berhasil disimpan!</div> : null}
            <div className="sheet-actions"><button className="button button-secondary" type="button" onClick={() => setOpen(false)}>Batal</button><button className="button" type="submit">Simpan Anggota</button></div>
          </form>
        </aside>
      </div> : null}
    </>
  );
}
