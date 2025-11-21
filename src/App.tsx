import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { setUser, setProfile, setLoading } from './store/userSlice';
import { authService } from './services/authService';
import { useAppSelector } from './store/hooks';
import './index.css';

// Components
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import GameLobby from './components/Lobby/GameLobby';
import PokerTable from './components/PokerTable/PokerTable';
import Profile from './components/Profile/PlayerProfile';
import StatsPage from './components/Stats/StatsPage';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.user);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/register" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      const { session } = await authService.getSession();
      if (session?.user) {
        store.dispatch(setUser(session.user));

        // Fetch user profile
        const { profile } = await authService.getProfile(session.user.id);
        if (profile) {
          store.dispatch(setProfile(profile));
        }
      }
      store.dispatch(setLoading(false));
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = authService.onAuthStateChange(async (user) => {
      store.dispatch(setUser(user));

      if (user) {
        const { profile } = await authService.getProfile(user.id);
        if (profile) {
          store.dispatch(setProfile(profile));
        }
      } else {
        store.dispatch(setProfile(null));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/lobby"
            element={
              <ProtectedRoute>
                <GameLobby />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:gameId"
            element={
              <ProtectedRoute>
                <PokerTable />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/register" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
