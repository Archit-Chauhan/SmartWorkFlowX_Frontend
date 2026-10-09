import React, { useState, useEffect } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { Lock, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters long.'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema)
  });

  const passwordValue = watch('password');
  const confirmPasswordValue = watch('confirmPassword');

  useEffect(() => {
    if (!email || !token) {
      setStatus({ 
        type: 'error', 
        text: 'Invalid or missing password reset token. Please request a new link.' 
      });
    }
  }, [email, token]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setStatus(null);

    try {
      await axiosInstance.post('/Auth/reset-password', { 
        email, 
        token, 
        newPassword: data.password 
      });
      
      setStatus({ 
        type: 'success', 
        text: 'Your password has been reset successfully. You can now login with your new password.' 
      });
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setStatus({ 
        type: 'error', 
        text: err.response?.data || 'Failed to reset password. The token may be expired.' 
      });
    }
  };

  if (!email || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-surface-1 py-12 px-4">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <div className="w-full max-w-[400px] space-y-6 card card-pad text-center">
          <AlertCircle className="mx-auto text-error mb-4" size={48} />
          <h2 className="text-xl font-semibold text-ink">Invalid Link</h2>
          <p className="text-ink-muted mb-6">{status?.text}</p>
          <button 
            onClick={() => navigate('/forgot-password')}
            className="btn btn-primary w-full"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-surface-1 py-12 px-4">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-[400px] space-y-6 card card-pad">
        <div>
          <h2 className="text-center text-2xl font-semibold text-ink">
            Set New Password
          </h2>
          <p className="mt-2 text-center text-sm text-ink-muted">
            Please enter your new password below for <b>{email}</b>.
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

          {status?.type !== 'success' && (
              <div className="space-y-4">
                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-ink-subtle" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`input pl-10 pr-10 ${errors.password ? 'input-error' : ''}`}
                      placeholder="New Password"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-subtle hover:text-ink transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="field-error">{errors.password.message}</p>}
                </div>

                <div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-ink-subtle" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`input pl-10 pr-10 ${errors.confirmPassword ? 'input-error' : ''}`}
                      placeholder="Confirm New Password"
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-subtle hover:text-ink transition-colors"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="field-error">{errors.confirmPassword.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !passwordValue || !confirmPasswordValue}
                  className="btn btn-primary w-full"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : null}
                  {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
