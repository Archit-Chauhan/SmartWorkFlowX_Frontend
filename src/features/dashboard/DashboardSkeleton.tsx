import React from 'react';

const Block: React.FC<{ className: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-control bg-surface-2 ${className}`} />
);

const CardSkeleton: React.FC<{ chartHeight: string; className?: string }> = ({ chartHeight, className = '' }) => (
  <div className={`card card-pad ${className}`}>
    <Block className="h-5 w-40" />
    <Block className="h-3 w-56 mt-2 mb-4" />
    <Block className={`w-full ${chartHeight}`} />
  </div>
);

/** Placeholder with the same block sizes as the loaded dashboard, so nothing jumps when data arrives. */
const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6" role="status" aria-label="Loading dashboard">
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card p-4">
          <Block className="h-3 w-16" />
          <Block className="h-8 w-20 mt-2" />
          <Block className="h-3 w-24 mt-3" />
        </div>
      ))}
    </div>
    <CardSkeleton chartHeight="h-72" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <CardSkeleton chartHeight="h-56" />
      <CardSkeleton chartHeight="h-56" />
      <CardSkeleton chartHeight="h-56" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CardSkeleton chartHeight="h-64" />
      <CardSkeleton chartHeight="h-64" />
    </div>
  </div>
);

export default DashboardSkeleton;
