'use client';

// Descripciones con formato.
//
// La doctora escribe las descripciones de los servicios en un textarea común.
// Este componente respeta cómo las escribió: párrafos separados por líneas en
// blanco, saltos de línea sueltos, listas cuando una línea arranca con un
// guion o un tilde (✔), y listas numeradas con "1." o "1)". Nunca interpreta
// HTML — todo se renderiza como texto, así que lo que escriba no puede romper
// la página.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

// Marcadores con los que puede arrancar un item de lista.
const BULLET_RE = /^\s*(?:[-–—*•·▪●]|✔️?|✓|✅|☑️?|➤|→|»|▸|▶)\s+/;
const NUMBERED_RE = /^\s*\d{1,2}[.)]\s+/;
// Tildes usados como separador dentro de una misma línea (descripciones viejas).
const INLINE_CHECK_RE = /[✔✓✅☑]️?/;
// Emojis que se usan como nota al pie ("💰 Valor: $59.000") y que en el texto
// viejo quedaron pegados al final del último item.
const NOTE_EMOJI_RE = /\s(?:💰|💵|💲|🏷️?|📌|📍|⏰|📅)\s/;

export type RichBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

// Corta una nota final pegada al texto: "…toda la asesoría. 💰 Valor: $59.000"
function splitTrailingNote(text: string): [string, string] | null {
  const match = text.match(NOTE_EMOJI_RE);
  if (!match || !match.index) return null;
  return [text.slice(0, match.index).trim(), text.slice(match.index).trim()];
}

// Una línea suelta con varios ✔ adentro es en realidad una lista escrita de
// corrido: "Incluye ✔ Historia clínica. ✔ Rutina personalizada. ✔ …".
// Se parte para que se vea como lista sin tener que reescribir el texto.
function splitInlineChecks(line: string): { intro: string; items: string[]; outro: string } | null {
  const parts = line.split(new RegExp(INLINE_CHECK_RE, 'g'));
  if (parts.length < 3) return null; // con un solo ✔ no hay lista que armar

  const items = parts.slice(1).map(p => p.trim()).filter(Boolean);
  if (items.length < 2) return null;

  let outro = '';
  const note = splitTrailingNote(items[items.length - 1]);
  if (note) {
    items[items.length - 1] = note[0];
    outro = note[1];
  }

  return { intro: parts[0].trim(), items, outro };
}

export function parseRichText(raw: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];
  let ordered = false;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (items.length) blocks.push({ kind: 'list', ordered, items });
    items = [];
  };

  for (const line of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const text = line.trim();

    // Línea en blanco: corta el párrafo o la lista que venía
    if (!text) {
      flushList();
      flushParagraph();
      continue;
    }

    const numbered = text.match(NUMBERED_RE);
    const bullet = numbered ?? text.match(BULLET_RE);
    if (bullet) {
      flushParagraph();
      // Pasar de viñetas a números (o al revés) arranca una lista nueva
      const isOrdered = Boolean(numbered);
      if (items.length && isOrdered !== ordered) flushList();
      ordered = isOrdered;
      items.push(text.slice(bullet[0].length).trim());
      continue;
    }

    const inline = splitInlineChecks(text);
    if (inline) {
      flushList();
      flushParagraph();
      if (inline.intro) blocks.push({ kind: 'p', text: inline.intro });
      blocks.push({ kind: 'list', ordered: false, items: inline.items });
      if (inline.outro) blocks.push({ kind: 'p', text: inline.outro });
      continue;
    }

    flushList();
    paragraph.push(text);
  }

  flushList();
  flushParagraph();
  return blocks;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseRichText(text), [text]);

  return (
    <div className={className ? `rich ${className}` : 'rich'}>
      {blocks.map((block, i) => {
        if (block.kind === 'p') return <p key={i} className="rich__p">{block.text}</p>;

        if (block.ordered) {
          return (
            <ol key={i} className="rich__list rich__list--num">
              {block.items.map((item, j) => <li key={j}>{item}</li>)}
            </ol>
          );
        }

        return (
          <ul key={i} className="rich__list">
            {block.items.map((item, j) => (
              <li key={j} className="rich__item">
                <Icon name="check" size={12} stroke={2.8} color="var(--emerald)" className="rich__check" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

interface ExpandableTextProps {
  text: string;
  /** Alto visible mientras está plegado, en px. */
  collapsedHeight?: number;
  className?: string;
}

// Muestra la descripción recortada con un degradado y un "Ver más".
// Si el texto entra entero en el alto plegado, no aparece ningún botón.
export function ExpandableText({ text, collapsedHeight = 76, className }: ExpandableTextProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);

  // El alto real del texto depende del ancho de la tarjeta, así que se vuelve
  // a medir cuando cambia (rotar el teléfono, agrandar la ventana).
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setFullHeight(el.scrollHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  // Un par de píxeles de más no justifican un "Ver más"
  const clipped = fullHeight > collapsedHeight + 12;
  const collapsed = clipped && !open;
  // El fundido arranca tarde a propósito: si empieza antes, la última línea
  // visible queda tan transparente que no se puede leer.
  const fade = 'linear-gradient(to bottom, #000 72%, transparent 100%)';

  return (
    <div className={className}>
      <div
        style={{
          overflow: 'hidden',
          maxHeight: collapsed ? collapsedHeight : fullHeight || undefined,
          transition: 'max-height .28s cubic-bezier(.4,0,.2,1)',
          maskImage: collapsed ? fade : undefined,
          WebkitMaskImage: collapsed ? fade : undefined,
        }}
      >
        <div ref={contentRef}>
          <RichText text={text} />
        </div>
      </div>

      {clipped && (
        <button type="button" className="linkbtn" aria-expanded={open}
          onClick={() => setOpen(o => !o)}>
          {open ? 'Ver menos' : 'Ver más'}
          <span className={open ? 'linkbtn__chev linkbtn__chev--open' : 'linkbtn__chev'}>
            <Icon name="chevDown" size={13} stroke={2.4} />
          </span>
        </button>
      )}
    </div>
  );
}
