'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import type { CompanyUser, CompanyUserPayload } from '@/types/companyUser';

const ensureNorwegianPhone = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('+')) {
    return trimmed;
  }
  const digits = trimmed.replace(/\s+/g, '');
  if (digits.startsWith('0047')) {
    return `+47${digits.slice(4)}`;
  }
  if (digits.startsWith('47')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+47${digits.slice(1)}`;
  }
  return `+47${digits}`;
};

const nameField = z
  .string()
  .trim()
  .max(120, 'Navn kan ikke være lengre enn 120 tegn')
  .optional()
  .or(z.literal(''));

const userSchema = z.object({
  firstName: nameField,
  lastName: nameField,
  email: z.string().email('Ugyldig e-post'),
  phone: z.string().min(4, 'Telefon må fylles ut'),
  roles: z
    .array(z.enum(['admin', 'user']))
    .min(1, 'Velg minst én rolle'),
  status: z.enum(['active', 'inactive']),
});

type UserFormValues = z.infer<typeof userSchema>;

const defaultValues: UserFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  roles: ['user'],
  status: 'active',
};

interface Props {
  ownerCompanyId: string;
  customerId: string;
  customerName: string;
}

export default function CompanyUsersManager({
  ownerCompanyId,
  customerId,
  customerName,
}: Props) {
  const { users, loading, error, createUser, updateUser, deleteUser } =
    useCompanyUsers(ownerCompanyId, customerId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues,
  });

  const openCreate = () => {
    setEditingUser(null);
    form.reset(defaultValues);
    setIsFormOpen(true);
    setFormError(null);
  };

  const openEdit = useCallback(
    (user: CompanyUser) => {
    setEditingUser(user);
    form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      roles:
        user.customerMemberships.find(
          (membership) => membership.customerId === customerId,
        )?.roles ?? ['user'],
      status: user.status,
    });
    setIsFormOpen(true);
    setFormError(null);
    },
    [customerId, form],
  );

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
    setFormError(null);
  };

  const onSubmit = async (values: UserFormValues) => {
    try {
      setBusy(true);
      setFormError(null);
      const trimmedFirstName = values.firstName?.trim() ?? '';
      const trimmedLastName = values.lastName?.trim() ?? '';
      const normalizedEmail = values.email.trim();
      const normalizedPhone = ensureNorwegianPhone(values.phone);

      if (editingUser) {
        if (trimmedFirstName.length < 2) {
          setFormError('Fornavn må være minst 2 tegn ved redigering.');
          setBusy(false);
          return;
        }
        if (trimmedLastName.length < 2) {
          setFormError('Etternavn må være minst 2 tegn ved redigering.');
          setBusy(false);
          return;
        }
        const payload: CompanyUserPayload = {
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          roles: values.roles,
          status: values.status,
        };
        await updateUser(editingUser.id, payload, editingUser.authUid, customerName);
        closeForm();
        return;
      }

      const payload: CompanyUserPayload = {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: normalizedEmail,
        phone: normalizedPhone,
        roles: ['user'],
        status: 'active',
      };
      await createUser(payload, customerName);
      closeForm();
    } catch (err) {
      console.error('Failed to save user', err);
      setFormError(
        err instanceof Error
          ? `Kunne ikke lagre brukeren: ${err.message}`
          : 'Kunne ikke lagre brukeren.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = useCallback(
    async (user: CompanyUser) => {
      const confirmed = window.confirm(
        `Fjern ${user.firstName} ${user.lastName} fra denne kunden?`,
      );
      if (!confirmed) return;

      try {
        await deleteUser(user.id, user.authUid);
      } catch (err) {
        console.error('Failed to delete user', err);
        alert('Kunne ikke slette brukeren.');
      }
    },
    [deleteUser],
  );

  const userRows = useMemo(() => {
    if (!users.length) {
      return (
        <tr>
          <td
            colSpan={4}
            className="py-8 text-center text-sm text-slate-500"
          >
            Ingen brukere registrert ennå.
          </td>
        </tr>
      );
    }

    return users.map((user) => {
      const membership = user.customerMemberships.find(
        (entry) => entry.customerId === customerId,
      );
      const membershipRoles = membership?.roles ?? [];
      const roleLabels = membershipRoles.length
        ? membershipRoles.map((role) => (role === 'admin' ? 'Admin' : 'Bruker')).join(', ')
        : 'Ingen';
      const displayName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      const primaryLabel = displayName || user.email;

      return (
        <tr key={user.id} className="border-b border-slate-100 text-sm">
        <td className="py-3">
          <div className="font-semibold text-slate-900">{primaryLabel}</div>
          {displayName && (
            <div className="text-xs text-slate-500">{user.email}</div>
          )}
        </td>
        <td className="py-3 text-slate-600">{user.phone}</td>
        <td className="py-3">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {roleLabels}
          </span>
        </td>
        <td className="py-3">
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              user.status === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {user.status === 'active' ? 'Aktiv' : 'Inaktiv'}
          </span>
        </td>
        <td className="py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => openEdit(user)}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Rediger
            </button>
            <button
              onClick={() => handleDelete(user)}
              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Fjern bruker
            </button>
          </div>
        </td>
      </tr>
      );
    });
  }, [users, customerId, openEdit, handleDelete]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Brukere</h3>
          <p className="text-sm text-slate-500">
            Administrer tilgang for ansatte hos kunden.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          + Ny bruker
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">
          Laster brukere …
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="pb-2">Navn</th>
                <th className="pb-2">Telefon</th>
                <th className="pb-2">Roller</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Handlinger</th>
              </tr>
            </thead>
            <tbody>{userRows}</tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {editingUser ? 'Rediger bruker' : 'Ny bruker'}
                </p>
                <h4 className="text-2xl font-semibold text-slate-900">
                  {editingUser
                    ? `${editingUser.firstName} ${editingUser.lastName}`
                    : 'Brukerinformasjon'}
                </h4>
              </div>
              <button
                onClick={closeForm}
                className="text-slate-400 transition hover:text-slate-700"
                aria-label="Lukk"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            <form
              onSubmit={form.handleSubmit(
                (values) => {
                  console.log('handleSubmit success', values);
                  void onSubmit(values);
                },
                (errors) => {
                  console.error('handleSubmit validation errors', errors);
                  setFormError('Skjemaet inneholder feil. Sjekk feltene og prøv igjen.');
                },
              )}
              className="mt-6 space-y-4"
            >
              {editingUser && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Fornavn"
                    error={form.formState.errors.firstName?.message}
                  >
                    <input
                      {...form.register('firstName')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                  <Field
                    label="Etternavn"
                    error={form.formState.errors.lastName?.message}
                  >
                    <input
                      {...form.register('lastName')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                </div>
              )}
              <Field label="E-post" error={form.formState.errors.email?.message}>
                <input
                  type="email"
                  {...form.register('email')}
                  readOnly={!!editingUser}
                  aria-readonly={editingUser ? 'true' : 'false'}
                  className={`w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 ${
                    editingUser ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                  }`}
                />
              </Field>
              <Field label="Telefon" error={form.formState.errors.phone?.message}>
                <input
                  {...form.register('phone')}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
              {editingUser && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Roller" error={form.formState.errors.roles?.message}>
                    <div className="flex flex-wrap gap-4">
                      {(['admin', 'user'] as const).map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            value={role}
                            {...form.register('roles')}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                          />
                          {role === 'admin' ? 'Admin' : 'Bruker'}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field
                    label="Status"
                    error={form.formState.errors.status?.message}
                  >
                    <select
                      {...form.register('status')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="active">Aktiv</option>
                      <option value="inactive">Inaktiv</option>
                    </select>
                  </Field>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={busy}
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  onClick={() => {
                    console.log('Submit button clicked', {
                      editing: Boolean(editingUser),
                      busy,
                      values: form.getValues(),
                    });
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
                  disabled={busy}
                >
                  {busy
                    ? 'Lagrer …'
                    : editingUser
                      ? 'Oppdater bruker'
                      : 'Opprett bruker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

const Field = ({ label, error, children }: FieldProps) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
    {label}
    {children}
    {error && <span className="text-xs text-red-600">{error}</span>}
  </label>
);

