// Kullanıcı durumu kontrolü için global değişkenler
let isOnline = true;
let userInfo = null;
let isAdmin = false;
let currentChatId = null;
let isInQueue = false;

// Kullanıcı bilgilerini al ve sakla - güncellendi
async function getUserInfo(uid) {
    try {
        const snapshot = await firebase.database().ref(`users/${uid}`).once('value');
        const userData = snapshot.val();
        
        // Eğer kullanıcı bilgileri yoksa, varsayılan bilgileri oluştur
        if (!userData) {
            const currentUser = firebase.auth().currentUser;
            const defaultUserData = {
                uid: uid,
                name: currentUser.displayName || 'Misafir',
                surname: '',
                email: currentUser.email,
                createdAt: Date.now(),
                lastSeen: Date.now()
            };

            // Varsayılan bilgileri kaydet
            await firebase.database().ref(`users/${uid}`).set(defaultUserData);
            return defaultUserData;
        }

        return {
            uid: uid,
            name: userData.name || 'Misafir',
            surname: userData.surname || '',
            email: userData.email,
            createdAt: userData.createdAt || Date.now(),
            lastSeen: userData.lastSeen || Date.now()
        };
    } catch (error) {
        console.error('Kullanıcı bilgileri alınamadı:', error);
        // Varsayılan bilgileri döndür
        return {
            uid: uid,
            name: 'Misafir',
            surname: '',
            email: firebase.auth().currentUser?.email || '',
            createdAt: Date.now(),
            lastSeen: Date.now()
        };
    }
}

// Sayfa yüklendiğinde çalışacak kodlar
document.addEventListener('DOMContentLoaded', async function() {
    // Kullanıcı kontrolü
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            userInfo = await getUserInfo(user.uid);
            setupChatSystem();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Satın Al butonuna tıklandığında
    const buyButtons = document.querySelectorAll('.buy-btn');
    buyButtons.forEach(button => {
        button.addEventListener('click', () => {
            openSupportChat();
        });
    });

    // Sayfa kapatıldığında çevrimdışı ol
    window.addEventListener('beforeunload', () => {
        if (firebase.auth().currentUser) {
            firebase.database().ref(`status/${firebase.auth().currentUser.uid}`).remove();
            if (isInQueue) {
                firebase.database().ref(`queue/${firebase.auth().currentUser.uid}`).remove();
            }
        }
    });
});

// Çıkış işlemlerini başlat
function initializeLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                // Çevrimiçi durumunu kaldır
                if (firebase.auth().currentUser) {
                    await firebase.database().ref(`status/${firebase.auth().currentUser.uid}`).remove();
                }
                // Sıradaysa çıkar
                if (isInQueue) {
                    await firebase.database().ref(`queue/${firebase.auth().currentUser.uid}`).remove();
                }
                // Aktif görüşme varsa sonlandır
                if (currentChatId) {
                    await firebase.database().ref(`chats/${currentChatId}`).update({
                        status: 'ended',
                        endTime: Date.now()
                    });
                }
                // Çıkış yap
                await firebase.auth().signOut();
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Çıkış hatası:', error);
                showNotification('Çıkış yapılırken bir hata oluştu', 'error');
            }
        });
    }
}

// Online durumu takibi güncellenmiş hali
async function setupOnlineStatus(uid) {
    try {
        const userStatusRef = firebase.database().ref(`status/${uid}`);
        const userRef = firebase.database().ref(`users/${uid}`);

        // Kullanıcı bilgilerini al
        userInfo = await getUserInfo(uid);

        firebase.database().ref('.info/connected').on('value', async (snapshot) => {
            if (!snapshot.val()) {
                isOnline = false;
                return;
            }

            isOnline = true;
            
            // Çıkış yapıldığında durumu güncelle
            await userStatusRef.onDisconnect().remove();
            
            // Online durumunu güncelle
            await userStatusRef.set({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                userInfo: {
                    name: userInfo.name,
                    surname: userInfo.surname,
                    email: userInfo.email
                }
            });

            // Kullanıcı bilgilerini güncelle
            await userRef.update({
                lastSeen: firebase.database.ServerValue.TIMESTAMP,
                lastActive: new Date().toISOString()
            });
        });
    } catch (error) {
        console.error('Online durum ayarlanamadı:', error);
        showNotification('Bağlantı hatası oluştu', 'error');
    }
}

