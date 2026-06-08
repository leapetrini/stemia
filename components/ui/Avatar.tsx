'use client';

type Tone = 'emerald' | 'gold' | 'silver';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-tint)', fg: 'var(--emerald)' },
  gold: { bg: 'var(--gold-tint)', fg: 'var(--gold-deep)' },
  silver: { bg: 'var(--silver-tint)', fg: '#5c6168' },
};

interface AvatarProps {
  name?: string;
  initials?: string;
  tone?: Tone;
  size?: number;
}

export function Avatar({ name, initials, tone = 'emerald', size = 44 }: AvatarProps) {
  const t = TONES[tone] || TONES.emerald;
  const ini = initials || (name ? name.split(' ').map(w => w[0]).slice(0, 2).join('') : '·');
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, background: t.bg, color: t.fg, fontSize: size * 0.36 }}
    >
      {ini}
    </div>
  );
}
