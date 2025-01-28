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
document.addEventListener('DOMContentLoaded', function() {
    // Çıkış yapma işlemi
    initializeLogout();
    
    // Auth durumunu kontrol et
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            try {
                // Kullanıcı bilgilerini al veya oluştur
                userInfo = await getUserInfo(user.uid);
                
                // Admin kontrolü yap
                await checkAndSetupAdmin();
                
                // Online durumunu ayarla
                await setupOnlineStatus(user.uid);
                
                // Chat sistemini başlat
                initializeChatSystem();
                
                // Satın al butonlarını başlat
                initializeBuyButtons();
            } catch (error) {
                console.error('Başlatma hatası:', error);
                showNotification('Sistem başlatılamadı', 'error');
            }
        }
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

// Satın al butonlarını başlat
function initializeBuyButtons() {
    const buyButton = document.querySelector('.buy-button');
    const chatModal = document.getElementById('chatModal');
    
    if (buyButton) {
        buyButton.addEventListener('click', () => {
            // Chat modalını göster
            if (chatModal) {
                // Modal'ı görünür yap
                chatModal.style.display = 'block';
                
                // Chat mesajlarını hazırla
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    // Hoşgeldin mesajını göster
                    chatMessages.innerHTML = `
                        <div class="welcome-message">
                            <h4>ClonicPass Müşteri Hizmetleri</h4>
                            <p>Size nasıl yardımcı olabiliriz?</p>
                        </div>
                        <div class="chat-connect-container">
                            <div class="online-users-info">
                                <i class="fas fa-circle online-indicator"></i>
                                <span>Müşteri temsilcilerimiz hazır</span>
                            </div>
                            <button id="connectSupport" class="connect-support-btn">
                                <i class="fas fa-headset"></i>
                                Görüşmeyi Başlat
                            </button>
                        </div>
                    `;

                    // Bağlan butonunu aktifleştir
                    const connectSupport = document.getElementById('connectSupport');
                    if (connectSupport) {
                        connectSupport.style.display = 'block';
                        connectSupport.disabled = false;
                        
                        // Bağlan butonuna tıklama olayı ekle
                        connectSupport.addEventListener('click', async () => {
                            try {
                                // Müşteri hizmetleri durumunu kontrol et
                                const status = await checkSupportAvailability();
                                if (status.available) {
                                    // Chat'i başlat
                                    await startChat();
                                    
                                    // Chat input alanını aktifleştir
                                    const chatInput = document.getElementById('chatInput');
                                    const sendMessage = document.getElementById('sendMessage');
                                    if (chatInput) {
                                        chatInput.disabled = false;
                                        chatInput.placeholder = 'Mesajınızı yazın...';
                                        chatInput.focus();
                                    }
                                    if (sendMessage) sendMessage.disabled = false;
                                    
                                    // Bağlan butonunu gizle
                                    connectSupport.style.display = 'none';
                                } else {
                                    // Sıraya al
                                    await addToQueue();
                                    
                                    // Sıra mesajını göster
                                    const queueMessage = document.getElementById('queueMessage');
                                    if (queueMessage) {
                                        queueMessage.style.display = 'block';
                                        queueMessage.innerHTML = `
                                            <div class="queue-info">
                                                <i class="fas fa-clock"></i>
                                                <p>Müşteri temsilcilerimiz şu an meşgul.</p>
                                                <p>Sıradaki pozisyonunuz: <span id="queuePosition">1</span></p>
                                            </div>
                                            <div class="queue-loader"></div>
                                        `;
                                    }
                                }
                            } catch (error) {
                                console.error('Bağlantı hatası:', error);
                                showNotification('Bağlantı kurulamadı', 'error');
                            }
                        });
                    }
                }
            }
        });
    }

    // Chat kapatma butonunu aktifleştir
    const closeChat = document.querySelector('.close-chat');
    if (closeChat) {
        closeChat.addEventListener('click', () => {
            if (currentChatId) {
                if (confirm('Görüşmeyi sonlandırmak istediğinize emin misiniz?')) {
                    endChat();
                    chatModal.style.display = 'none';
                }
            } else {
                chatModal.style.display = 'none';
            }
        });
    }
}

// Müşteri hizmetleri durumunu güncelle
function updateSupportStatus(status) {
    const statusElement = document.getElementById('supportStatus');
    const connectButton = document.getElementById('connectSupport');
    const queueMessage = document.getElementById('queueMessage');
    
    if (statusElement) {
        statusElement.className = 'online-status';
        statusElement.classList.add(status.available ? 'online' : 'offline');
    }

    if (connectButton) {
        connectButton.disabled = !status.available;
        connectButton.textContent = status.available ? 
            'Müşteri Hizmetlerine Bağlan' : 
            'Müşteri Hizmetleri Meşgul';
    }

    if (queueMessage) {
        queueMessage.style.display = status.available ? 'none' : 'block';
    }
}

