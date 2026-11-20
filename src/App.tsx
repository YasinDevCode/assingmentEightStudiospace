import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { WishlistProvider } from './context/WishlistContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { PrivateRoute } from './components/PrivateRoute';
import { BrandedPageLoader } from './components/Skeletons';
import { HomePage } from './pages/HomePage';

const ExploreStudiosPage = lazy(() =>
  import('./pages/ExploreStudiosPage').then((m) => ({ default: m.ExploreStudiosPage }))
);
const StudioDetailsPage = lazy(() =>
  import('./pages/StudioDetailsPage').then((m) => ({ default: m.StudioDetailsPage }))
);
const AddStudioPage = lazy(() =>
  import('./pages/AddStudioPage').then((m) => ({ default: m.AddStudioPage }))
);
const EditStudioPage = lazy(() =>
  import('./pages/EditStudioPage').then((m) => ({ default: m.EditStudioPage }))
);
const MyListingsPage = lazy(() =>
  import('./pages/MyListingsPage').then((m) => ({ default: m.MyListingsPage }))
);
const MyBookingsPage = lazy(() =>
  import('./pages/MyBookingsPage').then((m) => ({ default: m.MyBookingsPage }))
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const HowItWorksPage = lazy(() =>
  import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppShell() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100 transition-colors duration-200">
      <ScrollToTop />
      <Toaster position="top-right" richColors theme={theme} closeButton />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<BrandedPageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/studios" element={<ExploreStudiosPage />} />
            <Route path="/studios/:id" element={<StudioDetailsPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/add-studio"
              element={
                <PrivateRoute>
                  <AddStudioPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-listings"
              element={
                <PrivateRoute>
                  <MyListingsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/studios/edit/:id"
              element={
                <PrivateRoute>
                  <EditStudioPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <PrivateRoute>
                  <MyBookingsPage />
                </PrivateRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WishlistProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </WishlistProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
