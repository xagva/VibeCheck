import React, { useState, useEffect } from 'react';
import { auth } from './firebase-config';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import ProfilePanel from './ProfilePanel';
import MainDashboard from './MainDashboard'; // your current main screen with tree, charts, etc.
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleGuestLogin = () => {
    signInAnonymously(auth).catch(console.error);
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <div className="landing-container">
        <h1>VibeCheck 🌱</h1>
        <p>Track habits, grow your tree.</p>
        <button
          className="landing-btn"
          onClick={() => window.location.href = '/login'}
        >
          Sign up / Log in with Email
        </button>
        <button
          className="landing-btn guest"
          onClick={handleGuestLogin}
        >
          Continue as Guest
        </button>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <ProfilePanel user={user} />
      <MainDashboard user={user} />
    </div>
  );
}
