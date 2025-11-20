'use client';

import CustomerManager from './CustomerManager';

export default function CustomersPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Administrasjon
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Kunder</h1>
        <p className="text-sm text-slate-500">
          Opprett, rediger og administrer kunder knyttet til valgt selskap.
        </p>
      </div>

      <CustomerManager />
    </section>
  );
}

