// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyAxtEkrEgl0C9djPkxKKX-sENtOzPEbHB8",
  authDomain: "tope-e5350.firebaseapp.com",
  projectId: "tope-e5350",
  storageBucket: "tope-e5350.firebasestorage.app",
  messagingSenderId: "187788115549",
  appId: "1:187788115549:web:5012a1053d2ff7dced97b4",
  measurementId: "G-V1XM95PMQC"
};

// بما أن الكود الأصلي يستخدم Realtime Database، يجب إضافة databaseURL
// لأن الإعدادات الجديدة لا تحتوي عليه، لكن المستخدم قد قام بتوفير رابط الـ RTDB:
// https://tope-e5350-default-rtdb.firebaseio.com/
// لذا سأضيفه يدوياً
firebaseConfig.databaseURL = "https://tope-e5350-default-rtdb.firebaseio.com";

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// إعدادات Cloudinary الجديدة
const CLOUD_NAME = 'dnmpmysk6';
const UPLOAD_PRESET = 'rsxdfdgw';

console.log('✅ SHΔDØW System Ready (Updated Firebase + Cloudinary)');
