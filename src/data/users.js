const STORAGE_KEY = 'mtworld_users';

export const loadUsers = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { }
  }
  return [
    { username: 'Thabelo', password: 'admin123', fullName: 'Thabelo Tshishonga', role: 'admin' },
    { username: 'Shonisani', password: 'shoni123', fullName: 'Shonisani Mukwevho', role: 'admin' },
    { username: 'Percy', password: 'percy123', fullName: 'Percy Tshilimandila', role: 'user' },
    { username: 'Vhutshilo', password: 'soler123', fullName: 'Vhutshilo thagwana', role: 'user' },
    { username: 'lucky', password: 'lucky123', fullName: 'Lucky Tshilimandila', role: 'user' },
  ];
};

export const seedUsersIfNeeded = async (db, doc, getDoc, setDoc) => {
  try {
    const docRef = doc(db, 'users', 'credentials');
    const snap = await getDoc(docRef);
    if (!snap.exists() || !snap.data().users || snap.data().users.length === 0) {
      const users = loadUsers();
      await setDoc(docRef, { users });
      console.log('Users seeded to Firestore!');
    }
  } catch (err) {
    console.error('Seeding failed:', err.message);
  }
};