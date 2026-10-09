import React, { useEffect, useState } from 'react';

// Vetted unDraw SVGs (see docs/ASSET_SOURCES.md), recoloured to --ill-* theme tokens, loaded on demand.
const sources = {
  'secure-login': { load: () => import('./secure-login.svg?raw'), ratio: 1.0086 },
  'forgot-password': { load: () => import('./forgot-password.svg?raw'), ratio: 1.2414 },
  'reset-password': { load: () => import('./reset-password.svg?raw'), ratio: 1.5186 },
  'access-denied': { load: () => import('./access-denied.svg?raw'), ratio: 1.7833 },
  'not-found': { load: () => import('./not-found.svg?raw'), ratio: 1.506 },
  'task-list': { load: () => import('./task-list.svg?raw'), ratio: 1.0353 },
  process: { load: () => import('./process.svg?raw'), ratio: 1.9137 },
  empty: { load: () => import('./empty.svg?raw'), ratio: 1.147 },
} as const;

export type IllustrationName = keyof typeof sources;

interface IllustrationProps {
  name: IllustrationName;
  className?: string;
}

/** Decorative image: hidden from assistive tech, space reserved from the aspect ratio so nothing shifts on load. */
export const Illustration: React.FC<IllustrationProps> = ({ name, className = '' }) => {
  const [markup, setMarkup] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    sources[name].load().then(m => {
      if (live) setMarkup(m.default);
    });
    return () => {
      live = false;
    };
  }, [name]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ aspectRatio: String(sources[name].ratio) }}
      dangerouslySetInnerHTML={markup ? { __html: markup } : undefined}
    />
  );
};

export default Illustration;
