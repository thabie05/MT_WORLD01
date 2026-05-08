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
    <div className="login-container">
      <div className="login-card">
        <h1>MT WORLD</h1>
        <h2>Attendance Register</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log In'}</button>
        </form>
      </div>
    </div>
  );
}

export default Login;