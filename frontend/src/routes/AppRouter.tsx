import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { UserLayout } from '../components/layout/UserLayout';
import { LandingPage } from '../pages/public/LandingPage';
import { CatalogPage } from '../pages/public/CatalogPage';
import { DocumentDetailPage } from '../pages/public/DocumentDetailPage';
import { DesignSystemPage } from '../pages/public/DesignSystemPage';
import { PhasePlaceholderPage } from '../pages/public/PhasePlaceholderPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { MyLoansPage } from '../pages/user/MyLoansPage';
import { ViewerPage } from '../pages/user/ViewerPage';
import { AdminDocumentUploadPage } from '../pages/admin/AdminDocumentUploadPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminLoansPage } from '../pages/admin/AdminLoansPage';

export const AppRouter: React.FC = () => (
  <Routes>
    {/* Introducción al Repositorio FAUD (Figma pág. 4) */}
    <Route path="/" element={<LandingPage />} />

    {/* Flujo de acceso (Figma págs. 5 y 6) */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/registro" element={<RegisterPage />} />

    {/* Experiencia del alumno (Figma págs. 11, 12 y 13) */}
    <Route element={<UserLayout />}>
      <Route path="/catalogo" element={<CatalogPage />} />
      <Route path="/documentos/:id" element={<DocumentDetailPage />} />
      <Route path="/mis-prestamos" element={<MyLoansPage />} />
      <Route
        path="/notificaciones"
        element={
          <PhasePlaceholderPage
            padded
            title="Notificaciones"
            phaseLabel="Fase 3 · RF06"
            description="Bandeja de avisos: cuenta aprobada, préstamo otorgado, recordatorio 24 horas antes del vencimiento y préstamo vencido o revocado. No forma parte de los prototipos Figma."
            endpoints={[
              'GET /api/v1/notificaciones',
              'PATCH /api/v1/notificaciones/:id/leida',
              'PATCH /api/v1/notificaciones/marcar-todas-leidas',
            ]}
          />
        }
      />
    </Route>

    {/* Visor de lectura protegido (Figma pág. 14) */}
    <Route path="/visor/:prestamoId" element={<ViewerPage />} />

    {/* Panel de administración (Figma págs. 7, 8 y 9) */}
    <Route path="/admin" element={<AdminLayout />}>
      <Route
        index
        element={
          <PhasePlaceholderPage
            title="Panel"
            phaseLabel="Fase 5"
            description="Resumen operativo de Biblioteca: cuentas pendientes de validación, documentos catalogados y préstamos por vencer en 24h. No forma parte de los prototipos Figma."
            endpoints={['GET /api/v1/usuarios', 'GET /api/v1/prestamos', 'GET /api/v1/departamentos/metricas']}
          />
        }
      />
      <Route path="catalogo" element={<AdminDocumentUploadPage />} />
      <Route path="usuarios" element={<AdminUsersPage />} />
      <Route path="prestamos" element={<AdminLoansPage />} />
    </Route>

    {/* Verificación interna: Design System + GET /api/v1/health */}
    <Route path="/design-system" element={<DesignSystemPage />} />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
