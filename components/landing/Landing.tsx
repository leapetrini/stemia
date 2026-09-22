'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';

interface LandingProps {
  onLogin: () => void;
  onBook: () => void;
}

const MENU = [
  { label: 'Tratamientos', dropdown: true },
  { label: 'Especialidades', dropdown: true },
  { label: 'Resultados', dropdown: false },
  { label: 'Contacto', dropdown: false },
];

export function Landing({ onLogin, onBook }: LandingProps) {
  // La entrada del CTA es CSS y no motion a propósito: corre fuera del hilo
  // principal, que acá importa porque el video se carga al mismo tiempo.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  return (
    <div className="w-full h-screen flex items-center justify-center p-3 md:p-5 bg-ivory">
      <section className="relative w-full max-w-[1536px] h-full rounded-[1.5rem] md:rounded-[3rem] overflow-hidden flex flex-col items-center">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-poster.jpg"
          src="/hero-pearl.mp4"
          className="absolute inset-0 w-full h-full object-cover object-[65%] lg:object-center z-0"
        />

        <div className="relative z-10 w-full h-full flex flex-col items-center">
          <nav className="flex items-center justify-between py-6 px-6 md:px-10 w-full relative z-30">
            <div className="flex-1 hidden md:block">
              <span className="tracking-tighter text-xl text-espresso">Stemia</span>
            </div>

            <ul className="hidden md:flex items-center gap-8 text-espresso text-sm list-none m-0 p-0">
              {MENU.map((item) => (
                <li
                  key={item.label}
                  onClick={onBook}
                  className="cursor-pointer hover:opacity-70 transition-opacity flex items-center gap-1 group"
                >
                  {item.label}
                  {item.dropdown && (
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  )}
                </li>
              ))}
            </ul>

            <div className="md:hidden">
              <span className="tracking-tighter text-xl text-espresso">Stemia</span>
            </div>

            <div className="flex-1 flex justify-end">
              <button
                onClick={onLogin}
                className="pressable flex items-center bg-espresso/90 text-ivory rounded-full pl-2 pr-4 md:pr-6 py-1.5 md:py-2 gap-2 md:gap-3 hover:bg-espresso border-0 cursor-pointer"
              >
                <span className="bg-ivory/20 p-1 md:p-1.5 rounded-full flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5 text-ivory" />
                </span>
                <span className="text-xs md:text-sm">Ingresar</span>
              </button>
            </div>
          </nav>

          <div className="w-full flex flex-col items-center pt-8 px-6 text-center max-w-4xl">
            <motion.div
              initial={{ opacity: 0, transform: 'translateY(20px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-ivory/70 backdrop-blur-md border border-champagne/40 mx-auto mb-3 w-fit"
            >
              <Sparkles className="w-4 h-4 text-espresso" />
              <span className="text-[14px] text-espresso">Medicina Estética</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, transform: 'scale(0.98)' }}
              animate={{ opacity: 1, transform: 'scale(1)' }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[80px] text-espresso mb-2 tracking-tight leading-[1.05] font-normal"
            >
              Tu Belleza Natural
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="text-sm sm:text-base md:text-lg text-moca opacity-90 leading-relaxed max-w-xl"
            >
              Tratamientos faciales, corporales y capilares con criterio médico. Realzamos tus rasgos,
              nunca los cambiamos.
            </motion.p>
          </div>

          {/* Único CTA de la página, en la esquina recortada. */}
          <div
            onClick={onBook}
            data-state={montado ? 'visible' : 'oculto'}
            className="cta-corner group/cta absolute bottom-0 right-0 p-3 pt-5 pl-8 sm:p-4 sm:pt-6 sm:pl-10 md:p-6 md:pt-8 md:pl-14 bg-ivory rounded-tl-[1.5rem] sm:rounded-tl-[2rem] md:rounded-tl-[3.5rem] flex items-center gap-3 sm:gap-4 md:gap-6 cursor-pointer"
          >
            <div className="absolute -top-[1.5rem] sm:-top-[2rem] md:-top-[3.5rem] right-0 w-[1.5rem] sm:w-[2rem] md:w-[3.5rem] h-[1.5rem] sm:h-[2rem] md:h-[3.5rem] pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M56 56V0C56 30.9279 30.9279 56 0 56H56Z" fill="var(--color-ivory)" />
              </svg>
            </div>

            <div className="absolute bottom-0 -left-[1.5rem] sm:-left-[2rem] md:-left-[3.5rem] w-[1.5rem] sm:w-[2rem] md:w-[3.5rem] h-[1.5rem] sm:h-[2rem] md:h-[3.5rem] pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M56 56H0C30.9279 56 56 30.9279 56 0V56Z" fill="var(--color-ivory)" />
              </svg>
            </div>

            <div className="bg-espresso w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-5 h-5 md:w-6 md:h-6 text-ivory" />
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] md:text-[11px] text-moca uppercase tracking-wider">
                Agenda abierta
              </span>
              <span className="text-[16px] md:text-[20px] text-espresso tracking-tight leading-tight">
                Reservar turno
              </span>
              <div className="flex items-center gap-1 text-moca group-hover/cta:text-espresso transition-colors">
                <span className="text-[12px] md:text-[14px]">Elegí día y horario</span>
                <ChevronRight className="w-3 h-3 md:w-4 md:h-4 transition-transform group-hover/cta:translate-x-0.5" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
