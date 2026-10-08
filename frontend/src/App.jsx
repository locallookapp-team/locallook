import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient'; 
import { ThemeProvider } from './components/ThemeContext';
import './App.css';

import LandingPage from './components/LandingPage'; 
import MapPage from './pages/MapPage';
import StoreProfilePage from './pages/StoreProfilePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage'; 
import DashboardPage from './pages/DashboardPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import ExplorePage from './pages/ExplorePage'; 
import ProfilePage from './pages/ProfilePage'; 
import CreateBusinessPage from './pages/CreateBusinessPage'; 
import IdentityVerificationPage from './pages/IdentityVerificationPage';
import ReviewsFeedPage from './pages/ReviewsFeedPage';
import PublicUserProfilePage from './pages/PublicUserProfilePage';
import AppLayout from './components/AppLayout'; 
import ProtectedRoute from './components/ProtectedRoute'; 
import BillingPage from './pages/BillingPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

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
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        {/* 🚀 NEW PUBLIC FRONT DOOR */}
        <Route path="/" element={<LandingPage />} />

        {/* PUBLIC ROUTES */}
        <Route path="/map" element={<AppLayout><MapPage /></AppLayout>} />
        <Route path="/explore" element={<AppLayout><ExplorePage /></AppLayout>} />
        <Route path="/store/:id" element={<AppLayout><StoreProfilePage /></AppLayout>} />
        <Route path="/reviews" element={<AppLayout><ReviewsFeedPage /></AppLayout>} />
        <Route path="/user/:id" element={<AppLayout><PublicUserProfilePage /></AppLayout>} />
        
        {/* 🚀 CONSUMER PROTECTED ROUTES (Requires Login, any role) */}
        <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
        
        {/* 🚀 IDENTITY VERIFICATION ROUTE */}
        <Route path="/identity-verification" element={<ProtectedRoute><AppLayout><IdentityVerificationPage /></AppLayout></ProtectedRoute>} />
        
        {/* The new upgrade path! */}
        <Route path="/create-business" element={<ProtectedRoute><AppLayout><CreateBusinessPage /></AppLayout></ProtectedRoute>} />

        {/* 🚀 MERCHANT PROTECTED ROUTE (Requires Login AND specific roles) */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['merchant', 'operator']}><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
        <Route path="/billing" element={<ProtectedRoute allowedRoles={['merchant']}><AppLayout><BillingPage /></AppLayout></ProtectedRoute>} />

        {/* FULL SCREEN AUTH & LEGAL ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} /> 
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        
        {/* 🚀 YOUR NEW LEGAL ROUTES */}
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;