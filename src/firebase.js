import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';

// REEMPLAZA CON TUS CREDENCIALES DE FIREBASE
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto-id",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const saveGuest = async (guestData) => {
  try {
    const docRef = await addDoc(collection(db, 'guests'), guestData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error guardando invitado:', error);
    return { success: false, error };
  }
};

export const saveStudent = async (studentData) => {
  try {
    const docRef = await addDoc(collection(db, 'students'), studentData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error guardando estudiante:', error);
    return { success: false, error };
  }
};

export const registerGuestAttendance = async (guestData) => {
  try {
    const docRef = await addDoc(collection(db, 'registered_guests'), guestData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error registrando asistencia:', error);
    return { success: false, error };
  }
};

export const getRegisteredGuests = async () => {
  try {
    const q = query(collection(db, 'registered_guests'), orderBy('registeredAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error obteniendo registros:', error);
    return [];
  }
};

export { db };