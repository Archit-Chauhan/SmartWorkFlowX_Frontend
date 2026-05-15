import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (!turnstileToken) {
      setStatus({ type: 'error', text: 'Please complete the security check.' });
      return;
    }

    setStatus(null);
    setIsSubmitting(true);

    try {
      await axiosInstance.post('/Auth/forgot-password', { email, turnstileToken });
      setStatus({ 
        type: 'success', 
        text: 'If an account with that email exists, a password reset link has been sent to your inbox.' 
      });
      setEmail('');
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } catch (err: any) {
      setStatus({ 
        type: 'error', 
        text: err.response?.data || 'An error occurred. Please try again later.' 
      });
      // Reset captcha on error so user can retry
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <button 
            onClick={() => navigate('/login')}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors mb-6"
          >
            <ArrowLeft size={16} className="mr-1" /> Back to login
          </button>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Forgot Password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {status && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {status.type === 'success' ? (
                <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
              )}
              <p className="text-sm">{status.text}</p>
            </div>
          )}

          <div className="relative">
            <label htmlFor="email-address" className="sr-only">Email address</label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email-address"
              name="email"
              type="email"
              required
              className="appearance-none rounded-lg relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Cloudflare Turnstile Widget */}
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={SITE_KEY}
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
              onError={() => {
                setTurnstileToken(null);
                setStatus({ type: 'error', text: 'Security check failed. Please refresh and try again.' });
              }}
              options={{ theme: 'light', size: 'normal' }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || !email.trim() || !turnstileToken}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
              ) : null}
              {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
