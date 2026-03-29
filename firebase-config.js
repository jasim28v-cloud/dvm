// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyAxtEkrEgl0C9djPkxKKX-sENtOzPEbHB8",
    authDomain: "tope-e5350.firebaseapp.com",
    databaseURL: "https://tope-e5350-default-rtdb.firebaseio.com",
    projectId: "tope-e5350",
    storageBucket: "tope-e5350.firebasestorage.app",
    messagingSenderId: "187788115549",
    appId: "1:187788115549:web:5012a1053d2ff7dced97b4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

const CLOUD_NAME = 'dnmpmysk6';
const UPLOAD_PRESET = 'rsxdfdgw';

console.log('✅ SHΔDØW System Ready');