// Müşteri hizmetleri sohbetini aç
function openSupportChat() {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.style.display = 'flex';
    
    // Hoşgeldin mesajını göster
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="system-message">
            <p>Hoş geldiniz! Size nasıl yardımcı olabiliriz?</p>
            <button onclick="startNewChat()" class="start-chat-btn">
                Görüşme Başlat
            </button>
        </div>
    `;
}

// Yeni sohbet başlat
async function startNewChat() {
    try {
        const user = firebase.auth().currentUser;
        
        // Yeni sohbet oluştur
        const chatRef = firebase.database().ref('chats').push();
        const chatId = chatRef.key;
        
        const chatData = {
            startedAt: Date.now(),
            userId: user.uid,
            userName: userInfo.name,
            userEmail: user.email,
            status: 'active',
            messages: {
                welcome: {
                    text: 'Hoş geldiniz! Müşteri temsilcimiz birazdan size yardımcı olacak.',
                    timestamp: Date.now(),
                    type: 'system'
                }
            }
        };

        await chatRef.set(chatData);
        currentChatId = chatId;

        // Sohbet arayüzünü aktif et
        enableChatInterface();
        
        // Mesajları dinlemeye başla
        listenToMessages(chatId);

    } catch (error) {
        console.error('Sohbet başlatma hatası:', error);
        showNotification('Sohbet başlatılamadı', 'error');
    }
}

// Sohbet arayüzünü aktif et
function enableChatInterface() {
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');

    // Input ve butonu aktif et
    chatInput.disabled = false;
    sendButton.disabled = false;

    // Mesaj gönderme olayını ekle
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(chatInput.value);
        }
    });

    sendButton.addEventListener('click', () => {
        sendMessage(chatInput.value);
    });
}

// Mesaj gönder
async function sendMessage(text) {
    if (!currentChatId || !text.trim()) return;

    try {
        const messageRef = firebase.database().ref(`chats/${currentChatId}/messages`).push();
        
        await messageRef.set({
            text: text.trim(),
            sender: firebase.auth().currentUser.uid,
            timestamp: Date.now(),
            type: 'user'
        });

        // Input'u temizle
        document.getElementById('chatInput').value = '';

    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        showNotification('Mesaj gönderilemedi', 'error');
    }
}

// Mesajları dinle
function listenToMessages(chatId) {
    const messagesRef = firebase.database().ref(`chats/${chatId}/messages`);
    
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
    });
}

// Mesajı görüntüle
function displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    const currentUser = firebase.auth().currentUser;
    
    messageDiv.className = `message ${message.sender === currentUser.uid ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${message.text}</p>
            <span class="message-time">${time}</span>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Kullanıcı bilgilerini gösterme
async function showUserInfo(userId) {
    try {
        const userSnapshot = await firebase.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();
        
        const chatHeader = document.querySelector('.chat-header h3');
        chatHeader.innerHTML = `
            <span class="online-status active"></span>
            ${userData.name} ${userData.surname}
            <span class="user-email">${userData.email}</span>
        `;
    } catch (error) {
        console.error('Kullanıcı bilgileri alınamadı:', error);
    }
}

// Müşteri hizmetleri durumu kontrolü - güncellendi
async function checkSupportAvailability() {
    try {
        const statusSnapshot = await firebase.database().ref('supportStatus').once('value');
        const status = statusSnapshot.val() || {};
        
        // Admin online durumunu kontrol et
        const adminSnapshot = await firebase.database().ref('users').orderByChild('isAdmin').equalTo(true).once('value');
        const admins = adminSnapshot.val() || {};
        const isAdminOnline = Object.values(admins).some(admin => admin.online);

        return {
            available: isAdminOnline && !status.busy,
            currentUser: status.currentUser,
            queueLength: status.queueLength || 0
        };
    } catch (error) {
        console.error('Durum kontrolü hatası:', error);
        return { available: false, queueLength: 0 };
    }
}

// Kullanıcıdan sıradan çıkarma fonksiyonu
window.removeFromQueue = async function(uid) {
    try {
        await firebase.database().ref(`queue/${uid}`).remove();
        showNotification('Kullanıcı sıradan çıkarıldı', 'success');
    } catch (error) {
        console.error('Sıradan çıkarma hatası:', error);
        showNotification('Sıradan çıkarma başarısız', 'error');
    }
};

// Kullanıcı engelleme fonksiyonu
window.banUser = async function(uid) {
    try {
        await firebase.database().ref(`bannedUsers/${uid}`).set({
            timestamp: Date.now(),
            bannedBy: firebase.auth().currentUser.uid
        });
        showNotification('Kullanıcı engellendi', 'success');
    } catch (error) {
        console.error('Engelleme hatası:', error);
        showNotification('Engelleme başarısız', 'error');
    }
};

// İstatistikleri güncelle
function updateAdminStats() {
    if (!isAdmin) return;

    // Online kullanıcıları say
    firebase.database().ref('status').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const onlineCount = Object.values(users).filter(user => user.online).length;
        const element = document.getElementById('onlineUsersCount');
        if (element) element.textContent = onlineCount;
    });

    // Sıradaki kullanıcıları say
    firebase.database().ref('queue').on('value', (snapshot) => {
        const queue = snapshot.val() || {};
        const element = document.getElementById('queueCount');
        if (element) element.textContent = Object.keys(queue).length;
    });
}

