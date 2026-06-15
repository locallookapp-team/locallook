import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Import our isolated page components
import MapPage from './pages/MapPage';
import StoreProfilePage from './pages/StoreProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/store/:id" element={<StoreProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;