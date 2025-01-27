import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getDatabase, ref, push, onValue, set, get, update, serverTimestamp, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";

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
auth.useDeviceLanguage(); // Tarayıcı dilini kullan

// Persistence ayarını güncelle
setPersistence(auth, browserLocalPersistence)
    .then(() => {
        console.log('Persistence ayarlandı');
    })
    .catch((error) => {
        console.error('Persistence hatası:', error);
    });

const database = getDatabase(app);
const storage = getStorage(app);

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
const searchInput = document.getElementById('searchInput');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const typingIndicator = document.getElementById('typingIndicator');
const emojiBtn = document.getElementById('emojiBtn');
const chatList = document.getElementById('chatList');
const menuBtn = document.querySelector('.menu-btn');

let currentUser = null;
let currentChat = null;
let currentChatType = null; // 'private' veya 'group'
let typingTimeout = null;
let lastTypingUpdate = 0;
let unreadMessages = {};
let userOwnedGroup = null;
let lastMessageTime = {};

// Mobil menü toggle
mobileMenuBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

// Arama fonksiyonunu güncelle
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    filterList(searchTerm);
});

// Gelişmiş filtreleme fonksiyonu
function filterList(searchTerm) {
    // Kullanıcıları filtrele
    const userItems = document.querySelectorAll('.user-item');
    const groupItems = document.querySelectorAll('.group-item');
    
    if (searchTerm === '') {
        // Arama terimi yoksa tüm listeleri göster
        userItems.forEach(item => item.style.display = '');
        groupItems.forEach(item => item.style.display = '');
        return;
    }

    let hasResults = false;

    // Kullanıcıları filtrele
    userItems.forEach(item => {
        const userName = item.querySelector('.user-name').textContent.toLowerCase();
        if (userName.includes(searchTerm)) {
            item.style.display = '';
            hasResults = true;
        } else {
            item.style.display = 'none';
        }
    });

    // Grupları filtrele
    groupItems.forEach(item => {
        const groupName = item.querySelector('.group-name').textContent.toLowerCase();
        if (groupName.includes(searchTerm)) {
            item.style.display = '';
            hasResults = true;
        } else {
            item.style.display = 'none';
        }
    });

    // Sonuç bulunamadı mesajını göster/gizle
    const noResultsMessage = document.getElementById('noResultsMessage');
    if (!hasResults) {
        if (!noResultsMessage) {
            const message = document.createElement('div');
            message.id = 'noResultsMessage';
            message.className = 'no-results';
            message.textContent = 'Sonuç bulunamadı';
            document.querySelector('.chat-list').appendChild(message);
        }
    } else {
        noResultsMessage?.remove();
    }
}

// Çevrimiçi durumu yönetimi
function updateOnlineStatus(online) {
    if (!currentUser) return;
    
    const userStatusRef = ref(database, `users/${currentUser.uid}/status`);
    const userLastOnlineRef = ref(database, `users/${currentUser.uid}/lastOnline`);
    
    if (online) {
        set(userStatusRef, 'online');
    } else {
        set(userStatusRef, 'offline');
        set(userLastOnlineRef, serverTimestamp());
    }
}

// Yazıyor... göstergesi
messageInput.addEventListener('input', () => {
    if (!currentChat) return;
    
    const now = Date.now();
    if (now - lastTypingUpdate > 3000) {
        const typingRef = ref(database, `${currentChatType}s/${currentChat}/typing/${currentUser.uid}`);
        set(typingRef, true);
        lastTypingUpdate = now;
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        const typingRef = ref(database, `${currentChatType}s/${currentChat}/typing/${currentUser.uid}`);
        set(typingRef, false);
    }, 3000);
});

// Yazıyor durumunu dinle
function listenToTyping(chatId, type) {
    const typingRef = ref(database, `${type}/${chatId}/typing`);
    
    onValue(typingRef, (snapshot) => {
        const typing = snapshot.val();
        if (!typing) {
            typingIndicator.style.display = 'none';
            return;
        }

        const typingUsers = Object.entries(typing)
            .filter(([uid, isTyping]) => uid !== currentUser.uid && isTyping)
            .map(([uid]) => uid);

        if (typingUsers.length > 0) {
            typingIndicator.style.display = 'block';
            // Yazanların isimlerini göster
            Promise.all(typingUsers.map(uid => 
                get(ref(database, `users/${uid}/name`))
            )).then(snapshots => {
                const names = snapshots
                    .map(snap => snap.val())
                    .filter(name => name); // null değerleri filtrele
                
                if (names.length > 0) {
                    typingIndicator.textContent = names.join(', ') + 
                        (names.length === 1 ? ' yazıyor...' : ' yazıyorlar...');
                } else {
                    typingIndicator.style.display = 'none';
                }
            });
        } else {
            typingIndicator.style.display = 'none';
        }
    });
}

// Okunmamış mesaj sayısını güncelle
function updateUnreadCount(chatId, type) {
    const unreadRef = ref(database, `${type}s/${chatId}/unread/${currentUser.uid}`);
    set(unreadRef, 0);
}

