import React, { useState, useRef } from 'react';
import PublicLayout from '../../components/PublicLayout';
import { LogoMark } from '../../assets/Logo';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Turnstile } from '@marsidev/react-turnstile';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address')
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword: React.FC = () => {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const { theme } = useTheme();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const emailValue = watch('email');

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    if (!turnstileToken) {
      setStatus({ type: 'error', text: 'Please complete the security check.' });
      return;
    }

    setStatus(null);

    try {
      await axiosInstance.post('/Auth/forgot-password', { email: data.email, turnstileToken });
      setStatus({ 
        type: 'success', 
        text: 'If an account with that email exists, a password reset link has been sent to your inbox.' 
      });
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
    }
  };

  return (
    <PublicLayout illustration="forgot-password" headline="Locked out? It happens." text="Enter your email and we will send you a link to choose a new password.">
      <div className="w-full max-w-[400px] space-y-6 card card-pad">
        <div>
          <button 
            type="button"
            onClick={() => navigate('/login')}
            className="flex items-center text-sm font-medium text-ink-muted hover:text-ink transition-colors mb-6"
          >
            <ArrowLeft size={16} className="mr-1" /> Back to login
          </button>
          <LogoMark className="h-10 w-10 mx-auto mb-3 text-ink" />
          <h2 className="text-center text-2xl font-semibold text-ink">
            Forgot Password
          </h2>
          <p className="mt-2 text-center text-sm text-ink-muted">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {status && (
            <div className={`alert flex items-start gap-3 ${
              status.type === 'success' ? 'alert-success' : 'alert-error'
            }`}>
              {status.type === 'success' ? (
                <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="shrink-0 mt-0.5" size={20} />
              )}
              <p className="text-sm">{status.text}</p>
            </div>
          )}

          <div>
            <div className="relative">
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-ink-subtle" />
              </div>
              <input
                id="email-address"
                type="email"
                className={`input px-10 ${errors.email ? 'input-error' : ''}`}
                placeholder="Enter your email address"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="field-error">{errors.email.message}</p>}
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
              options={{ theme, size: 'normal' }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || !emailValue?.trim() || !turnstileToken}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : null}
              {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
      </div>
    </PublicLayout>
  );
};

export default ForgotPassword;
