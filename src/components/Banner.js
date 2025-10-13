import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Banner() {
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(false);

  const duration = useMemo(() => {
    const len = message?.length || 0;
    const d = Math.max(10, Math.min(60, Math.round(len / 3) || 12));
    return `${d}s`;
  }, [message]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('site_banner')
          .select('message, active')
          .eq('id', 1)
          .maybeSingle();
        if (error) {
          // Aide au diagnostic (table absente / RLS)
          // eslint-disable-next-line no-console
          console.error('Banner fetch error:', error);
        }
        if (!mounted) return;
        setMessage(data?.message || '');
        setActive(Boolean(data?.active));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Banner fetch exception:', e);
      }
    };
    load();
    const onUpdate = () => load();
    window.addEventListener('mathle:banner-updated', onUpdate);
    const t = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(t); window.removeEventListener('mathle:banner-updated', onUpdate); };
  }, []);

  if (!active || !message) return null;

  return (
    <div className="banner-container">
      <div className="banner-track">
        <div className="banner-marquee" style={{ animationDuration: duration }}>
          {message}
        </div>
      </div>
    </div>
  );
}
