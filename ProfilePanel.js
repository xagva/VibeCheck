import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import './ProfilePanel.css';

export default function ProfilePanel({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [habits, setHabits] = useState([]);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUsername(data.username || 'Guest');
        setHabits(data.habits || []);
      }
    };
    fetchProfile();
  }, [user]);

  const saveUsername = async () => {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { username });
    setEditingName(false);
  };

  return (
    <div className={`profile-panel ${isOpen ? 'open' : ''}`}>
      <div className="profile-header" onClick={() => setIsOpen(!isOpen)}>
        <span>Profile</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="profile-content">
          <div className="username-section">
            {editingName ? (
              <div>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <button onClick={saveUsername}>Save</button>
              </div>
            ) : (
              <div>
                <span>{username}</span>
                <button onClick={() => setEditingName(true)}>✏️</button>
              </div>
            )}
          </div>
          <h4>Your Habits</h4>
          <ul>
            {habits.map((h, idx) => (
              <li key={idx}>
                <strong>{h.name}</strong> — Score: {h.score}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
