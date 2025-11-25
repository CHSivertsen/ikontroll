'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useAuth } from '@/context/AuthContext';
import { useCustomers } from '@/hooks/useCustomers';
import type { Customer, CustomerPayload } from '@/types/customer';

type BrregSuggestion = {
  orgNumber: string;
  companyName: string;
  address: string;
  postalCode: string;
  city: string;
};

const splitContactName = (fullName: string) => {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: 'Kontakt', lastName: 'Person' };
  }
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return {
    firstName,
    lastName: rest.length ? rest.join(' ') : firstName,
  };
};

const extractApiErrorMessage = async (response: Response) => {
  const text = await response.text();
  try {
    const data = text ? (JSON.parse(text) as { error?: string }) : null;
    if (data?.error) {
      return data.error;
    }
  } catch {
    // ignore JSON parse errors
  }
  return text || `Serverfeil (${response.status})`;
};

const passwordSchema = z
  .string()
  .min(8, 'Passord må være minst 8 tegn')
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Passord må inneholde både bokstaver og tall');

const customerSchema = z.object({
  companyName: z.string().min(2, 'Firmanavn må være minst 2 tegn'),
  address: z.string().min(2, 'Adresse må fylles ut'),
  zipno: z.string().min(4, 'Postnr må være minst 4 tegn'),
  place: z.string().min(2, 'Poststed må fylles ut'),
  vatNumber: z.string().min(1, 'Org.nr/VAT må fylles ut'),
  status: z.enum(['active', 'inactive']),
  contactPerson: z.string().min(2, 'Kontaktperson må fylles ut'),
  contactPhone: z.string().min(4, 'Telefon må fylles ut'),
  contactEmail: z.string().email('Ugyldig e-postadresse'),
  contactPassword: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.trim() : undefined),
      passwordSchema,
    )
    .optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const defaultValues: CustomerFormValues = {
  companyName: '',
  address: '',
  zipno: '',
  place: '',
  vatNumber: '',
  status: 'active',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  contactPassword: '',
};

const statusBadges: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-600',
};

