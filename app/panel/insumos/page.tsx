'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type InventoryRow = {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  lot: string | null;
  expiry: string | null;
};

export default function InsumosPage() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('inventory')
      .select('id, name, category, stock, min_stock, unit, lot, expiry')
      .order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          // Los que están bajo mínimo van primero: es lo que hay que ver sí o sí.
          const sorted = ((data as InventoryRow[]) ?? []).sort((a, b) => {
            const aLow = a.stock <= a.min_stock;
            const bLow = b.stock <= b.min_stock;
            return aLow === bLow ? 0 : aLow ? -1 : 1;
          });
          setItems(sorted);
        }
        setLoading(false);
      });
  }, []);

  const lowCount = items.filter(i => i.stock <= i.min_stock).length;

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 md:px-8 pt-4 md:pt-8 pb-3 shrink-0 flex flex-col gap-0.5">
        <h1 className="text-2xl md:text-4xl text-espresso tracking-tight leading-tight">Insumos</h1>
        <span className={`text-[12px] md:text-[13px] ${lowCount > 0 ? 'text-terracota' : 'text-moca'}`}>
          {loading ? '…' : lowCount > 0 ? `${lowCount} con stock bajo` : 'Todo en orden'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8">
        {error && (
          <div className="rounded-[1.25rem] bg-terracota/10 border border-terracota/25 p-4 text-[13px] text-terracota">
            No pudimos leer los insumos: {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2.5 py-10 text-moca">
            <LoaderCircle className="spinner w-4 h-4" />
            <span className="text-[13px]">Cargando…</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 py-10 text-center text-[13px] text-moca">
            Todavía no hay insumos cargados
          </div>
        )}

        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const bajo = item.stock <= item.min_stock;
            // La barra se llena contra el doble del mínimo: así el mínimo cae
            // siempre a la mitad y se lee de un vistazo si estás por debajo.
            const pct = Math.min(100, Math.round((item.stock / Math.max(item.min_stock * 2, 1)) * 100));

            return (
              <div
                key={item.id}
                className={`p-3.5 md:p-4 rounded-[1.25rem] bg-ivory border flex items-center gap-3.5 ${
                  bajo ? 'border-terracota/30' : 'border-champagne/50'
                }`}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {bajo && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-terracota" />}
                    <span className="text-[15px] text-espresso truncate">{item.name}</span>
                  </div>

                  <div className="text-[11.5px] text-moca truncate">
                    {[item.category, item.lot ? `Lote ${item.lot}` : null, item.expiry ? `Vence ${item.expiry}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>

                  <div className="h-1 rounded-full bg-porcelain overflow-hidden max-w-[320px]">
                    <div
                      className={`h-full rounded-full ${bajo ? 'bg-terracota' : 'bg-espresso'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className={`text-[22px] md:text-[26px] tracking-tight leading-none ${bajo ? 'text-terracota' : 'text-espresso'}`}>
                    {item.stock}
                  </div>
                  <div className="text-[11px] text-moca mt-1">{item.unit}</div>
                  <div className="text-[11px] text-moca">mín. {item.min_stock}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
