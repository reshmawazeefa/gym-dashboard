// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
 
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCHvsKUo-AhO3FQgW9Otm9WyPC-Dsztj1I",
  authDomain: "wazeefa-gym.firebaseapp.com",
  projectId: "wazeefa-gym",
  storageBucket: "wazeefa-gym.firebasestorage.app",
  messagingSenderId: "152647755436",
  appId: "1:152647755436:web:49f506a788ad432e56e109",
  measurementId: "G-99S8TTFJJ6"
};
 
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);