// Eksik fonksiyonları ekleyelim
async function checkIfBanned(uid) {
    const snapshot = await firebase.database().ref(`bannedUsers/${uid}`).once('value');
    return snapshot.exists();
}

// Admin kontrolü ve yetkilendirme
async function checkAndSetupAdmin() {
    const user = firebase.auth().currentUser;
    if (user && user.email === 'cepyseo@outlook.com') {
        try {
            // Admin olarak işaretle
            await firebase.database().ref(`users/${user.uid}`).update({
                isAdmin: true,
                adminSince: Date.now()
            });
            
            // Admin durumunu local değişkende sakla
            isAdmin = true;
            
            // Admin panelini başlat
            initializeAdminPanel();
            
            console.log('Admin yetkileri ayarlandı');
        } catch (error) {
            console.error('Admin yetkilendirme hatası:', error);
        }
    }
}

// Seçilen kullanıcıyla görüşme başlat
window.startChatWithUser = async function(userId) {
    try {
        // Kullanıcı bilgilerini al
        const userSnapshot = await firebase.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            throw new Error('Kullanıcı bulunamadı');
        }

        // Yeni chat oluştur
        const chatId = firebase.database().ref('chats').push().key;
        
        // Chat verilerini kaydet
        await firebase.database().ref(`chats/${chatId}`).set({
            userId: userId,
            adminId: firebase.auth().currentUser.uid,
            userInfo: {
                name: userData.name,
                surname: userData.surname,
                email: userData.email
            },
            startTime: Date.now(),
            status: 'active',
            messages: {}
        });

        // Kullanıcıyı sıradan çıkar
        await firebase.database().ref(`queue/${userId}`).remove();

        // Support durumunu güncelle
        await firebase.database().ref('supportStatus').update({
            busy: true,
            currentUser: userId
        });

        // Chat penceresini aç
        openAdminChatWindow(chatId, userData);

        showNotification('Görüşme başlatıldı', 'success');
    } catch (error) {
        console.error('Görüşme başlatma hatası:', error);
        showNotification('Görüşme başlatılamadı', 'error');
    }
};

// Admin chat penceresini aç
function openAdminChatWindow(chatId, userData) {
    const chatModal = document.getElementById('chatModal');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendMessage = document.getElementById('sendMessage');

    if (chatModal && chatMessages) {
        // Chat modalını göster
        chatModal.style.display = 'block';
        
        // Chat başlığını güncelle
        chatMessages.innerHTML = `
            <div class="chat-header-info">
                <div class="user-info">
                    <span class="user-name">${userData.name} ${userData.surname}</span>
                    <span class="user-email">${userData.email}</span>
                </div>
            </div>
            <div class="messages-container"></div>
        `;

        // Input alanını aktifleştir
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Mesajınızı yazın...';
            chatInput.focus();
        }
        if (sendMessage) sendMessage.disabled = false;

        // Chat ID'yi sakla
        currentChatId = chatId;

        // Mesajları dinlemeye başla
        listenToMessages();

        // Hoşgeldin mesajını gönder
        sendMessage('Merhaba, size nasıl yardımcı olabilirim?');
    }
}

// CSS güncellemeleri
const chatStyles = `
.chat-header {
    background: var(--bg-dark);
    padding: 10px;
    border-radius: 8px 8px 0 0;
    margin-bottom: 10px;
}

.chat-status {
    display: flex;
    align-items: center;
    gap: 8px;
}

.chat-status i.online {
    color: #00ff00;
    font-size: 12px;
}

.messages-container {
    height: 400px;
    overflow-y: auto;
    padding: 15px;
    background: var(--bg-card);
    border-radius: 0 0 8px 8px;
}

.message {
    max-width: 80%;
    margin: 8px 0;
    padding: 10px;
    border-radius: 8px;
    word-break: break-word;
}

.message.user {
    background: var(--primary-color);
    color: white;
    margin-left: auto;
}

.message.admin {
    background: var(--bg-dark);
    color: var(--text-primary);
}
`;

