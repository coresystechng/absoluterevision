import { lazy, Suspense } from "react"
import { Route, Routes, useLocation } from "react-router-dom"
import { Toaster } from "sonner"

import { ThemeProvider } from "@/hooks/useTheme"
import { RoutePending } from "@/components/RoutePending"
import { RouteMetadata } from "@/components/RouteMetadata"
import { Landing } from "@/pages/Landing"
import { Pricing } from "@/pages/Pricing"
import { NotFound } from "@/pages/NotFound"
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary"

const AssignmentView = lazy(() => import("@/pages/AssignmentView").then((module) => ({ default: module.AssignmentView })))

const AssignmentTracking = lazy(() => import("@/pages/AssignmentTracking").then((module) => ({ default: module.AssignmentTracking })))

const Dashboard = lazy(() => import("@/pages/Dashboard").then((module) => ({ default: module.Dashboard })))

const ClientSubmissions = lazy(() => import("@/pages/ClientSubmissions").then((module) => ({ default: module.ClientSubmissions })))

const DocumentUpload = lazy(() => import("@/pages/DocumentUpload").then((module) => ({ default: module.DocumentUpload })))

const Login = lazy(() => import("@/pages/Login").then((module) => ({ default: module.Login })))

const Settings = lazy(() => import("@/pages/Settings").then((module) => ({ default: module.Settings })))

const Protected = lazy(() => import("@/components/ProtectedRoute").then((module) => ({ default: module.ProtectedRoute })))

export default function App() {
  const { pathname } = useLocation()
  return (
    <ThemeProvider>
      <RouteMetadata />
      <RouteErrorBoundary key={pathname}>
        <Suspense fallback={<RoutePending />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/document-upload" element={<DocumentUpload />} />
            <Route path="/track-assignment" element={<AssignmentTracking />} />
            <Route path="/login" element={<Login />} />
            <Route path="/sign-in" element={<Login />} />
            <Route path="/sign-up" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <Protected>
                  {(user, signOut) => <Dashboard user={user} onSignOut={signOut} />}
                </Protected>
              }
            />
            <Route
              path="/client-submissions"
              element={
                <Protected>
                  {(user, signOut) => <ClientSubmissions key={user.id} user={user} onSignOut={signOut} />}
                </Protected>
              }
            />
            <Route
              path="/assignments/:id"
              element={
                <Protected>
                  {(user, signOut) => <AssignmentView user={user} onSignOut={signOut} />}
                </Protected>
              }
            />
            <Route
              path="/settings"
              element={
                <Protected>
                  {(user, signOut) => <Settings user={user} onSignOut={signOut} />}
                </Protected>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
      <Toaster richColors closeButton />
    </ThemeProvider>
  )
}
