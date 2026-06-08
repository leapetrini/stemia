'use client';

import { useState } from 'react';
import { Landing } from '@/components/landing/Landing';
import { BookingFlow } from '@/components/booking/BookingFlow';

type Phase = 'landing' | 'booking';

export default function Home() {
  const [phase, setPhase] = useState<Phase>('landing');

  if (phase === 'booking') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
        <BookingFlow onClose={() => setPhase('landing')} />
      </div>
    );
  }

  return (
    <Landing
      onLogin={() => window.location.href = '/panel'}
      onBook={() => setPhase('booking')}
    />
  );
}