export default function CustomerManager() {
  const { companyId } = useAuth();
  const {
    customers,
    loading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  } = useCustomers(companyId ?? null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<BrregSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const companyNameInputRef = useRef<HTMLInputElement>(null);
  const skipLookupRef = useRef(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  });
  const companyNameValue = form.watch('companyName');

  const createContactAdminUser = useCallback(
    async (
      customerId: string,
      password: string,
      values: CustomerFormValues,
    ) => {
      if (!companyId) {
        throw new Error('Ingen systemeier er valgt.');
      }
      const trimmedPassword = password.trim();
      if (!trimmedPassword) {
        throw new Error('Passord for kontaktperson må fylles ut.');
      }
      const { firstName, lastName } = splitContactName(values.contactPerson);
      const response = await fetch('/api/company-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          customerId,
          customerName: values.companyName,
          user: {
            firstName,
            lastName,
            email: values.contactEmail,
            phone: values.contactPhone,
            roles: ['admin'],
            status: 'active',
          },
          password: trimmedPassword,
        }),
      });
      if (!response.ok) {
        const message = await extractApiErrorMessage(response);
        throw new Error(message ?? 'Kunne ikke opprette kontaktperson.');
      }
    },
    [companyId],
  );

  useEffect(() => {
    if (!isFormOpen) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (skipLookupRef.current) {
      skipLookupRef.current = false;
      return;
    }

    const value = companyNameValue?.trim() ?? '';

    if (!value) {
      setShowSuggestions(false);
      setSuggestions([]);
      setSuggestionError(null);
      return;
    }
    if (value.length < 3) {
      setSuggestions([]);
      setSuggestionError(null);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setSuggestionLoading(true);
        setSuggestionError(null);
        const response = await fetch(
          `/api/brreg/search?q=${encodeURIComponent(value)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error('Ikke-ok respons');
        }
        const data = (await response.json()) as BrregSuggestion[];
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Brreg lookup failed', err);
        setSuggestionError('Kunne ikke hente data fra Brreg');
        setSuggestions([]);
        setShowSuggestions(true);
      } finally {
        if (!controller.signal.aborted) setSuggestionLoading(false);
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [companyNameValue, isFormOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openCreate = () => {
    setEditingCustomer(null);
    form.reset(defaultValues);
    setIsFormOpen(true);
    setFormError(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSuggestionSelect = (suggestion: BrregSuggestion) => {
    skipLookupRef.current = true;
    form.setValue('companyName', suggestion.companyName, {
      shouldValidate: true,
    });
    if (suggestion.orgNumber) {
      form.setValue('vatNumber', suggestion.orgNumber, { shouldValidate: true });
    }
    if (suggestion.address) {
      form.setValue('address', suggestion.address, { shouldValidate: true });
    }
    if (suggestion.postalCode) {
      form.setValue('zipno', suggestion.postalCode, { shouldValidate: true });
    }
    if (suggestion.city) {
      form.setValue('place', suggestion.city, { shouldValidate: true });
    }

    setSuggestionError(null);
    setShowSuggestions(false);
    setSuggestions([]);
    requestAnimationFrame(() => {
      companyNameInputRef.current?.blur();
    });
  };

  const openEdit = useCallback(
    (customer: Customer) => {
      skipLookupRef.current = true;
      setEditingCustomer(customer);
      form.reset({
        companyName: customer.companyName,
        address: customer.address,
        zipno: customer.zipno,
        place: customer.place,
        vatNumber: customer.vatNumber,
        status: customer.status,
        contactPerson: customer.contactPerson,
        contactPhone: customer.contactPhone,
        contactEmail: customer.contactEmail,
        contactPassword: '',
      });
      setIsFormOpen(true);
      setFormError(null);
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [form],
  );

  const closeForm = () => {
    if (busy) return;
    setIsFormOpen(false);
    setEditingCustomer(null);
    setFormError(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const onSubmit = async (values: CustomerFormValues) => {
    const { contactPassword, ...customerValues } = values;
    try {
      setBusy(true);
      setFormError(null);
      const payload: CustomerPayload = {
        ...customerValues,
      };

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
      } else {
        if (!contactPassword?.trim()) {
          setFormError('Kontaktpersonens passord må fylles ut.');
          setBusy(false);
          return;
        }
        let createdCustomerId: string | null = null;
        try {
          createdCustomerId = await createCustomer(payload);
          await createContactAdminUser(createdCustomerId, contactPassword, values);
        } catch (err) {
          if (createdCustomerId) {
            await deleteCustomer(createdCustomerId).catch((deleteErr) =>
              console.error('Kunne ikke rulle tilbake opprettet kunde', deleteErr),
            );
          }
          throw err;
        }
      }
      setIsFormOpen(false);
      setEditingCustomer(null);
      form.reset(defaultValues);
    } catch (err) {
      console.error('Failed to save customer', err);
      setFormError(
        err instanceof Error ? err.message : 'Kunne ikke lagre kunden. Prøv igjen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = useCallback(
    async (customer: Customer) => {
      const confirmed = window.confirm(
        `Slett ${customer.companyName}? Dette kan ikke angres.`,
      );
      if (!confirmed) return;

      try {
        await deleteCustomer(customer.id);
      } catch (err) {
        console.error('Failed to delete customer', err);
        alert('Kunne ikke slette kunden.');
      }
    },
    [deleteCustomer],
  );

  const tableRows = useMemo(() => {
    if (!customers.length) {
      return (
        <tr>
          <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
            Ingen kunder registrert ennå.
          </td>
        </tr>
      );
    }

    return customers.map((customer) => (
      <tr
        key={customer.id}
        className="border-b border-slate-100 text-sm last:border-none"
      >
        <td className="py-3">
          <div>
            <p className="font-semibold text-slate-900">
              {customer.companyName}
            </p>
            <p className="text-xs text-slate-500">
              {customer.address}, {customer.zipno} {customer.place}
            </p>
          </div>
        </td>
        <td className="py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">
              {customer.contactPerson}
            </p>
            <p className="text-xs text-slate-500">{customer.contactEmail}</p>
            <p className="text-xs text-slate-500">{customer.contactPhone}</p>
          </div>
        </td>
        <td className="py-3">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadges[customer.status]}`}
          >
            {customer.status === 'active' ? 'Aktiv' : 'Inaktiv'}
          </span>
        </td>
        <td className="py-3 text-sm text-slate-600">{customer.vatNumber}</td>
        <td className="py-3 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={`/customers/${customer.id}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Administrer brukere"
            >
              <span className="text-xs font-semibold">👥</span>
            </Link>
            <button
              onClick={() => openEdit(customer)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="Rediger kunde"
            >
              <span className="text-xs font-semibold">✏️</span>
            </button>
            <button
              onClick={() => handleDelete(customer)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:border-red-300 hover:bg-red-50"
              aria-label="Slett kunde"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15 5 5 15M5 5l10 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    ));
  }, [customers, openEdit, handleDelete]);

  if (!companyId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Velg et selskap i toppen før du kan administrere kunder.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kunder</h2>
            <p className="text-sm text-slate-500">
              Hold oversikt over alle kunder tilknyttet selskapet.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Ny kunde
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            Laster kunder …
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="pb-2">Firma</th>
                  <th className="pb-2">Kontakt</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Org.nr</th>
                  <th className="pb-2 text-right">Handlinger</th>
                </tr>
              </thead>
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {editingCustomer ? 'Rediger kunde' : 'Ny kunde'}
                </p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {editingCustomer
                    ? editingCustomer.companyName
                    : 'Kundeinformasjon'}
                </h3>
              </div>
              <button
                onClick={closeForm}
                className="text-slate-400 transition hover:text-slate-700"
                aria-label="Lukk skjema"
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
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-6 space-y-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2" ref={suggestionRef}>
                  <Field
                    label="Firmanavn"
                    error={form.formState.errors.companyName?.message}
                    hint="Søk henter data fra Brønnøysundregisteret"
                  >
                    <input
                      ref={companyNameInputRef}
                      {...form.register('companyName')}
                      onFocus={() => {
                        if (suggestions.length) setShowSuggestions(true);
                      }}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                  {showSuggestions && (
                    <div className="relative">
                      <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        {suggestionLoading && (
                          <p className="px-4 py-3 text-sm text-slate-500">
                            Søker i Brreg …
                          </p>
                        )}
                        {suggestionError && (
                          <p className="px-4 py-3 text-sm text-red-600">
                            {suggestionError}
                          </p>
                        )}
                        {!suggestionLoading &&
                          !suggestionError &&
                          suggestions.map((suggestion) => {
                            const locationText = [
                              suggestion.address?.trim(),
                              `${suggestion.postalCode} ${suggestion.city}`.trim(),
                            ]
                              .filter((part) => part && part !== '')
                              .join(', ');

                            return (
                              <button
                                key={suggestion.orgNumber}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  handleSuggestionSelect(suggestion);
                                }}
                                className="flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-slate-50 last:border-none"
                              >
                                <span className="font-semibold text-slate-900">
                                  {suggestion.companyName}
                                </span>
                                <span className="text-xs text-slate-500">
                                  Org.nr {suggestion.orgNumber}
                                </span>
                                {locationText && (
                                  <span className="text-xs text-slate-500">
                                    {locationText}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        {!suggestionLoading &&
                          !suggestionError &&
                          !suggestions.length && (
                            <p className="px-4 py-3 text-sm text-slate-500">
                              Ingen treff
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                </div>
                <Field
                  label="Org.nr / VAT"
                  error={form.formState.errors.vatNumber?.message}
                >
                  <input
                    {...form.register('vatNumber')}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field label="Adresse" error={form.formState.errors.address?.message}>
                  <input
                    {...form.register('address')}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Postnr" error={form.formState.errors.zipno?.message}>
                    <input
                      {...form.register('zipno')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                  <Field label="Poststed" error={form.formState.errors.place?.message}>
                    <input
                      {...form.register('place')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                </div>
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

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Kontaktperson"
                  error={form.formState.errors.contactPerson?.message}
                >
                  <input
                    {...form.register('contactPerson')}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field
                  label="Telefon"
                  error={form.formState.errors.contactPhone?.message}
                >
                  <input
                    {...form.register('contactPhone')}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field
                  label="E-post"
                  error={form.formState.errors.contactEmail?.message}
                >
                  <input
                    type="email"
                    {...form.register('contactEmail')}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                {!editingCustomer && (
                  <Field
                    label="Passord for kontaktperson"
                    error={form.formState.errors.contactPassword?.message}
                  >
                    <input
                      type="text"
                      {...form.register('contactPassword')}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                )}
              </div>

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
                  disabled={busy}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                >
                  {busy
                    ? 'Lagrer …'
                    : editingCustomer
                      ? 'Oppdater kunde'
                      : 'Opprett kunde'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

const Field = ({ label, error, hint, children }: FieldProps) => (
  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
    <span>{label}</span>
    {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
    {children}
    {error && <span className="text-xs text-red-600">{error}</span>}
  </label>
);

