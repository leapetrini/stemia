'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';

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
    <div className="page scr-anim">
      <div className="scrhead">
        <div className="scrhead__row">
          <div>
            <h1 className="scrhead__title">Insumos</h1>
            <p className="scrhead__sub">{loading ? '…' : lowCount > 0 ? `${lowCount} con stock bajo` : 'Todo en orden'}</p>
          </div>
          <button className="btn btn--gold btn--sm">
            <Icon name="plus" size={15} color="#fff" /> Agregar
          </button>
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 24 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>
        )}
        {error && (
          <div style={{ padding: '14px 16px', borderRadius: 'var(--r)', background: 'rgba(180,83,63,.08)', color: 'var(--danger)', fontSize: 13 }}>
            Error al cargar: {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
            <Icon name="box" size={40} color="var(--faint)" />
            <p style={{ marginTop: 12, fontSize: 14 }}>No hay insumos registrados</p>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => {
              const low = item.stock <= item.min_stock;
              const pct = Math.min(100, Math.round((item.stock / Math.max(item.min_stock * 2, 1)) * 100));
              return (
                <div key={item.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: low ? 'rgba(180,83,63,.1)' : 'var(--emerald-tint)',
                      color: low ? 'var(--danger)' : 'var(--emerald)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon name={low ? 'alert' : 'box'} size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>
                        {item.category}{item.expiry ? ` · Vence ${item.expiry}` : ''}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <div style={{ height: 4, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 999, width: `${pct}%`,
                            background: low ? 'var(--danger)' : 'var(--emerald)',
                            transition: 'width .4s ease',
                          }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: low ? 'var(--danger)' : 'var(--ink)', lineHeight: 1 }}>
                        {item.stock}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{item.unit}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1 }}>mín. {item.min_stock}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
