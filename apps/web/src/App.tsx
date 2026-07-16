import { Routes, Route } from 'react-router-dom';
import { Permission, Role } from '@studyshare/shared';
import { Layout } from './components/layout/Layout.js';
import { RequireAuth, RequirePermission } from './components/RouteGuards.js';

import { BrowsePage } from './features/resources/BrowsePage.js';
import { ResourceDetailPage } from './features/resources/ResourceDetailPage.js';
import { UploadPage } from './features/resources/UploadPage.js';
import { RequestBoardPage } from './features/requests/RequestBoardPage.js';
import { ProfilePage } from './features/profile/ProfilePage.js';
import { ModerationPage } from './features/moderation/ModerationPage.js';
import { AdminPage } from './features/admin/AdminPage.js';

import { LoginPage } from './features/auth/LoginPage.js';
import { SignupPage } from './features/auth/SignupPage.js';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage.js';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.js';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.js';
import { OAuthCallbackPage } from './features/auth/OAuthCallbackPage.js';
import { NotFoundPage } from './features/NotFoundPage.js';

export function App() {
  return (
    <Routes>
      {/* Auth pages render outside the main app chrome. */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<BrowsePage />} />
        <Route path="/resources/:id" element={<ResourceDetailPage />} />
        <Route path="/requests" element={<RequestBoardPage />} />
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <UploadPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/moderation"
          element={
            <RequirePermission permission={Permission.RESOURCE_MODERATE}>
              <ModerationPage />
            </RequirePermission>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequirePermission role={Role.ADMIN}>
              <AdminPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