// Chat sistemini başlat - güncellendi
function initializeChatSystem() {
    const connectButton = document.getElementById('connectSupport');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessage');

    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            try {
                // Müşteri hizmetleri durumunu kontrol et
                const status = await checkSupportAvailability();
                
                if (status.available) {
                    // Chat'i başlat
                    const chatId = await startChat();
                    
                    // Chat arayüzünü hazırla
                    const chatMessages = document.getElementById('chatMessages');
                    if (chatMessages) {
                        chatMessages.innerHTML = `
                            <div class="chat-header">
                                <div class="chat-status">
                                    <i class="fas fa-circle online"></i>
                                    <span>Bağlandı</span>
                                </div>
                            </div>
                            <div class="messages-container"></div>
                        `;
                    }

                    // Input alanını aktifleştir
                    if (chatInput) {
                        chatInput.disabled = false;
                        chatInput.placeholder = 'Mesajınızı yazın...';
                        chatInput.focus();
                    }
                    if (sendButton) {
                        sendButton.disabled = false;
                    }

                    // Bağlan butonunu gizle
                    connectButton.style.display = 'none';

                    // Mesajları dinlemeye başla
                    listenToMessages();

                } else {
                    await addToQueue();
                }
            } catch (error) {
                console.error('Chat başlatma hatası:', error);
                showNotification('Bağlantı kurulamadı', 'error');
            }
        });
    }

    // Enter ile mesaj gönderme
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // Gönder butonu ile mesaj gönderme
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            sendChatMessage();
        });
    }
}

// Chat başlatma fonksiyonu - güncellendi
async function startChat() {
    try {
        // Yeni chat oluştur
        const chatRef = firebase.database().ref('chats').push();
        const chatId = chatRef.key;
        
        // Chat verilerini kaydet
        await chatRef.set({
            userId: userInfo.uid,
            userInfo: {
                name: userInfo.name,
                surname: userInfo.surname,
                email: userInfo.email
            },
            startTime: Date.now(),
            status: 'active',
            messages: {}
        });

        // Chat ID'yi sakla
        currentChatId = chatId;

        // Support durumunu güncelle
        await firebase.database().ref('supportStatus').update({
            busy: true,
            currentUser: userInfo.uid
        });

        return chatId;
    } catch (error) {
        console.error('Chat başlatma hatası:', error);
        throw error;
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

// Mesaj gönderme
async function sendChatMessage(message) {
    if (!currentChatId) return;
    
    // Eğer message parametresi yoksa, input'tan al
    if (!message) {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput || !chatInput.value.trim()) return;
        message = chatInput.value.trim();
        chatInput.value = '';
    }

    try {
        await firebase.database().ref(`chats/${currentChatId}/messages`).push({
            sender: firebase.auth().currentUser.uid,
            message: message,
            timestamp: Date.now(),
            type: isAdmin ? 'admin' : 'user',
            senderName: userInfo.name
        });

        // Mesajı görüntüle
        displayMessage({
            sender: firebase.auth().currentUser.uid,
            message: message,
            timestamp: Date.now(),
            type: isAdmin ? 'admin' : 'user',
            senderName: userInfo.name
        });

    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        showNotification('Mesaj gönderilemedi', 'error');
    }
}

// Mesaj görüntüleme fonksiyonunu güncelle
function displayMessage(message) {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.type}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">${message.senderName}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${message.message}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Chat dinleme fonksiyonunu güncelle
function listenToMessages() {
    if (!currentChatId) return;

    // Önceki dinleyiciyi temizle
    firebase.database().ref(`chats/${currentChatId}/messages`).off();

    // Yeni mesajları dinle
    firebase.database().ref(`chats/${currentChatId}/messages`)
        .orderByChild('timestamp')
        .on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (message && message.timestamp > Date.now() - 1000) { // Son 1 saniyedeki mesajları göster
                displayMessage(message);
            }
        });
}

// Bildirim göster
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
}

// Yardımcı fonksiyonlar
function getNotificationIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

