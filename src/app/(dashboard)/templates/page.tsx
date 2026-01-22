'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { useAuth } from '@/context/AuthContext';
import { db, storage } from '@/lib/firebase';

type DiplomaFormValues = {
  title: string;
  body: string;
  footer: string;
  issuerName: string;
  signatureName: string;
  signatureTitle: string;
  accentColor: string;
};

const DEFAULT_TEMPLATE = {
  title: 'Kursbevis',
  body:
    'Dette bekrefter at {{participantName}} har fullført kurset {{courseName}} for {{customerName}} den {{completedDate}}.',
  footer: 'Utstedt av {{issuerName}}.',
  issuerName: 'Ikontroll',
  signatureName: '',
  signatureTitle: '',
  accentColor: '#0f172a',
};

const resolveText = (value: unknown, fallback: string) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  return fallback;
};

const applyPlaceholders = (text: string, replacements: Record<string, string>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => replacements[key] ?? '');

export default function TemplatesPage() {
  const {
    isSystemOwner,
    isCustomerAdmin,
    activeCustomerId,
    loading,
    companyId,
    profile,
    firebaseUser,
  } = useAuth();
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [templateExists, setTemplateExists] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewDownloading, setPreviewDownloading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);

  const issuerFallback = useMemo(() => {
    if (!profile?.companyIds?.length) {
      return DEFAULT_TEMPLATE.issuerName;
    }
    const currentCompany = profile.companyIds.find((entry) => entry.companyId === companyId);
    return (
      currentCompany?.displayName ??
      profile.companyIds.find((entry) => entry.displayName)?.displayName ??
      DEFAULT_TEMPLATE.issuerName
    );
  }, [companyId, profile?.companyIds]);

  const defaultValues = useMemo(
    () => ({
      ...DEFAULT_TEMPLATE,
      issuerName: issuerFallback,
    }),
    [issuerFallback],
  );

  const form = useForm<DiplomaFormValues>({ defaultValues });
  const watchedValues = form.watch();

  useEffect(() => {
    if (!loading && !isSystemOwner && isCustomerAdmin && activeCustomerId) {
      router.replace(`/customers/${activeCustomerId}`);
    }
  }, [activeCustomerId, isCustomerAdmin, isSystemOwner, loading, router]);

  useEffect(() => {
    if (!companyId || !isSystemOwner) {
      setLoadingTemplate(false);
      return;
    }
    const docRef = doc(db, 'diplomaTemplates', companyId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const data = snapshot.data() ?? {};
        const nextValues: DiplomaFormValues = {
          title: resolveText(data.title, defaultValues.title),
          body: resolveText(data.body, defaultValues.body),
          footer: resolveText(data.footer, defaultValues.footer),
          issuerName: resolveText(data.issuerName, defaultValues.issuerName),
          signatureName: resolveText(data.signatureName, defaultValues.signatureName),
          signatureTitle: resolveText(data.signatureTitle, defaultValues.signatureTitle),
          accentColor: resolveText(data.accentColor, defaultValues.accentColor),
        };
        form.reset(nextValues);
        setLogoUrl(typeof data.logoUrl === 'string' ? data.logoUrl : '');
        setSignatureUrl(typeof data.signatureUrl === 'string' ? data.signatureUrl : '');
        setTemplateExists(snapshot.exists());
        setLoadingTemplate(false);
      },
      (error) => {
        console.error('Failed to load diploma template', error);
        setErrorMessage('Kunne ikke hente diplommale.');
        setLoadingTemplate(false);
      },
    );
    return () => unsubscribe();
  }, [companyId, defaultValues, form, isSystemOwner]);

  if (!isSystemOwner) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Denne siden er kun tilgjengelig for systemeiere.
      </section>
    );
  }

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!companyId) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Logoen må være et bilde.');
      return;
    }
    setUploadingLogo(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const storageRef = ref(storage, `diplomas/${companyId}/logo.${extension}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setLogoUrl(url);
      setSuccessMessage('Logo lastet opp.');
    } catch (error) {
      console.error('Failed to upload diploma logo', error);
      setErrorMessage('Kunne ikke laste opp logoen.');
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  const handleSave = async (values: DiplomaFormValues) => {
    if (!companyId) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const docRef = doc(db, 'diplomaTemplates', companyId);
      await setDoc(
        docRef,
        {
          ...values,
          logoUrl,
          signatureUrl,
          companyId,
          updatedAt: serverTimestamp(),
          ...(templateExists ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );
      setSuccessMessage('Diplomalen er lagret.');
    } catch (error) {
      console.error('Failed to save diploma template', error);
      setErrorMessage('Kunne ikke lagre diplomet.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPreview = async () => {
    if (!companyId || !firebaseUser || previewDownloading) {
      return;
    }
    setPreviewDownloading(true);
    setPreviewError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/diploma/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          companyId,
          template: {
            ...watchedValues,
            logoUrl,
            signatureUrl,
          },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Kunne ikke laste ned forhåndsvisningen.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'diplom-preview.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download diploma preview', error);
      setPreviewError(
        error instanceof Error ? error.message : 'Kunne ikke laste ned forhåndsvisningen.',
      );
    } finally {
      setPreviewDownloading(false);
    }
  };

  const previewData = {
    participantName: 'Ola Nordmann',
    customerName: 'Eksempel AS',
    courseName: 'HMS Grunnkurs',
    completedDate: new Date().toLocaleDateString('nb-NO'),
    issuerName: watchedValues.issuerName || defaultValues.issuerName,
  };

  const previewBody = applyPlaceholders(watchedValues.body || '', previewData);
  const previewFooter = applyPlaceholders(watchedValues.footer || '', previewData);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Bibliotek
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Diplommal</h1>
        <p className="text-sm text-slate-500">
          Tilpass diplomene som sendes ut når deltakere fullfører et kurs.
        </p>
      </div>

      {loadingTemplate ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Laster diplominformasjon…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={form.handleSubmit(handleSave)}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Innhold</h2>
              <p className="text-sm text-slate-500">
                Bruk plassholdere som {'{{participantName}}'}, {'{{courseName}}'},{' '}
                {'{{customerName}}'}, {'{{completedDate}}'} og {'{{issuerName}}'}.
              </p>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Tittel
              <input
                {...form.register('title', { required: true })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Standardtekst
              <textarea
                {...form.register('body', { required: true })}
                rows={5}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Bunntekst
              <textarea
                {...form.register('footer', { required: true })}
                rows={2}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Utsteder
                <input
                  {...form.register('issuerName', { required: true })}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Aksentfarge
                <input
                  type="color"
                  {...form.register('accentColor')}
                  className="h-10 w-24 rounded-lg border border-slate-200 bg-white p-1"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Signatur - navn
                <input
                  {...form.register('signatureName')}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Signatur - tittel
                <input
                  {...form.register('signatureTitle')}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Logo</p>
              <p className="text-xs text-slate-500">
                PNG eller JPG fungerer best. Logoen vises øverst på diplomet.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Last opp bildefil
                </button>
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  disabled={!logoUrl}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Fjern logo
                </button>
                {uploadingLogo && (
                  <span className="text-xs text-slate-500">Laster opp…</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Signatur (PNG)</p>
              <p className="text-xs text-slate-500">
                Bruk en transparent PNG-signatur som vises på diplomet.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/png"
                  onChange={async (event) => {
                    if (!companyId) return;
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.type !== 'image/png') {
                      setErrorMessage('Signaturen må være en PNG-fil.');
                      return;
                    }
                    setUploadingSignature(true);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    try {
                      const storageRef = ref(storage, `diplomas/${companyId}/signature.png`);
                      await uploadBytes(storageRef, file);
                      const url = await getDownloadURL(storageRef);
                      setSignatureUrl(url);
                      setSuccessMessage('Signatur lastet opp.');
                    } catch (error) {
                      console.error('Failed to upload diploma signature', error);
                      setErrorMessage('Kunne ikke laste opp signaturen.');
                    } finally {
                      setUploadingSignature(false);
                      event.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  disabled={uploadingSignature}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Last opp signatur
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureUrl('')}
                  disabled={!signatureUrl}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Fjern signatur
                </button>
                {uploadingSignature && (
                  <span className="text-xs text-slate-500">Laster opp…</span>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Lagrer…' : 'Lagre diplom-mal'}
            </button>
          </form>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Forhåndsvisning</h2>
              <p className="text-sm text-slate-500">
                Dette er en forhåndsvisning av PDF-en.
              </p>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              {logoUrl && (
                <div className="mb-4 flex justify-center">
                  <img src={logoUrl} alt="Logo" className="h-12 object-contain" />
                </div>
              )}
              <p
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: watchedValues.accentColor || DEFAULT_TEMPLATE.accentColor }}
              >
                {watchedValues.title || DEFAULT_TEMPLATE.title}
              </p>
              <p className="mt-4 text-xl font-semibold text-slate-900">
                {previewData.participantName}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {previewData.courseName}
              </p>
              <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{previewBody}</p>
              <p className="mt-4 text-xs text-slate-500">
                Kunde: {previewData.customerName} · Dato: {previewData.completedDate}
              </p>
              <p className="mt-4 text-xs text-slate-400">{previewFooter}</p>
              <p className="mt-1 text-xs text-slate-400">
                Utstedelsesdato: {previewData.completedDate}
              </p>
              {(signatureUrl || watchedValues.signatureName || watchedValues.signatureTitle) && (
                <div className="mt-6 text-xs text-slate-500">
                  {signatureUrl && (
                    <div className="mb-2 flex justify-center">
                      <img src={signatureUrl} alt="Signatur" className="h-10 object-contain" />
                    </div>
                  )}
                  <p className="font-semibold text-slate-700">
                    {watchedValues.signatureName}
                  </p>
                  <p>{watchedValues.signatureTitle}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPreview}
                disabled={previewDownloading}
                className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {previewDownloading ? 'Laster ned forhåndsvisning…' : 'Last ned forhåndsvisning'}
              </button>
              {previewError && <p className="text-sm text-red-600">{previewError}</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

