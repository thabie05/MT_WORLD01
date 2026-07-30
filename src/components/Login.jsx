import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers } from '../data/users';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const docRef = doc(db, 'users', 'credentials');
      const snap = await getDoc(docRef);
      let users;
      if (snap.exists() && snap.data().users && snap.data().users.length > 0) {
        users = snap.data().users;
      } else {
        users = loadUsers();
      }
      const user = users.find((u) => u.username === username && u.password === password);
      if (user) {
        onLogin({ 
          username: user.username, 
          fullName: user.fullName, 
          role: user.role,
          rememberMe: rememberMe 
        });
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      const users = loadUsers();
      const user = users.find((u) => u.username === username && u.password === password);
      if (user) {
        onLogin({ 
          username: user.username, 
          fullName: user.fullName, 
          role: user.role,
          rememberMe: rememberMe 
        });
      } else {
        setError('Invalid username or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-body text-main p-5 relative overflow-hidden font-['Inter',sans-serif]">
      <div className="absolute w-[350px] h-[350px] bg-[radial-gradient(circle,rgba(59,130,246,0.3),transparent_70%)] rounded-full -top-32 -right-32 animate-float animate-pulse-slow" />
      <div className="absolute w-[280px] h-[280px] bg-[radial-gradient(circle,rgba(139,92,246,0.3),transparent_70%)] rounded-full -bottom-28 -left-28 animate-float-reverse animate-pulse-slow" />
      <div className="absolute w-[150px] h-[150px] bg-[radial-gradient(circle,rgba(34,197,94,0.2),transparent_70%)] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float animate-pulse-slow" />

      <div className="bg-card backdrop-blur-xl border border-main rounded-3xl p-10 w-full max-w-[420px] shadow-theme text-center relative z-10 animate-card-entry hover:-translate-y-1 transition-all">
        <div className="absolute -inset-0.5 rounded-[26px] bg-gradient-to-r from-transparent via-accent/30 to-purple-500/30 via-transparent bg-[length:200%_200%] animate-border-glow opacity-0 hover:opacity-100 transition-opacity -z-10" />

        {/* 🟢 YOUR LOGO HERE */}
        <img 
          src="./logo.png" 
          alt="MT World Logo" 
          className="h-16 w-auto object-contain mx-auto mb-4 animate-title-slide" 
        />

        <p className="text-base text-muted tracking-[0.2em] uppercase mb-8 animate-title-slide">
          Attendance Register
        </p>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full py-3.5 px-4 mb-4 bg-input border border-main rounded-2xl text-base text-main placeholder-muted outline-none transition-all focus:border-accent focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] h-[52px] animate-input-slide"
          />

          {/* Password with show/hide toggle */}
          <div className="relative mb-4 animate-input-slide">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full py-3.5 px-4 pr-12 bg-input border border-main rounded-2xl text-base text-main placeholder-muted outline-none transition-all focus:border-accent focus:shadow-[0_0_20px_rgba(59,130,246,0.3)] h-[52px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors text-lg"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-start mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-main bg-input text-accent focus:ring-accent focus:ring-offset-0 cursor-pointer"
              />
              <span className="ml-2 text-sm text-muted">Remember this device</span>
            </label>
          </div>

          {error && (
            <p className="text-[var(--accent-red)] text-sm mb-3 bg-[var(--bg-red-soft)] px-4 py-2.5 rounded-xl border border-[var(--accent-red)]/30 animate-shake">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 btn-accent rounded-2xl text-base font-semibold tracking-wider relative overflow-hidden transition-all hover:opacity-90 active:scale-98 disabled:opacity-50 h-[52px] animate-button-slide group"
          >
            <span className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/15 to-transparent rotate-45 transition-all group-hover:left-full" />
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;