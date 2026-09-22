'use client';

import { motion } from 'motion/react';
import { MessageCircle } from 'lucide-react';

export default function WhatsAppPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-5 md:px-8 pt-4 md:pt-8 pb-3 shrink-0">
        <h1 className="text-2xl md:text-4xl text-espresso tracking-tight leading-tight">WhatsApp</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, transform: 'translateY(10px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center pb-12"
      >
        <span className="w-16 h-16 rounded-full bg-espresso/8 flex items-center justify-center mb-1">
          <MessageCircle className="w-7 h-7 text-espresso" />
        </span>
        <h2 className="text-xl md:text-2xl text-espresso tracking-tight">Próximamente</h2>
        <p className="text-[14px] text-moca leading-relaxed max-w-xs">
          La integración con WhatsApp Business estará disponible en la próxima versión.
        </p>
      </motion.div>
    </div>
  );
}
