import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient'; 

import MapPage from './pages/MapPage';
import StoreProfilePage from './pages/StoreProfilePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage'; 
import DashboardPage from './pages/DashboardPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import BrowsePage from './pages/BrowsePage'; 
import ProfilePage from './pages/ProfilePage'; 
import CreateBusinessPage from './pages/CreateBusinessPage'; 
import IdentityVerificationPage from './pages/IdentityVerificationPage'; // 🚀 Added this import!
import TestPages from './pages/TestPages'; 

import AppLayout from './components/AppLayout'; 
import ProtectedRoute from './components/ProtectedRoute'; 

function App() {
  
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/update-password'; 
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<AppLayout><MapPage /></AppLayout>} />
        <Route path="/browse" element={<AppLayout><BrowsePage /></AppLayout>} />
        <Route path="/store/:id" element={<AppLayout><StoreProfilePage /></AppLayout>} />

        {/* 🚀 CONSUMER PROTECTED ROUTES (Requires Login, any role) */}
        <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
        
        {/* 🚀 IDENTITY VERIFICATION ROUTE */}
        <Route path="/identity-verification" element={<ProtectedRoute><AppLayout><IdentityVerificationPage /></AppLayout></ProtectedRoute>} />
        
        {/* The new upgrade path! */}
        <Route path="/create-business" element={<ProtectedRoute><AppLayout><CreateBusinessPage /></AppLayout></ProtectedRoute>} />

        {/* 🚀 MERCHANT PROTECTED ROUTE (Requires Login AND specific roles) */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['merchant', 'operator']}><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />

        {/* FULL SCREEN AUTH ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} /> 
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        
        {/* SVG TEST ROUTE */}
        <Route path="/test" element={<TestPages />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;