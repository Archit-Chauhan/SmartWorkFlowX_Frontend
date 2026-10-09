import React, { useEffect, useState } from 'react';
import PublicLayout from '../../components/PublicLayout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  not_registered: "This Google account is not registered in the system. Please contact your administrator to get access.",
  deactivated: "Your account has been deactivated. Please contact your administrator.",
  auth_failed: "Google authentication failed. Please try again.",
};

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(ERROR_MESSAGES[errorParam] ?? "Authentication failed. Please try again.");
      return;
    }

    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const role = searchParams.get('role');

    if (token && email && role) {
      // Store token and auth state exactly as AuthContext expects
      localStorage.setItem('token', token);
      localStorage.setItem('email', email);
      localStorage.setItem('role', role);

      // Full page reload to allow AuthContext to mount with the new state
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } else {
      setError("Failed to authenticate with external provider. Missing token or user info.");
    }
  }, [searchParams]);

  if (error) {
    return (
      <PublicLayout illustration="access-denied" headline="We couldn't sign you in" text="Check that your Google account is registered with SmartWorkFlowX, then try again.">
        <div className="w-full max-w-[400px] card card-pad text-center">
          <AlertCircle className="mx-auto text-error mb-4" size={48} />
          <h2 className="section-title mb-2">Authentication Error</h2>
          <p className="text-ink-muted mb-6">{error}</p>
          <button 
            onClick={() => navigate('/login')}
            className="btn btn-primary w-full"
          >
            Back to Login
          </button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout illustration="process" headline="Signing you in" text="Hang tight while we confirm your account.">
      <div className="flex flex-col items-center text-center">
        <Loader2 className="animate-spin text-accent mb-4" size={48} />
        <h2 className="section-title">Authenticating...</h2>
        <p className="text-ink-muted text-sm mt-2">Please wait while we log you in safely.</p>
      </div>
    </PublicLayout>
  );
};

export default OAuthCallback;