// Mesaj bildirimlerini yönet
function handleMessageNotification(message, chatName) {
    if (Notification.permission === 'granted' && document.hidden) {
        new Notification(`Yeni Mesaj - ${chatName}`, {
            body: `${message.senderName}: ${message.text}`,
            icon: '/path/to/icon.png'
        });
    }
}

// Auth durum değişikliklerini dinle
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            // Kullanıcı oturumu açık
            currentUser = user;
            
            // Kullanıcı durumunu güncelle
            await set(ref(database, `users/${user.uid}/status`), 'online');
            
            // Çıkış yapıldığında veya sayfa kapandığında durumu güncelle
            window.addEventListener('beforeunload', async () => {
                if (currentUser) {
                    await set(ref(database, `users/${currentUser.uid}/status`), 'offline');
                }
            });

            showMainApp();
            loadUserData();
            loadUsers();
            loadGroups();
            checkUserGroup();
            loadChats();
        } catch (error) {
            console.error('Kullanıcı durumu güncellenirken hata:', error);
        }
    } else {
        // Kullanıcı oturumu kapalı
        currentUser = null;
        showAuthContainer();
    }
});

// Auth işlemleri için event listener'ları ekle
document.addEventListener('DOMContentLoaded', () => {
    // Login form işlemi
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            errorDiv.textContent = '';
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            if (!userCredential.user.emailVerified) {
                await sendEmailVerification(userCredential.user);
                errorDiv.textContent = 'Lütfen email adresinizi doğrulayın. Doğrulama maili gönderildi.';
                await signOut(auth);
                return;
            }
            window.location.href = 'anasayfa.html';
        } catch (error) {
            console.error('Giriş hatası:', error);
            switch (error.code) {
                case 'auth/user-not-found':
                    errorDiv.textContent = 'Kullanıcı bulunamadı';
                    break;
                case 'auth/wrong-password':
                    errorDiv.textContent = 'Hatalı şifre';
                    break;
                case 'auth/invalid-email':
                    errorDiv.textContent = 'Geçersiz email adresi';
                    break;
                default:
                    errorDiv.textContent = 'Giriş yapılırken bir hata oluştu';
            }
        }
    });

    // Register form işlemi
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorDiv = document.getElementById('registerError');

        if (password !== confirmPassword) {
            errorDiv.textContent = 'Şifreler eşleşmiyor';
            return;
        }

        try {
            errorDiv.textContent = '';
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
            
            // Kullanıcı bilgilerini veritabanına kaydet
            const userRef = ref(database, `users/${userCredential.user.uid}`);
            await set(userRef, {
                email: email,
                createdAt: serverTimestamp(),
                status: 'offline',
                displayName: email.split('@')[0],
                photoURL: null
            });

            alert('Kayıt başarılı! Lütfen email adresinizi doğrulayın.');
            document.getElementById('showLogin').click();
        } catch (error) {
            console.error('Kayıt hatası:', error);
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorDiv.textContent = 'Bu email adresi zaten kullanımda';
                    break;
                case 'auth/invalid-email':
                    errorDiv.textContent = 'Geçersiz email adresi';
                    break;
                case 'auth/weak-password':
                    errorDiv.textContent = 'Şifre en az 6 karakter olmalıdır';
                    break;
                default:
                    errorDiv.textContent = 'Kayıt olurken bir hata oluştu';
            }
        }
    });

    // Form geçişleri için event listener'lar
    document.getElementById('showRegister')?.addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    });

    document.getElementById('showLogin')?.addEventListener('click', () => {
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });
});

// Auth durumu değişikliğini dinle
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (window.location.pathname.includes('index.html')) {
            if (user.emailVerified) {
                window.location.href = 'anasayfa.html';
            }
        }
    } else {
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }
});

// Çıkış yap
logoutBtn.addEventListener('click', async () => {
    try {
        if (currentUser) {
            await set(ref(database, `users/${currentUser.uid}/status`), 'offline');
        }
        await signOut(auth);
        showAuthContainer();
    } catch (error) {
        console.error('Çıkış yapılırken hata:', error);
        alert('Çıkış yapılırken bir hata oluştu');
    }
});

