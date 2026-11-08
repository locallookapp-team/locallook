import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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

const AppRoutes = () => {
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/update-password'; 
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // Isolate pages that don't need the sidebar
  const isFullScreenRoute = ['/', '/login', '/signup', '/forgot-password', '/update-password', '/terms', '/privacy'].includes(path);
  
  // 🚀 Track ONLY the public heavy pages for the permanent cache
  const isMapActive = path === '/map';
  const isExploreActive = path === '/explore';
  const isReviewsActive = path === '/reviews';

  const isCachedPageActive = isMapActive || isExploreActive || isReviewsActive;

  if (isFullScreenRoute) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} /> 
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/update-password" element={<UpdatePasswordPage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      
      {/* ========================================================= */}
      {/* 🌍 THE PUBLIC CACHE BLOCK: Heavy maps & feeds mount once  */}
      {/* ========================================================= */}
      <div style={{ display: isMapActive ? 'block' : 'none', height: '100%', width: '100%' }}>
        <MapPage />
      </div>
      
      <div style={{ display: isExploreActive ? 'block' : 'none', height: '100%', width: '100%' }}>
        <ExplorePage />
      </div>
      
      <div style={{ display: isReviewsActive ? 'block' : 'none', height: '100%', width: '100%' }}>
        <ReviewsFeedPage />
      </div>

      {/* ========================================================= */}
      {/* 🔒 DYNAMIC ROUTES: Protected & Sub-pages load on demand   */}
      {/* ========================================================= */}
      {!isCachedPageActive && (
        <Routes>
          <Route path="/store/:id" element={<StoreProfilePage />} />
          <Route path="/user/:id" element={<PublicUserProfilePage />} />
          
          {/* 🚀 Moved Profile and Dashboard here so their Auth Guards don't fire prematurely */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['merchant', 'operator']}>
              <DashboardPage />
            </ProtectedRoute>
          } />
          
          <Route path="/identity-verification" element={<ProtectedRoute><IdentityVerificationPage /></ProtectedRoute>} />
          <Route path="/create-business" element={<ProtectedRoute><CreateBusinessPage /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute allowedRoles={['merchant']}><BillingPage /></ProtectedRoute>} />
        </Routes>
      )}

    </AppLayout>
  );
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;