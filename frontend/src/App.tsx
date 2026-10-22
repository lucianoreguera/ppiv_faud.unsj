import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { ToastProvider } from './context/ToastContext';
import { AppRouter } from './routes/AppRouter';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationsProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRouter />
          </BrowserRouter>
        </NotificationsProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