// Mesaj gönderme
messageForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentChat || !messageInput.value.trim()) return;
    
    const text = messageInput.value.trim();
    messageInput.value = '';
    autoResizeTextarea();
    
    try {
        const messageRef = ref(database, `messages/${currentChatType}/${currentChat}`);
        await push(messageRef, {
            text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email,
            timestamp: serverTimestamp(),
            status: 'sent'
        });
        
        // Yazıyor durumunu temizle
        const typingRef = ref(database, `${currentChatType}/${currentChat}/typing/${currentUser.uid}`);
        await set(typingRef, false);
        
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        alert('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
};

// Kullanıcıları yükleme fonksiyonunu güncelle
async function loadUsers() {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        userList.innerHTML = `
            <div class="list-header">
                <h3>Kullanıcılar</h3>
                <span class="online-count"></span>
            </div>
        `;
        
        let onlineCount = 0;
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            const userId = childSnapshot.key;
            
            if (userId !== currentUser.uid) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                
                const isOnline = userData.status === 'online';
                if (isOnline) onlineCount++;
                
                userElement.innerHTML = `
                    <div class="user-avatar">
                        ${userData.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-info">
                        <div class="user-name">${userData.name}</div>
                        <div class="user-status">
                            <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
                            ${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                        </div>
                    </div>
                    <div class="unread-badge" style="display: none">0</div>
                `;
                
                userElement.onclick = () => {
                    // Aktif sohbeti güncelle
                    document.querySelectorAll('.user-item.active, .group-item.active')
                        .forEach(item => item.classList.remove('active'));
                    userElement.classList.add('active');
                    
                    startPrivateChat(userId, userData.name);
                };
                
                userList.appendChild(userElement);
            }
        });
        
        // Çevrimiçi kullanıcı sayısını güncelle
        const onlineCountElement = userList.querySelector('.online-count');
        if (onlineCountElement) {
            onlineCountElement.textContent = `${onlineCount} çevrimiçi`;
        }
    });
}

// Grupları yükleme fonksiyonunu güncelle
function loadGroups() {
    const groupsRef = ref(database, 'groups');
    onValue(groupsRef, (snapshot) => {
        groupList.innerHTML = `
            <div class="list-header">
                <h3>Gruplar</h3>
                <button class="refresh-btn" onclick="loadGroups()">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
        `;
        
        snapshot.forEach((childSnapshot) => {
            const groupData = childSnapshot.val();
            const groupId = childSnapshot.key;
            
            if (groupData.members && groupData.members[currentUser.uid]) {
                const groupElement = document.createElement('div');
                groupElement.className = 'group-item';
                
                groupElement.innerHTML = `
                    <div class="group-avatar">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="group-info">
                        <div class="group-name">${groupData.name}</div>
                        <div class="group-members">
                            ${Object.keys(groupData.members).length} üye
                        </div>
                    </div>
                    <div class="unread-badge" style="display: none">0</div>
                `;
                
                groupElement.onclick = () => {
                    // Aktif sohbeti güncelle
                    document.querySelectorAll('.user-item.active, .group-item.active')
                        .forEach(item => item.classList.remove('active'));
                    groupElement.classList.add('active');
                    
                    openGroupChat(groupId, groupData.name);
                };
                
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
    loadMessages(currentChat, currentChatType);
}

// Grup sohbetini aç
function openGroupChat(groupId, groupName) {
    currentChat = groupId;
    currentChatType = 'group';
    chatHeader.textContent = `Grup: ${groupName}`;
    loadMessages(currentChat, currentChatType);
}

// Mesajları yükle
function loadMessages(chatId, type) {
    messagesDiv.innerHTML = '';
    const messagesRef = ref(database, `messages/${type}/${chatId}`);
    
    onValue(messagesRef, (snapshot) => {
        const messages = snapshot.val();
        if (!messages) return;
        
        // Mesajları tarihe göre sırala
        const sortedMessages = Object.entries(messages)
            .sort(([,a], [,b]) => (a.timestamp || 0) - (b.timestamp || 0));
        
        sortedMessages.forEach(([id, message]) => {
            const messageElement = createMessageElement(message);
            messagesDiv.appendChild(messageElement);
        });
        
        scrollToBottom();
        
        // Okunmamış mesajları sıfırla
        if (type === 'users') {
            updateUnreadCount(chatId, 'user');
        } else {
            updateUnreadCount(chatId, 'group');
        }
    });

    // Yazıyor... durumunu dinle
    listenToTyping(chatId, type);
}

// Mesaj elementi oluştur
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.senderId === currentUser.uid ? 'outgoing' : 'incoming'}`;
    
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message.text;
    
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime(message.timestamp);
    
    const status = document.createElement('span');
    status.className = 'message-status';
    if (message.senderId === currentUser.uid) {
        status.innerHTML = '<i class="fas fa-check"></i>';
    }
    
    meta.appendChild(time);
    meta.appendChild(status);
    
    div.appendChild(text);
    div.appendChild(meta);
    
    return div;
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

// Yardımcı fonksiyonlar
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Arama fonksiyonu
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        const name = item.querySelector('.chat-name').textContent.toLowerCase();
        const message = item.querySelector('.chat-message').textContent.toLowerCase();
        
        if (name.includes(searchTerm) || message.includes(searchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
});

// Mobil menü
menuBtn.onclick = () => {
    sidebar.classList.toggle('active');
};

// Çıkış yap
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await updateUserStatus(false);
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Çıkış hatası:', error);
    }
});

// Kullanıcı durumunu güncelle
async function updateUserStatus(online) {
    if (!currentUser) return;
    
    const userStatusRef = ref(database, `users/${currentUser.uid}`);
    await update(userStatusRef, {
        status: online ? 'online' : 'offline',
        lastSeen: serverTimestamp()
    });
} 