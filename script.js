import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getDatabase, ref, push, onValue, set, get, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";
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
const auth = getAuth();
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

let currentUser = null;
let currentChat = null;
let currentChatType = null; // 'private' veya 'group'
let typingTimeout = null;
let lastTypingUpdate = 0;
let unreadMessages = {};

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
function listenToTyping() {
    if (!currentChat) return;

    const typingRef = ref(database, `${currentChatType}s/${currentChat}/typing`);
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
                const names = snapshots.map(snap => snap.val());
                typingIndicator.textContent = names.join(', ') + ' yazıyor...';
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
        } catch (error) {
            console.error('Kullanıcı durumu güncellenirken hata:', error);
        }
    } else {
        // Kullanıcı oturumu kapalı
        currentUser = null;
        showAuthContainer();
    }
});

// Kayıt ol
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    clearErrors();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const name = document.getElementById('registerName').value;

    if (name.length < 3) {
        showError('registerNameError', 'İsim en az 3 karakter olmalıdır');
        return;
    }

    if (password.length < 6) {
        showError('registerPasswordError', 'Şifre en az 6 karakter olmalıdır');
        return;
    }

    try {
        // Önce Authentication'da kullanıcı oluştur
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        try {
            // Sonra veritabanına kullanıcı bilgilerini kaydet
            await set(ref(database, 'users/' + user.uid), {
                name: name,
                email: email,
                createdAt: Date.now(),
                status: 'offline',
                lastOnline: Date.now()
            });

            // E-posta doğrulama gönder
            await sendEmailVerification(user);
            
            alert('Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.');
            
            // Kullanıcıyı çıkış yaptır
            await signOut(auth);
            
            // Login formunu göster
            document.getElementById('registerForm').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
        } catch (dbError) {
            // Veritabanı hatası durumunda kullanıcıyı sil
            await user.delete();
            throw dbError;
        }
    } catch (error) {
        console.error("Kayıt hatası:", error);
        switch (error.code) {
            case 'auth/email-already-in-use':
                showError('registerEmailError', 'Bu e-posta adresi zaten kullanımda');
                break;
            case 'auth/invalid-email':
                showError('registerEmailError', 'Geçersiz e-posta adresi');
                break;
            case 'auth/weak-password':
                showError('registerPasswordError', 'Şifre çok zayıf');
                break;
            case 'auth/operation-not-allowed':
                showError('registerEmailError', 'E-posta/şifre girişi etkin değil');
                break;
            default:
                showError('registerEmailError', `Kayıt hatası: ${error.message}`);
        }
    }
});

// Giriş yap
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'Giriş yapılıyor...';

        // Persistence türünü belirle
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        
        // Persistence ayarını güncelle
        await setPersistence(auth, persistenceType);
        
        // Giriş işlemi
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            submitButton.disabled = false;
            submitButton.textContent = 'Giriş Yap';
            throw new Error('email-not-verified');
        }

        // Kullanıcı durumunu güncelle
        await set(ref(database, `users/${user.uid}/status`), 'online');
        
        // Beni hatırla seçeneğini localStorage'a kaydet
        localStorage.setItem('rememberMe', rememberMe);

        // Ana sayfaya yönlendir
        showMainApp();
        
    } catch (error) {
        console.error('Giriş hatası:', error);
        submitButton.disabled = false;
        submitButton.textContent = 'Giriş Yap';

        if (error.code === 'auth/network-request-failed') {
            showError('loginEmailError', 'İnternet bağlantınızı kontrol edin');
        } else if (error.message === 'email-not-verified') {
            showError('loginEmailError', 'Lütfen önce e-posta adresinizi doğrulayın');
        } else {
            switch (error.code) {
                case 'auth/user-not-found':
                    showError('loginEmailError', 'Kullanıcı bulunamadı');
                    break;
                case 'auth/wrong-password':
                    showError('loginPasswordError', 'Hatalı şifre');
                    break;
                case 'auth/invalid-email':
                    showError('loginEmailError', 'Geçersiz e-posta adresi');
                    break;
                case 'auth/too-many-requests':
                    showError('loginEmailError', 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin');
                    break;
                default:
                    showError('loginEmailError', 'Giriş yapılamadı. Lütfen tekrar deneyin.');
            }
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
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (message && currentChat) {
        try {
            const chatRef = ref(database, `${currentChatType}s/${currentChat}/messages`);
            const messageData = {
                text: message,
                senderId: currentUser.uid,
                senderName: (await get(ref(database, `users/${currentUser.uid}/name`))).val(),
                timestamp: serverTimestamp()
            };

            await push(chatRef, messageData);
            
            // Okunmamış mesajları güncelle
            const chatMembersRef = ref(database, `${currentChatType}s/${currentChat}/members`);
            const membersSnapshot = await get(chatMembersRef);
            const members = membersSnapshot.val() || {};
            
            Object.keys(members).forEach(memberId => {
                if (memberId !== currentUser.uid) {
                    const unreadRef = ref(database, `${currentChatType}s/${currentChat}/unread/${memberId}`);
                    get(unreadRef).then(snapshot => {
                        const current = snapshot.val() || 0;
                        set(unreadRef, current + 1);
                    });
                }
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
        try {
            const groupRef = push(ref(database, 'groups'));
            await set(groupRef, {
                name: groupName,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                members: {
                    [currentUser.uid]: true
                },
                unread: {}
            });
            alert('Grup başarıyla oluşturuldu!');
        } catch (error) {
            alert('Grup oluşturulurken bir hata oluştu: ' + error.message);
        }
    }
});

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

// Hata gösterme fonksiyonu
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

// Hataları temizleme fonksiyonu
function clearErrors() {
    const errorElements = document.getElementsByClassName('error-message');
    for (let element of errorElements) {
        element.style.display = 'none';
        element.textContent = '';
    }
}

// Şifre göster/gizle ve beni hatırla fonksiyonlarını ekleyelim
document.addEventListener('DOMContentLoaded', () => {
    // Şifre göster/gizle butonları için event listener
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const passwordInput = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // Beni hatırla durumunu kontrol et ve ayarla
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    rememberMeCheckbox.checked = savedRememberMe;

    // Beni hatırla değiştiğinde localStorage'ı güncelle
    rememberMeCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('rememberMe', e.target.checked);
    });
}); 