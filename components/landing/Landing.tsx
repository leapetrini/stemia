'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';

interface LandingProps {
  onBook: () => void;
}

const MENU = [
  { label: 'Tratamientos', dropdown: true },
  { label: 'Especialidades', dropdown: true },
  { label: 'Resultados', dropdown: false },
  { label: 'Contacto', dropdown: false },
];

export function Landing({ onBook }: LandingProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // El video se puede quedar pausado solo: al volver de otra pestaña, al
  // restaurar la página desde el caché del navegador, o porque el celular
  // bloqueó el autoplay. Como está en loop y sin sonido, reanudarlo no
  // molesta a nadie. El catch vacío es a propósito: si el navegador se niega
  // (por ejemplo en modo de bajo consumo), queda el poster y listo.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const reanudar = () => {
      if (v.paused) v.play().catch(() => {});
    };

    reanudar();
    document.addEventListener('visibilitychange', reanudar);
    window.addEventListener('pageshow', reanudar);
    window.addEventListener('pointerdown', reanudar, { once: true });

    return () => {
      document.removeEventListener('visibilitychange', reanudar);
      window.removeEventListener('pageshow', reanudar);
      window.removeEventListener('pointerdown', reanudar);
    };
  }, []);

  return (
    <div className="w-full h-dvh flex items-center justify-center p-3 md:p-5 bg-ivory">
      <section className="relative w-full max-w-[1536px] h-full rounded-[1.5rem] md:rounded-[3rem] overflow-hidden flex flex-col items-center">
        <video
          ref={videoRef}
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
            <div className="flex-1">
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

            {/* Contrapeso del nombre, para que el menú quede centrado. El acceso
                al panel ya no vive acá: se entra por /panel directo. */}
            <div className="flex-1" aria-hidden />
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

            {/* El CTA va acá, debajo del texto y al centro. En la esquina
                recortada se veía lindo pero la gente no entendía que era el
                botón para reservar. */}
            <motion.div
              initial={{ opacity: 0, transform: 'translateY(12px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.7, delay: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col items-center gap-2.5 mt-7 md:mt-9"
            >
              <button
                onClick={onBook}
                className="pressable flex items-center bg-espresso text-ivory rounded-full pl-2 pr-6 md:pr-8 py-2 md:py-2.5 gap-3 hover:bg-espresso/90 border-0 cursor-pointer"
              >
                <span className="bg-ivory/20 p-1.5 md:p-2 rounded-full flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5 md:w-6 md:h-6 text-ivory" />
                </span>
                <span className="text-[15px] md:text-[17px]">Reservar turno</span>
              </button>

              <span className="text-[12px] md:text-[13px] text-moca">
                Agenda abierta · elegí día y horario
              </span>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
