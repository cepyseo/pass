import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";

// Firebase yapılandırması
const firebaseConfig = {
    apiKey: "AIzaSyDNmHhmEDO6NHaW5xeVEl_K1bEHZ8wLKPg",
    authDomain: "clonicbusiness.firebaseapp.com",
    databaseURL: "https://clonicbusiness-default-rtdb.firebaseio.com",
    projectId: "clonicbusiness",
    storageBucket: "clonicbusiness.firebasestorage.app",
    messagingSenderId: "83234032898",
    appId: "1:83234032898:web:d145adfa9ebd6cd1fc861b",
    measurementId: "G-TJ15WL5ZR7"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const messagesRef = ref(database, 'messages');

// DOM elementlerini seç
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesDiv = document.getElementById('messages');

// Mesaj gönderme
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (message) {
        try {
            // Mesajı Firebase'e kaydet
            await push(messagesRef, {
                text: message,
                timestamp: Date.now()
            });
            
            messageInput.value = '';
        } catch (error) {
            console.error("Mesaj gönderilirken hata oluştu:", error);
            alert("Mesaj gönderilemedi. Lütfen tekrar deneyin.");
        }
    }
});

// Mesajları dinle ve göster
onValue(messagesRef, (snapshot) => {
    try {
        messagesDiv.innerHTML = '';
        const messages = [];
        
        snapshot.forEach((childSnapshot) => {
            messages.push({
                ...childSnapshot.val(),
                id: childSnapshot.key
            });
        });
        
        // Mesajları tarihe göre sırala
        messages.sort((a, b) => a.timestamp - b.timestamp);
        
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = 'message';
            messageElement.textContent = message.text;
            messagesDiv.appendChild(messageElement);
        });
        
        // Otomatik olarak en son mesaja kaydır
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } catch (error) {
        console.error("Mesajlar yüklenirken hata oluştu:", error);
    }
}); 