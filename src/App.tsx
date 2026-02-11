import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import AdminDashboard from "./pages/AdminDashboard";
import CatalogAudit from "./pages/CatalogAudit";
import SellerFlow from "./pages/SellerFlow";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Management from "./pages/Management";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import StoreManagement from "./pages/StoreManagement";
import CatalogDocumentation from "./pages/CatalogDocumentation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'seller']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/management" element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'seller']}>
                <Management />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/stores" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <StoreManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/audit" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CatalogAudit />
              </ProtectedRoute>
            } />
            {/* Redirect old route to unified /audit */}
            <Route path="/catalog-audit" element={<Navigate to="/audit" replace />} />
            <Route path="/seller" element={
              <ProtectedRoute allowedRoles={['admin', 'manager', 'seller']}>
                <SellerFlow />
              </ProtectedRoute>
            } />
            <Route path="/docs" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <CatalogDocumentation />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
