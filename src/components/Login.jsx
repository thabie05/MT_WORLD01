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
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 bg-[length:400%_400%] animate-gradient-shift p-5 relative overflow-hidden">
      <div className="absolute w-[350px] h-[350px] bg-[radial-gradient(circle,rgba(59,130,246,0.3),transparent_70%)] rounded-full -top-32 -right-32 animate-float animate-pulse-slow" />
      <div className="absolute w-[280px] h-[280px] bg-[radial-gradient(circle,rgba(139,92,246,0.3),transparent_70%)] rounded-full -bottom-28 -left-28 animate-float-reverse animate-pulse-slow" />
      <div className="absolute w-[150px] h-[150px] bg-[radial-gradient(circle,rgba(34,197,94,0.2),transparent_70%)] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float animate-pulse-slow" />

      <div className="bg-white/5 backdrop-blur-xl border border-white/15 rounded-3xl p-10 w-full max-w-[420px] shadow-[0_25px_50px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] text-center relative z-10 animate-card-entry hover:-translate-y-1 hover:shadow-[0_35px_60px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15),0_0_40px_rgba(59,130,246,0.15)] transition-all">
        <div className="absolute -inset-0.5 rounded-[26px] bg-gradient-to-r from-transparent via-blue-500/30 to-purple-500/30 via-transparent bg-[length:200%_200%] animate-border-glow opacity-0 hover:opacity-100 transition-opacity -z-10" />

        <h1 className="text-[2.5rem] font-extrabold text-white tracking-wider mb-1 [text-shadow:0_2px_10px_rgba(0,0,0,0.3)] animate-title-slide">MT WORLD</h1>
        <p className="text-base text-white/70 tracking-[0.2em] uppercase mb-8 animate-title-slide">Attendance Register</p>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full py-3.5 px-4 mb-4 bg-white/8 border border-white/20 rounded-2xl text-base text-white placeholder:text-white/40 outline-none transition-all focus:bg-white/12 focus:border-white/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] h-[52px] animate-input-slide"
          />

          {/* Password with show/hide toggle */}
          <div className="relative mb-4 animate-input-slide">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full py-3.5 px-4 pr-12 bg-white/8 border border-white/20 rounded-2xl text-base text-white placeholder:text-white/40 outline-none transition-all focus:bg-white/12 focus:border-white/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] h-[52px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors text-lg"
              tabIndex={-1}
            >
              {showPassword ? (
                // Eye off icon (hide)
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                // Eye icon (show)
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
                className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
              />
              <span className="ml-2 text-sm text-white/70">Remember this device</span>
            </label>
          </div>

          {error && (
            <p className="text-red-300 text-sm mb-3 bg-red-500/15 px-4 py-2.5 rounded-xl border border-red-400/30 animate-shake">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500/80 to-purple-500/80 border border-white/20 rounded-2xl text-base font-semibold text-white tracking-wider relative overflow-hidden transition-all hover:from-blue-500 hover:to-purple-500 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(59,130,246,0.4),0_0_50px_rgba(139,92,246,0.2)] active:translate-y-0 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed h-[52px] animate-button-slide group"
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