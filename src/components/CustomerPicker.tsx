'use client';

import { useAuth } from '@/context/AuthContext';

export const CustomerPicker = () => {
  const {
    customerMemberships,
    activeCustomerId,
    setActiveCustomerId,
    isCustomerAdmin,
  } = useAuth();

  if (!isCustomerAdmin) {
    return null;
  }

  if (customerMemberships.length <= 1 || activeCustomerId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Velg kunde</h2>
          <p className="text-sm text-slate-500">
            Du har administratortilgang til flere kunder. Velg hvilken du ønsker å administrere nå.
          </p>
        </div>

        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {customerMemberships.map((membership) => (
            <button
              key={membership.customerId}
              onClick={() => setActiveCustomerId(membership.customerId)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-400 hover:bg-slate-50"
            >
              <div className="font-medium text-slate-900">
                {membership.customerName ?? membership.customerId}
              </div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {membership.roles.join(', ')}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

