import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthData } = useAuth(); // Assume we might need to expose this, or we handle it via a manual login state update
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
      <h2 className="text-xl font-semibold text-gray-800">Authenticating...</h2>
      <p className="text-gray-500 text-sm mt-2">Please wait while we log you in safely.</p>
    </div>
  );
};

export default OAuthCallback;
