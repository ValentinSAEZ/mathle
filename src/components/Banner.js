import React, { useEffect, useMemo, useState } from 'react';
const API_URL = 'https://api.brainteaserday.com';

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
      const response = await fetch(
        `${API_URL}/api/banner`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Bandeau indisponible'
        );
      }

      if (!mounted) return;

      setMessage(data.message || '');
      setActive(Boolean(data.active));
    } catch (error) {
      console.error(
        'Banner fetch error:',
        error
      );
    }
  };

  load();

  const onUpdate = () => load();

  window.addEventListener(
    'mathle:banner-updated',
    onUpdate
  );

  const timer = setInterval(
    load,
    60000
  );

  return () => {
    mounted = false;
    clearInterval(timer);

    window.removeEventListener(
      'mathle:banner-updated',
      onUpdate
    );
  };
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
