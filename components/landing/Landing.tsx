'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon, Mark } from '@/components/ui/Icon';


interface LandingProps {
  onLogin: () => void;
  onBook: () => void;
}

export function Landing({ onLogin, onBook }: LandingProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [onMarble, setOnMarble] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setOnMarble(el.scrollTop < 80);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="lhost scr-anim">
      <div className="lscroll" ref={scrollRef}>

        {/* HERO */}
        <section className="lhero marble lhero--tall" style={{ position: 'relative' }}>
          {/* Topbar */}
          <div className={`ltopbar${onMarble ? ' ltopbar--onmarble' : ''}`}
            style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
            <div className="lbrand">
              <Mark size={34} />
              <span className="lbrand__name">Stemia</span>
            </div>
            <button className="laccess" onClick={onLogin}>
              <Icon name="lock" size={14} /> Acceso
            </button>
          </div>

          <div className="lhero__inner" style={{ paddingTop: 92 }}>
            <div className="lhero__rule" />
            <div className="lhero__eyebrow eyebrow">Medicina estética · Neuquén Capital</div>
            <h1 className="lhero__title">El arte de realzar<br />tu <em>belleza natural</em></h1>
            <p className="lhero__sub">
              Procedimientos médicos personalizados, con criterio estético y resultados sutiles. Una experiencia pensada para vos.
            </p>
            <div className="lhero__cta">
              <button className="btn btn--gold btn--lg btn--block" onClick={onBook}>
                <Icon name="calendar" size={18} color="#fff" /> Reservar consulta
              </button>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <div style={{ padding: '20px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: '.04em' }}>© 2026 Stemia · Medicina estética · Neuquén Capital</p>
        </div>

      </div>
    </div>
  );
}