// Mevcut stil elementini güncelle
const existingStyle = document.getElementById('chatStyles');
if (existingStyle) {
    existingStyle.textContent += chatStyles;
} else {
    const style = document.createElement('style');
    style.id = 'chatStyles';
    style.textContent = chatStyles;
    document.head.appendChild(style);
}

// Sıraya ekleme fonksiyonu
async function addToQueue() {
    try {
        if (!userInfo) {
            userInfo = await getUserInfo(firebase.auth().currentUser.uid);
        }

        // Önce sırada olup olmadığımızı kontrol et
        const queueSnapshot = await firebase.database().ref(`queue/${userInfo.uid}`).once('value');
        if (queueSnapshot.exists()) {
            showNotification('Zaten sıradasınız', 'warning');
            return;
        }

        isInQueue = true;
        const queueRef = firebase.database().ref('queue');
        
        // Sıraya ekle
        await queueRef.child(userInfo.uid).set({
            name: userInfo.name,
            surname: userInfo.surname,
            email: userInfo.email,
            timestamp: Date.now(),
            online: true
        });

        // Sıra pozisyonunu takip et
        listenToQueuePosition();

        // Sıra mesajını göster
        const queueMessage = document.getElementById('queueMessage');
        if (queueMessage) {
            queueMessage.style.display = 'block';
            queueMessage.innerHTML = `
                <div class="queue-info">
                    <i class="fas fa-clock"></i>
                    <p>Müşteri temsilcilerimiz şu an meşgul.</p>
                    <p>Sıradaki pozisyonunuz: <span id="queuePosition">Hesaplanıyor...</span></p>
                </div>
                <div class="queue-loader"></div>
            `;
        }

        showNotification('Sıraya alındınız', 'info');

    } catch (error) {
        console.error('Sıraya ekleme hatası:', error);
        showNotification('Sıraya eklenirken bir hata oluştu', 'error');
        isInQueue = false;
    }
}

// Sıra pozisyonunu takip et
function listenToQueuePosition() {
    if (!userInfo || !isInQueue) return;

    const queueRef = firebase.database().ref('queue');
    queueRef.on('value', (snapshot) => {
        const queue = snapshot.val() || {};
        const queueArray = Object.entries(queue)
            .sort(([, a], [, b]) => a.timestamp - b.timestamp);
        
        const position = queueArray.findIndex(([uid]) => uid === userInfo.uid) + 1;
        
        // Pozisyonu güncelle
        const positionElement = document.getElementById('queuePosition');
        if (positionElement) {
            positionElement.textContent = position > 0 ? position : 'Hesaplanıyor...';
        }

        // Eğer sıra bize geldiyse
        if (position === 1) {
            checkAndConnectToSupport();
        }
    });
}

