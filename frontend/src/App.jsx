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

// 🚀 Wrap the routing in a sub-component so we can access useLocation()
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

  // Isolate pages that don't need the sidebar (Logins, Landing, Policies)
  const isFullScreenRoute = ['/', '/login', '/signup', '/forgot-password', '/update-password', '/terms', '/privacy'].includes(path);
  
  // Track which cached page is currently active
  const isMapActive = path === '/map';
  const isExploreActive = path === '/explore';
  const isReviewsActive = path === '/reviews';
  const isProfileActive = path === '/profile';
  const isDashboardActive = path === '/dashboard';

  const isCachedPageActive = isMapActive || isExploreActive || isReviewsActive|| isProfileActive || isDashboardActive;

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
    // 🚀 AppLayout wraps EVERYTHING. It never unmounts, fixing the auth flicker!
    <AppLayout>
      
      {/* ========================================================= */}
      {/* THE CACHE BLOCK: These 4 pages mount once and never die   */}
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


      <div style={{ display: isProfileActive ? 'block' : 'none', height: '100%', width: '100%' }}>
        <ProfilePage />
      </div>

      <div style={{ display: isDashboardActive ? 'block' : 'none', height: '100%', width: '100%' }}>
        <ProtectedRoute allowedRoles={['merchant', 'operator']}>
          <DashboardPage />
        </ProtectedRoute>
      </div>

      {/* ========================================================= */}
      {/* DYNAMIC ROUTES: Sub-pages load normally only when visited */}
      {/* ========================================================= */}
      {!isCachedPageActive && (
        <Routes>
          <Route path="/store/:id" element={<StoreProfilePage />} />
          <Route path="/user/:id" element={<PublicUserProfilePage />} />
          
          {/* Notice <Route path="/profile" ... /> has been removed from here! */}
          
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