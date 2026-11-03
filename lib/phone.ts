// Teléfonos argentinos → formato internacional de WhatsApp (549 + área + número).
//
// Las pacientes escriben el número de mil maneras ("299 412-3456",
// "0299 15 412 3456", "+54 9 299…"). Si al link de wa.me le llegan los 10
// dígitos pelados, WhatsApp toma "299" como código de país (Groenlandia) y
// abre un número equivocado y más corto.
export function waNumber(raw: string | null | undefined): string | null {
  let d = (raw ?? '').replace(/\D/g, '');
  if (!d) return null;

  if (d.startsWith('00')) d = d.slice(2);           // 0054… → 54…
  if (d.startsWith('54')) d = d.slice(2);           // se rearma abajo
  if (d.startsWith('9') && d.length === 11) d = d.slice(1); // 9 de celular ya puesto
  if (d.startsWith('0')) d = d.slice(1);            // 0299… → 299…

  // Área + 15 + número (12 dígitos): se saca el 15. El área tiene 2 a 4
  // dígitos y lo que queda tiene que sumar 10.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === '15') { d = d.slice(0, area) + d.slice(area + 2); break; }
    }
  }

  // Con 10 dígitos es un número argentino completo. Si no, se deja como lo
  // escribió (puede ser del exterior o venir incompleto) para no inventar nada.
  return d.length === 10 ? `549${d}` : (raw ?? '').replace(/\D/g, '');
}

// Para avisarle a la paciente antes de reservar. Un número argentino completo
// tiene 10 dígitos (área + número). Los que empiezan con "+" y no son de
// Argentina se aceptan: pueden ser del exterior.
export function telefonoIncompleto(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (t.startsWith('+') && !t.replace(/\D/g, '').startsWith('54')) return false;
  return waNumber(t)?.length !== 13;
}
