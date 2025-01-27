import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getDatabase, ref, push, onValue, set, get } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

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
const auth = getAuth(app);
const database = getDatabase(app);

// DOM elementleri
const authContainer = document.getElementById('authContainer');
const mainContainer = document.getElementById('mainContainer');
const loginForm = document.getElementById('login');
const registerForm = document.getElementById('register');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesDiv = document.getElementById('messages');
const userInfo = document.getElementById('userInfo');
const userList = document.getElementById('userList');
const groupList = document.getElementById('groupList');
const createGroupBtn = document.getElementById('createGroupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const chatHeader = document.getElementById('chatHeader');

let currentUser = null;
let currentChat = null;
let currentChatType = null; // 'private' veya 'group'

// Auth durum değişikliklerini dinle
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.emailVerified) {
            currentUser = user;
            showMainApp();
            loadUserData();
            loadUsers();
            loadGroups();
        } else {
            alert('Lütfen e-posta adresinizi doğrulayın!');
            auth.signOut();
        }
    } else {
        showAuthContainer();
    }
});

// Kayıt ol
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const name = document.getElementById('registerName').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Kullanıcı bilgilerini veritabanına kaydet
        await set(ref(database, `users/${user.uid}`), {
            name: name,
            email: email,
            createdAt: Date.now()
        });

        // E-posta doğrulama gönder
        await sendEmailVerification(user);
        alert('Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.');
    } catch (error) {
        alert(`Kayıt hatası: ${error.message}`);
    }
});

// Giriş yap
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert(`Giriş hatası: ${error.message}`);
    }
});

// Çıkış yap
logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Mesaj gönderme
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (message && currentChat) {
        try {
            const chatRef = ref(database, `${currentChatType}s/${currentChat}/messages`);
            await push(chatRef, {
                text: message,
                senderId: currentUser.uid,
                senderName: (await get(ref(database, `users/${currentUser.uid}/name`))).val(),
                timestamp: Date.now()
            });
            
            messageInput.value = '';
        } catch (error) {
            console.error("Mesaj gönderilirken hata oluştu:", error);
            alert("Mesaj gönderilemedi. Lütfen tekrar deneyin.");
        }
    }
});

// Grup oluştur
createGroupBtn.addEventListener('click', async () => {
    const groupName = prompt('Grup adını girin:');
    if (groupName) {
        const groupRef = push(ref(database, 'groups'));
        await set(groupRef, {
            name: groupName,
            createdBy: currentUser.uid,
            createdAt: Date.now(),
            members: {
                [currentUser.uid]: true
            }
        });
    }
});

// Kullanıcıları yükle
async function loadUsers() {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        userList.innerHTML = '<h3>Kullanıcılar</h3>';
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            const userId = childSnapshot.key;
            if (userId !== currentUser.uid) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.textContent = userData.name;
                userElement.onclick = () => startPrivateChat(userId, userData.name);
                userList.appendChild(userElement);
            }
        });
    });
}

// Grupları yükle
function loadGroups() {
    const groupsRef = ref(database, 'groups');
    onValue(groupsRef, (snapshot) => {
        groupList.innerHTML = '<h3>Gruplar</h3>';
        snapshot.forEach((childSnapshot) => {
            const groupData = childSnapshot.val();
            const groupId = childSnapshot.key;
            if (groupData.members && groupData.members[currentUser.uid]) {
                const groupElement = document.createElement('div');
                groupElement.className = 'group-item';
                groupElement.textContent = groupData.name;
                groupElement.onclick = () => openGroupChat(groupId, groupData.name);
                groupList.appendChild(groupElement);
            }
        });
    });
}

// Özel sohbet başlat
function startPrivateChat(userId, userName) {
    currentChat = [currentUser.uid, userId].sort().join('-');
    currentChatType = 'private';
    chatHeader.textContent = `Sohbet: ${userName}`;
    loadMessages();
}

// Grup sohbetini aç
function openGroupChat(groupId, groupName) {
    currentChat = groupId;
    currentChatType = 'group';
    chatHeader.textContent = `Grup: ${groupName}`;
    loadMessages();
}

// Mesajları yükle
function loadMessages() {
    if (!currentChat) return;

    const messagesRef = ref(database, `${currentChatType}s/${currentChat}/messages`);
    onValue(messagesRef, (snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.forEach((childSnapshot) => {
            const message = childSnapshot.val();
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.senderId === currentUser.uid ? 'own' : ''}`;
            messageElement.textContent = `${message.senderName}: ${message.text}`;
            messagesDiv.appendChild(messageElement);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// Kullanıcı bilgilerini yükle
async function loadUserData() {
    const userRef = ref(database, `users/${currentUser.uid}`);
    const snapshot = await get(userRef);
    const userData = snapshot.val();
    userInfo.textContent = `Hoş geldin, ${userData.name}!`;
}

// UI gösterme/gizleme fonksiyonları
function showMainApp() {
    authContainer.style.display = 'none';
    mainContainer.style.display = 'grid';
}

function showAuthContainer() {
    authContainer.style.display = 'block';
    mainContainer.style.display = 'none';
}

// Giriş/Kayıt form geçişleri
document.getElementById('showRegister').onclick = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
};

document.getElementById('showLogin').onclick = () => {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}; 