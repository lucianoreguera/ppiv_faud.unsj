import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { UserLayout } from '../components/layout/UserLayout';
import { LandingPage } from '../pages/public/LandingPage';
import { CatalogPage } from '../pages/public/CatalogPage';
import { DocumentDetailPage } from '../pages/public/DocumentDetailPage';
import { DesignSystemPage } from '../pages/public/DesignSystemPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { MyLoansPage } from '../pages/user/MyLoansPage';
import { NotificationsPage } from '../pages/user/NotificationsPage';
import { ViewerPage } from '../pages/user/ViewerPage';
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminCatalogPage } from '../pages/admin/AdminCatalogPage';
import { AdminDocumentFormPage } from '../pages/admin/AdminDocumentFormPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';
import { AdminLoansPage } from '../pages/admin/AdminLoansPage';
import { GuestRoute, ProtectedRoute, RoleGuard } from './RouteGuards';

export const AppRouter: React.FC = () => (
  <Routes>
    {/* Introducción al Repositorio FAUD (Figma pág. 4) */}
    <Route path="/" element={<LandingPage />} />

    {/* Flujo de acceso (Figma págs. 5 y 6) — solo visitantes sin sesión */}
    <Route element={<GuestRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
    </Route>

    {/* Experiencia del alumno (Figma págs. 11, 12 y 13) — Catálogo y Ficha son públicos; préstamos y avisos requieren sesión */}
    <Route element={<UserLayout />}>
      <Route path="/catalogo" element={<CatalogPage />} />
      <Route path="/documentos/:id" element={<DocumentDetailPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/mis-prestamos" element={<MyLoansPage />} />
        <Route path="/notificaciones" element={<NotificationsPage />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute />}>
      {/* Visor de lectura protegido (Figma pág. 14) */}
      <Route path="/visor/:prestamoId" element={<ViewerPage />} />

      {/* Panel de administración (Figma págs. 7, 8 y 9) — exclusivo ADMINISTRADOR */}
      <Route element={<RoleGuard roles={['ADMINISTRADOR']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="catalogo" element={<AdminCatalogPage />} />
          <Route path="catalogo/nuevo" element={<AdminDocumentFormPage />} />
          <Route path="catalogo/:id/editar" element={<AdminDocumentFormPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="prestamos" element={<AdminLoansPage />} />
        </Route>
      </Route>
    </Route>

    {/* Verificación interna: Design System + GET /api/v1/health */}
    <Route path="/design-system" element={<DesignSystemPage />} />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
