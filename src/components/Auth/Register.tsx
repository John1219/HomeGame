import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAppDispatch } from '../../store/hooks';
import { setUser, setProfile } from '../../store/userSlice';

export default function Register() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        setLoading(true);

        try {
            const { user, error: signUpError } = await authService.signUp({
                email,
                password,
                username,
            });

            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
                return;
            }

            if (user) {
                dispatch(setUser(user));

                // Fetch profile
                const { profile } = await authService.getProfile(user.id);
                if (profile) {
                    dispatch(setProfile(profile));
                }

                // Navigate to lobby
                navigate('/lobby');
            }
        } catch (err) {
            setError('An unexpected error occurred');
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: '400px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎰 HomeGame</h1>
                    <p className="text-muted">Create your account</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="PokerPro"
                            required
                            disabled={loading}
                            minLength={3}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            disabled={loading}
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input
                            type="password"
                            className="input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="text-danger" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255, 71, 87, 0.1)', borderRadius: '0.5rem' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                        <p className="text-muted">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary" style={{ textDecoration: 'none' }}>
                                Sign In
                            </Link>
                        </p>
                    </div>
                </form>

                <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                    <p className="text-muted" style={{ margin: 0 }}>
                        💡 <strong>Note:</strong> You'll start with 10,000 chips. This is play money only!
                    </p>
                </div>
            </div>
        </div>
    );
}
