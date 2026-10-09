import React from 'react';
import Illustration from '../assets/illustrations/Illustration';
import type { IllustrationName } from '../assets/illustrations/Illustration';
import { LogoMark } from '../assets/Logo';
import ThemeToggle from './ThemeToggle';

interface PublicLayoutProps {
  illustration: IllustrationName;
  headline: string;
  text: string;
  children: React.ReactNode;
}

/**
 * Shell for signed-out pages: the form on one side, a brand panel with an illustration on the other.
 * Below 1024px only the form shows, exactly as before.
 */
const PublicLayout: React.FC<PublicLayoutProps> = ({ illustration, headline, text, children }) => (
  <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
    <div className="relative flex items-center justify-center bg-surface-1 px-4 py-12 lg:bg-canvas">
      <div className="absolute top-4 right-4 lg:hidden"><ThemeToggle /></div>
      {children}
    </div>

    <aside className="hidden lg:flex flex-col justify-between border-l border-hairline bg-surface-1 p-12">
      <div className="flex items-center justify-between text-ink">
        <LogoMark className="h-9 w-9" />
        <ThemeToggle />
      </div>
      <Illustration name={illustration} className="mx-auto w-full max-w-md" />
      <div>
        <h2 className="text-2xl font-semibold text-ink tracking-tight">{headline}</h2>
        <p className="mt-2 max-w-md text-ink-muted">{text}</p>
      </div>
    </aside>
  </div>
);

export default PublicLayout;
