// Demo-only: signs in as an Admin on first visit so internal pages can be reviewed without credentials.
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/oauth-callback'];

export function seedDemoSession() {
  try {
    if (PUBLIC_PATHS.some(p => window.location.pathname.startsWith(p))) return;
    if (!localStorage.getItem('token')) {
      localStorage.setItem('token', 'demo-token');
      localStorage.setItem('role', 'Admin');
      localStorage.setItem('email', 'admin@swfx.demo');
    }
  } catch { /* storage unavailable: the login page still works */ }
}