// Admin paneli başlatma fonksiyonunu güncelle
function initializeAdminPanel() {
    const user = firebase.auth().currentUser;
    if (user && user.email === 'cepyseo@outlook.com') {
        isAdmin = true;
        
        // Önce mevcut admin panelini temizle
        const existingPanel = document.querySelector('.admin-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        // Admin panelini oluştur
        const adminPanel = document.createElement('div');
        adminPanel.className = 'admin-panel';
        adminPanel.innerHTML = `
            <div class="admin-header">
                <h3>Admin Paneli</h3>
                <div class="admin-stats">
                    <div class="stat-item">
                        <i class="fas fa-users"></i>
                        <div class="stat-info">
                            <span id="onlineUsersCount">0</span>
                            <label>Online</label>
                        </div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-clock"></i>
                        <div class="stat-info">
                            <span id="queueCount">0</span>
                            <label>Sırada</label>
                        </div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-comments"></i>
                        <div class="stat-info">
                            <span id="totalChats">0</span>
                            <label>Görüşme</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="admin-buttons">
                <button onclick="toggleUserList()" class="admin-btn">
                    <i class="fas fa-users"></i> Kullanıcılar
                </button>
                <button onclick="toggleQueueList()" class="admin-btn">
                    <i class="fas fa-list"></i> Sıradakiler
                </button>
            </div>
            <div id="adminContent" class="admin-content"></div>
        `;

        // Admin panelini sayfaya ekle
        const mainContent = document.querySelector('.main-content') || document.body;
        mainContent.insertBefore(adminPanel, mainContent.firstChild);

        // Analitikleri başlat
        initializeAnalytics();

        // İlk olarak kullanıcı listesini göster
        toggleUserList();
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
        sendChatMessage('Merhaba, size nasıl yardımcı olabilirim?');
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
            const chatId = await startChat();
            
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

// Admin paneli fonksiyonları
window.toggleUserList = function() {
    const adminContent = document.getElementById('adminContent');
    
    firebase.database().ref('users').once('value')
        .then((snapshot) => {
            const users = snapshot.val() || {};
            let html = `
                <div class="user-management">
                    <h4>Kullanıcı Yönetimi</h4>
                    <div class="search-box">
                        <input type="text" id="userSearch" placeholder="Kullanıcı ara..." onkeyup="filterUsers()">
                    </div>
                    <div class="user-list">
            `;
            
            Object.entries(users).forEach(([uid, user]) => {
                html += `
                    <div class="user-item" data-user-id="${uid}">
                        <div class="user-info">
                            <span class="user-name">${user.name} ${user.surname}</span>
                            <span class="user-email">${user.email}</span>
                            <span class="user-status ${user.online ? 'online' : 'offline'}">
                                ${user.online ? 'Çevrimiçi' : 'Çevrimdışı'}
                            </span>
                        </div>
                        <div class="user-actions">
                            <button onclick="banUser('${uid}')" class="ban-btn" title="Kullanıcıyı Engelle">
                                <i class="fas fa-ban"></i>
                            </button>
                            <button onclick="deleteUser('${uid}')" class="remove-btn" title="Kullanıcıyı Sil">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
            adminContent.innerHTML = html;
        })
        .catch(error => {
            console.error('Kullanıcı listesi yükleme hatası:', error);
            showNotification('Kullanıcı listesi yüklenemedi', 'error');
        });
};

// Sıra listesi fonksiyonu
window.toggleQueueList = function() {
    const adminContent = document.getElementById('adminContent');
    
    firebase.database().ref('queue').once('value')
        .then((snapshot) => {
            const queue = snapshot.val() || {};
            let html = `
                <div class="queue-management">
                    <h4>Sıra Yönetimi</h4>
                    <div class="queue-list">
            `;
            
            Object.entries(queue)
                .sort(([, a], [, b]) => a.timestamp - b.timestamp)
                .forEach(([uid, data], index) => {
                    const waitingTime = formatWaitingTime(Date.now() - data.timestamp);
                    html += `
                        <div class="queue-item">
                            <div class="queue-position">#${index + 1}</div>
                            <div class="queue-user-info">
                                <span class="user-name">${data.name} ${data.surname}</span>
                                <span class="user-email">${data.email}</span>
                                <span class="waiting-time">Bekleme: ${waitingTime}</span>
                            </div>
                            <div class="queue-actions">
                                <button onclick="startChatWithUser('${uid}')" class="start-chat-btn">
                                    <i class="fas fa-comments"></i> Görüşme Başlat
                                </button>
                                <button onclick="removeFromQueue('${uid}')" class="remove-btn">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `;
                });
            
            if (Object.keys(queue).length === 0) {
                html += `<p class="no-data">Sırada bekleyen kullanıcı yok</p>`;
            }
            
            html += `</div></div>`;
            adminContent.innerHTML = html;
        })
        .catch(error => {
            console.error('Sıra listesi yükleme hatası:', error);
            showNotification('Sıra listesi yüklenemedi', 'error');
        });
};

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