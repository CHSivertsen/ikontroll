'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConsumerRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/my-courses');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
      Laster ...
    </div>
  );
}

