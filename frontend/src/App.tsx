import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AppRouter } from './routes/AppRouter';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRouter />
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
