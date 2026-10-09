import React from 'react';
import { Link } from 'react-router-dom';
import Illustration from '../assets/illustrations/Illustration';
import ThemeToggle from '../components/ThemeToggle';

const NotFound: React.FC = () => (
  <div className="relative min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-1 px-4 py-12 text-center">
    <div className="absolute top-4 right-4"><ThemeToggle /></div>
    <Illustration name="not-found" className="w-full max-w-sm" />
    <h1 className="page-title">Page not found</h1>
    <p className="max-w-sm text-ink-muted">The page you are looking for does not exist or has moved.</p>
    <Link to="/" className="btn btn-primary">Back to dashboard</Link>
  </div>
);

export default NotFound;