// Destek ekibine bağlanmayı kontrol et
async function checkAndConnectToSupport() {
    try {
        const status = await checkSupportAvailability();
        if (status.available) {
            // Sıradan çık
            await firebase.database().ref(`queue/${userInfo.uid}`).remove();
            isInQueue = false;

            // Chat'i başlat
            const chatId = await startChat(userInfo.uid);
            
            // Chat arayüzünü güncelle
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="chat-header">
                        <div class="chat-status">
                            <i class="fas fa-circle online"></i>
                            <span>Müşteri Temsilcisine Bağlandınız</span>
                        </div>
                    </div>
                    <div class="messages-container"></div>
                `;
            }

            // Input alanını aktifleştir
            const chatInput = document.getElementById('chatInput');
            const sendMessage = document.getElementById('sendMessage');
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.placeholder = 'Mesajınızı yazın...';
                chatInput.focus();
            }
            if (sendMessage) sendMessage.disabled = false;

            // Sıra mesajını gizle
            const queueMessage = document.getElementById('queueMessage');
            if (queueMessage) queueMessage.style.display = 'none';

            // Mesajları dinlemeye başla
            listenToMessages();

            showNotification('Müşteri temsilcisine bağlandınız', 'success');
        }
    } catch (error) {
        console.error('Bağlantı hatası:', error);
        showNotification('Bağlantı kurulamadı', 'error');
    }
}

// CSS eklemeleri
const queueStyles = `
.queue-info {
    text-align: center;
    padding: 20px;
    background: var(--bg-dark);
    border-radius: 8px;
    margin: 10px 0;
}

.queue-loader {
    width: 40px;
    height: 40px;
    border: 3px solid var(--primary-color);
    border-top: 3px solid transparent;
    border-radius: 50%;
    margin: 15px auto;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

#queuePosition {
    font-weight: bold;
    color: var(--primary-color);
}
`;

// Stil ekle
const style = document.createElement('style');
style.textContent += queueStyles;
document.head.appendChild(style);

// Kullanıcı arama fonksiyonu
window.filterUsers = function() {
    const input = document.getElementById('userSearch');
    const filter = input.value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');

    userItems.forEach(item => {
        const name = item.querySelector('.user-name').textContent.toLowerCase();
        const email = item.querySelector('.user-email').textContent.toLowerCase();
        
        if (name.includes(filter) || email.includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
};

// Bekleme süresini formatla
function formatWaitingTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 0) {
        return `${minutes} dk ${seconds} sn`;
    }
    return `${seconds} sn`;
}

// CSS eklemeleri
const adminStyles = `
.user-management, .queue-management {
    padding: 20px;
    background: var(--bg-card);
    border-radius: 8px;
    margin-bottom: 20px;
}

.search-box {
    margin-bottom: 15px;
}

.search-box input {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-dark);
    color: var(--text-primary);
}

.user-item, .queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid var(--border-color);
    transition: background 0.3s ease;
}

.user-item:hover, .queue-item:hover {
    background: var(--bg-dark);
}

.user-info, .queue-user-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.user-name {
    font-weight: bold;
    color: var(--text-primary);
}

.user-email {
    color: var(--text-secondary);
    font-size: 0.9em;
}

.user-status {
    font-size: 0.8em;
    padding: 2px 8px;
    border-radius: 12px;
}

.user-status.online {
    background: #28a745;
    color: white;
}

.user-status.offline {
    background: #dc3545;
    color: white;
}

.user-actions, .queue-actions {
    display: flex;
    gap: 10px;
}

.ban-btn, .remove-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
}

.ban-btn {
    background: #dc3545;
    color: white;
}

.remove-btn {
    background: #6c757d;
    color: white;
}

.ban-btn:hover, .remove-btn:hover {
    opacity: 0.8;
}

.queue-position {
    font-size: 1.2em;
    font-weight: bold;
    color: var(--primary-color);
    width: 40px;
    text-align: center;
}

.waiting-time {
    font-size: 0.8em;
    color: var(--text-secondary);
}

.no-data {
    text-align: center;
    padding: 20px;
    color: var(--text-secondary);
}
`;

// Stil ekle
const adminStyleElement = document.createElement('style');
adminStyleElement.textContent = adminStyles;
document.head.appendChild(adminStyleElement);

// Admin analitik fonksiyonları
function initializeAnalytics() {
    if (!isAdmin) return;

    // Analitik verilerini güncelle
    updateAnalytics();
    
    // Her 30 saniyede bir güncelle
    setInterval(updateAnalytics, 30000);
}

// Analitik verilerini güncelle
async function updateAnalytics() {
    try {
        // Toplam kullanıcı sayısı
        const usersSnapshot = await firebase.database().ref('users').once('value');
        const totalUsers = Object.keys(usersSnapshot.val() || {}).length;

        // Online kullanıcı sayısı
        const statusSnapshot = await firebase.database().ref('status').once('value');
        const onlineUsers = Object.values(statusSnapshot.val() || {})
            .filter(status => status.online).length;

        // Sıradaki kullanıcı sayısı
        const queueSnapshot = await firebase.database().ref('queue').once('value');
        const queueLength = Object.keys(queueSnapshot.val() || {}).length;

        // Toplam görüşme sayısı
        const chatsSnapshot = await firebase.database().ref('chats').once('value');
        const totalChats = Object.keys(chatsSnapshot.val() || {}).length;

        // İstatistikleri güncelle
        const stats = {
            totalUsers,
            onlineUsers,
            queueLength,
            totalChats
        };

        // Admin panelindeki istatistikleri güncelle
        updateAdminStatsDisplay(stats);

    } catch (error) {
        console.error('Analitik güncelleme hatası:', error);
    }
}

// Admin panel istatistiklerini güncelle
function updateAdminStatsDisplay(stats) {
    const elements = {
        totalUsers: document.getElementById('totalUsersCount'),
        onlineUsers: document.getElementById('onlineUsersCount'),
        queueLength: document.getElementById('queueCount'),
        totalChats: document.getElementById('totalChats')
    };

    // Her bir istatistiği güncelle
    Object.entries(elements).forEach(([key, element]) => {
        if (element && stats[key] !== undefined) {
            element.textContent = stats[key];
        }
    });
}