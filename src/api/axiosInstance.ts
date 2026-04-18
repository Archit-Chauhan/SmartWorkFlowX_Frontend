import axios from 'axios';

// Create the base instance
const axiosInstance = axios.create({
  // Ensure this matches your .NET project's https port (e.g., 7001 or 5001)
  baseURL: 'https://localhost:52082/api', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token to every outgoing request
axiosInstance.interceptors.request.use(
  (config) => {
    // We'll store our token in localStorage for simplicity
    const token = localStorage.getItem('token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle global errors (like 401 Unauthorized)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the backend returns 401, the token is likely expired or invalid
    if (error.response && error.response.status === 401) {
      console.error('Unauthorized! Redirecting to login...');
      localStorage.removeItem('token');
      // You could trigger a redirect to /login here if needed
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;