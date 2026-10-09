import React from 'react';
import Illustration from '../assets/illustrations/Illustration';
import type { IllustrationName } from '../assets/illustrations/Illustration';

interface EmptyStateProps {
  illustration: IllustrationName;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}

/** A designed empty list: image, what is missing, and (optionally) what to do about it. */
const EmptyState: React.FC<EmptyStateProps> = ({ illustration, title, hint, children }) => (
  <div className="flex flex-col items-center gap-2 py-10 text-center">
    <Illustration name={illustration} className="w-44 max-w-full mb-2" />
    <p className="text-sm font-medium text-ink">{title}</p>
    {hint && <p className="text-xs text-ink-subtle max-w-xs">{hint}</p>}
    {children}
  </div>
);

export default EmptyState;
