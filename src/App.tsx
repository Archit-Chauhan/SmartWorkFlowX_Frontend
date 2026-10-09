import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AppRoutes from './routes/AppRoutes';
import { useTheme } from './hooks/useTheme';

const App: React.FC = () => {
  const { theme } = useTheme();
  return (
    <BrowserRouter>
      <AppRoutes />
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme={theme}
      />
    </BrowserRouter>
  );
};

export default App;