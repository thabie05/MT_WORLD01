import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { loadUsers } from '../data/users';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        onLogin({ username: user.username, fullName: user.fullName, role: user.role });
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      const users = loadUsers();
      const user = users.find((u) => u.username === username && u.password === password);
      if (user) {
        onLogin({ username: user.username, fullName: user.fullName, role: user.role });
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
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full py-3.5 px-4 mb-4 bg-white/8 border border-white/20 rounded-2xl text-base text-white placeholder:text-white/40 outline-none transition-all focus:bg-white/12 focus:border-white/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] h-[52px] animate-input-slide"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full py-3.5 px-4 mb-4 bg-white/8 border border-white/20 rounded-2xl text-base text-white placeholder:text-white/40 outline-none transition-all focus:bg-white/12 focus:border-white/50 focus:shadow-[0_0_20px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] h-[52px] animate-input-slide"
          />

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