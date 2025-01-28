// Kullanıcı durumu kontrolü için global değişkenler
let isOnline = true;
let userInfo = null;
let isAdmin = false;

// Sayfa yüklendiğinde çalışacak kodlar
document.addEventListener('DOMContentLoaded', function() {
    // Auth durumunu kontrol et
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
            window.location.href = 'index.html';
        }
    });

    // Çıkış yapma işlemi
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            firebase.auth().signOut().then(() => {
                console.log('Çıkış başarılı');
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error('Çıkış hatası:', error);
                alert('Çıkış yapılırken hata oluştu: ' + error.message);
            });
        });
    }

    // Satın alma butonu işlemi
    const buyButton = document.querySelector('.buy-button');
    const chatModal = document.getElementById('chatModal');
    const closeChat = document.querySelector('.close-chat');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendMessage = document.getElementById('sendMessage');
    const queueMessage = document.getElementById('queueMessage');

    let supportAvailable = true; // Müşteri hizmetlerinin durumu

    buyButton.addEventListener('click', () => {
        chatModal.style.display = 'block';
        checkSupportAvailability();
    });

    closeChat.addEventListener('click', () => {
        chatModal.style.display = 'none';
        resetChat();
    });

    function checkSupportAvailability() {
        // Müşteri hizmetlerinin durumunu kontrol et
        firebase.database().ref('supportStatus').once('value')
            .then((snapshot) => {
                supportAvailable = !snapshot.val()?.busy;
                
                if (supportAvailable) {
                    // Müşteri hizmetleri müsaitse
                    startChat();
                } else {
                    // Müşteri hizmetleri meşgulse
                    queueMessage.style.display = 'block';
                    listenForAvailability();
                }
            });
    }

    function startChat() {
        queueMessage.style.display = 'none';
        chatInput.disabled = false;
        sendMessage.disabled = false;
        connectSupport.style.display = 'none'; // Bağlan butonunu gizle
        
        // Hoşgeldin mesajını ekle
        addMessage("Merhaba! Size nasıl yardımcı olabilirim?", 'support');
        
        // Chat mesajlarını dinlemeye başla
        const userId = firebase.auth().currentUser.uid;
        listenForMessages(userId);
    }

    function addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const messageText = document.createElement('span');
        messageText.textContent = text;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        const now = new Date();
        timeSpan.textContent = now.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.appendChild(messageText);
        messageDiv.appendChild(timeSpan);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function resetChat() {
        chatMessages.innerHTML = '';
        chatInput.value = '';
        chatInput.disabled = true;
        sendMessage.disabled = true;
        queueMessage.style.display = 'none';
    }

    function listenForAvailability() {
        const statusRef = firebase.database().ref('supportStatus');
        statusRef.on('value', (snapshot) => {
            if (!snapshot.val()?.busy) {
                statusRef.off(); // Dinlemeyi durdur
                startChat();
            }
        });
    }

    sendMessage.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (message) {
            const now = new Date();
            addMessage(message, 'user');
            chatInput.value = '';
            
            // Mesajı veritabanına kaydet
            firebase.database().ref('chats').push({
                message: message,
                timestamp: now.getTime(),
                type: 'user',
                userId: firebase.auth().currentUser.uid
            });
        }
    }

    // Müşteri hizmetleri durumunu kontrol et
    function updateSupportStatus(isOnline) {
        const statusDot = document.getElementById('supportStatus');
        statusDot.className = isOnline ? 'online-status' : 'offline-status';
    }

    // Müşteri hizmetleri durumunu dinle
    firebase.database().ref('supportStatus/online').on('value', (snapshot) => {
        updateSupportStatus(snapshot.val());
    });

    const connectSupport = document.getElementById('connectSupport');
    const onlineUsersCount = document.getElementById('onlineUsersCount');
    let currentUserName = '';
    let isInQueue = false;

    // Kullanıcı bilgilerini al
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            if (!user.emailVerified) {
                alert('Lütfen email adresinizi doğrulayın!');
                await user.sendEmailVerification();
                firebase.auth().signOut();
                window.location.href = 'index.html';
                return;
            }

            // Kullanıcı bilgilerini getir
            const userRef = firebase.database().ref('users/' + user.uid);
            const snapshot = await userRef.once('value');
            userInfo = snapshot.val();
            currentUserName = `${userInfo.name} ${userInfo.surname}`;

            // Online durumunu ayarla
            const userStatusRef = firebase.database().ref('status/' + user.uid);
            
            // Çevrimiçi durumunu güncelle
            const isOnlineRef = firebase.database().ref('.info/connected');
            isOnlineRef.on('value', (snapshot) => {
                if (snapshot.val()) {
                    userStatusRef.onDisconnect().remove();
                    userStatusRef.set({
                        online: true,
                        lastSeen: firebase.database.ServerValue.TIMESTAMP,
                        userInfo: {
                            name: userInfo.name,
                            surname: userInfo.surname,
                            email: userInfo.email
                        }
                    });
                }
            });

            // Admin kontrolü
            isAdmin = user.email === 'cepyseo@outlook.com';
            
            // Admin panelini göster
            if (isAdmin) {
                showAdminPanel();
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // Sıradaki kullanıcı sayısını güncelle
    function updateQueueCount() {
        const queueRef = firebase.database().ref('queue');
        queueRef.on('value', (snapshot) => {
            const queue = snapshot.val() || {};
            const count = Object.keys(queue).length;
            onlineUsersCount.textContent = count;
        });
    }

    // Müşteri hizmetlerine bağlanma butonu
    connectSupport.addEventListener('click', () => {
        if (!isOnline) {
            alert('İnternet bağlantınız yok! Lütfen bağlantınızı kontrol edin.');
            return;
        }

        const userId = firebase.auth().currentUser.uid;
        
        // Ban kontrolü
        firebase.database().ref('bannedUsers/' + userId).once('value')
            .then((snapshot) => {
                if (snapshot.val()) {
                    alert('Hesabınız engellenmiş durumda!');
                    return;
                }
                
                // Normal sıraya girme işlemleri...
                addToQueue(userId);
            });
    });

    // Sıra durumunu dinleme fonksiyonu
    function listenForQueue(userId) {
        const queueRef = firebase.database().ref('queue');
        queueRef.on('value', (snapshot) => {
            const queue = snapshot.val() || {};
            const queueArray = Object.entries(queue);
            
            // Sıradaki pozisyonunu bul
            const position = queueArray.findIndex(([key]) => key === userId) + 1;
            
            if (position > 0) {
                connectSupport.textContent = `Sıra Pozisyonunuz: ${position}`;
            } else {
                // Kullanıcı sırada değilse ve supportStatus.currentUser bu kullanıcıysa
                firebase.database().ref('supportStatus').once('value')
                    .then((statusSnapshot) => {
                        const status = statusSnapshot.val() || {};
                        if (status.currentUser === userId) {
                            startChat();
                            queueRef.off(); // Dinlemeyi durdur
                        }
                    });
            }
        });
    }

    // Mesajları dinleme fonksiyonu
    function listenForMessages(userId) {
        const chatRef = firebase.database().ref('chats/' + userId);
        chatRef.on('child_added', (snapshot) => {
            const message = snapshot.val();
            if (message.type !== 'user') { // Sadece karşı tarafın mesajlarını göster
                addMessage(message.message, message.type);
            }
        });
    }

    // Chat sonlandığında
    function endChat() {
        const userId = firebase.auth().currentUser.uid;
        
        // Durumu güncelle
        firebase.database().ref('supportStatus').update({
            busy: false,
            currentUser: null
        });
        
        // Sıradan sonraki kullanıcıyı al
        firebase.database().ref('queue').orderByChild('timestamp').limitToFirst(1).once('value')
            .then((snapshot) => {
                const nextInQueue = snapshot.val();
                if (nextInQueue) {
                    const nextUserId = Object.keys(nextInQueue)[0];
                    // Sıradan çıkar
                    firebase.database().ref('queue').child(nextUserId).remove();
                }
            });
    }

    updateQueueCount();

    // Admin paneli
    function showAdminPanel() {
        const adminPanel = document.createElement('div');
        adminPanel.className = 'admin-panel';
        adminPanel.innerHTML = `
            <h3>Yönetici Paneli</h3>
            <div class="admin-controls">
                <button id="viewUsers">Kullanıcıları Görüntüle</button>
                <button id="viewQueue">Sıradaki Kullanıcılar</button>
                <div id="userList" class="user-list"></div>
            </div>
        `;
        document.body.appendChild(adminPanel);

        // Admin kontrolleri
        document.getElementById('viewUsers').addEventListener('click', showUserList);
        document.getElementById('viewQueue').addEventListener('click', showQueueList);
    }

    // Kullanıcı listesi
    function showUserList() {
        const userList = document.getElementById('userList');
        firebase.database().ref('users').on('value', (snapshot) => {
            const users = snapshot.val();
            let html = '<h4>Kayıtlı Kullanıcılar</h4>';
            
            for (let uid in users) {
                const user = users[uid];
                html += `
                    <div class="user-item">
                        <span>${user.name} ${user.surname} (${user.email})</span>
                        <button onclick="banUser('${uid}')">Banla</button>
                        <button onclick="muteUser('${uid}')">Sustur</button>
                    </div>
                `;
            }
            userList.innerHTML = html;
        });
    }

    // Sıra yönetimi güncellemesi
    function updateQueue() {
        const queueRef = firebase.database().ref('queue');
        queueRef.orderByChild('timestamp').on('value', (snapshot) => {
            const queue = snapshot.val() || {};
            const onlineUsers = {};
            
            // Önce online kullanıcıları kontrol et
            Object.entries(queue).forEach(([userId, userData]) => {
                firebase.database().ref('status/' + userId).once('value')
                    .then((statusSnapshot) => {
                        if (statusSnapshot.val()?.online) {
                            onlineUsers[userId] = userData;
                        } else {
                            // Çevrimdışı kullanıcıyı sıradan çıkar
                            queueRef.child(userId).remove();
                        }
                    });
            });

            // Sıra bilgisini güncelle
            updateQueueDisplay(onlineUsers);
        });
    }

    // Admin için sıra yönetimi
    function showQueueList() {
        if (!isAdmin) return;

        const queueList = document.getElementById('userList');
        firebase.database().ref('queue').on('value', (snapshot) => {
            const queue = snapshot.val();
            let html = '<h4>Sıradaki Kullanıcılar</h4>';
            
            Object.entries(queue || {}).forEach(([userId, data]) => {
                html += `
                    <div class="queue-item">
                        <span>${data.userInfo.name} ${data.userInfo.surname}</span>
                        <span>${data.userInfo.email}</span>
                        <button onclick="removeFromQueue('${userId}')">Sıradan Çıkar</button>
                    </div>
                `;
            });
            queueList.innerHTML = html;
        });
    }

    // Admin fonksiyonları
    window.banUser = function(uid) {
        if (!isAdmin) return;
        firebase.database().ref('bannedUsers/' + uid).set(true);
        firebase.database().ref('queue/' + uid).remove();
    };

    window.muteUser = function(uid) {
        if (!isAdmin) return;
        firebase.database().ref('mutedUsers/' + uid).set(true);
    };

    window.removeFromQueue = function(uid) {
        if (!isAdmin) return;
        firebase.database().ref('queue/' + uid).remove();
    };

    // Sıraya girme işlemi güncellemesi
    function addToQueue(userId) {
        const queueRef = firebase.database().ref('queue');
        
        // Önce mevcut durumu kontrol et
        firebase.database().ref('supportStatus').once('value')
            .then((snapshot) => {
                const status = snapshot.val() || {};
                
                if (!status.busy) {
                    // Müşteri hizmetleri müsaitse direkt bağlan
                    startChat();
                    // Meşgul durumunu güncelle
                    firebase.database().ref('supportStatus').update({
                        busy: true,
                        currentUser: userId
                    });
                } else {
                    // Sıraya ekle
                    queueRef.child(userId).set({
                        name: currentUserName,
                        email: firebase.auth().currentUser.email,
                        timestamp: Date.now()
                    });

                    isInQueue = true;
                    connectSupport.textContent = 'Sıradasınız...';
                    connectSupport.disabled = true;
                    
                    // Sıra durumunu dinle
                    listenForQueue(userId);
                }
            });
    }
});

// Müşteri hizmetleri için yeni fonksiyonlar
function initializeCustomerSupport() {
    const chatContainer = document.querySelector('.chat-container');
    const userInfoPanel = document.createElement('div');
    userInfoPanel.className = 'user-info-panel';
    
    // Kullanıcı bilgileri paneli
    function updateUserInfoPanel() {
        userInfoPanel.innerHTML = `
            <div class="user-details">
                <div class="user-avatar">${userInfo.name[0]}${userInfo.surname[0]}</div>
                <div class="user-info">
                    <h4>${userInfo.name} ${userInfo.surname}</h4>
                    <p>${userInfo.email}</p>
                    <span class="connection-status ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </span>
                </div>
            </div>
            ${isAdmin ? `
                <div class="admin-controls">
                    <button onclick="showQueueManagement()">Sıra Yönetimi</button>
                    <button onclick="showUserManagement()">Kullanıcı Yönetimi</button>
                    <button onclick="showChatHistory()">Sohbet Geçmişi</button>
                </div>
            ` : ''}
        `;
    }

    // İnternet bağlantısı kontrolü
    function checkConnection() {
        const updateOnlineStatus = () => {
            isOnline = navigator.onLine;
            updateUserInfoPanel();
            
            if (!isOnline && isInQueue) {
                removeFromQueue(firebase.auth().currentUser.uid);
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    }

    // Sıra yönetimi geliştirmeleri
    function initializeQueueSystem() {
        const queueRef = firebase.database().ref('queue');
        
        // LocalStorage'dan sıra pozisyonunu kontrol et
        const savedQueuePosition = localStorage.getItem('queuePosition');
        if (savedQueuePosition) {
            const position = JSON.parse(savedQueuePosition);
            if (position.timestamp > Date.now() - 3600000) { // 1 saat geçerli
                addToQueue(position.userId, position.timestamp);
            } else {
                localStorage.removeItem('queuePosition');
            }
        }

        // Sıra değişikliklerini dinle
        queueRef.on('value', (snapshot) => {
            const queue = snapshot.val() || {};
            const onlineUsers = Object.entries(queue).filter(([_, data]) => {
                return data.online === true;
            });
            
            onlineUsersCount.textContent = onlineUsers.length;
            
            // Sıra pozisyonunu güncelle
            if (isInQueue) {
                const position = onlineUsers.findIndex(([key]) => key === firebase.auth().currentUser.uid) + 1;
                updateQueuePosition(position);
            }
        });
    }

    // Admin fonksiyonları
    if (isAdmin) {
        function showQueueManagement() {
            const modal = document.createElement('div');
            modal.className = 'admin-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Sıra Yönetimi</h3>
                    <div class="queue-list"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // Sıradaki kullanıcıları listele
            updateQueueList();
        }

        function showUserManagement() {
            // Kullanıcı yönetimi modalı
            const modal = document.createElement('div');
            modal.className = 'admin-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Kullanıcı Yönetimi</h3>
                    <div class="user-list"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // Kullanıcıları listele
            updateUserList();
        }

        // Admin işlemleri
        function banUser(uid) {
            firebase.database().ref(`bannedUsers/${uid}`).set(true);
            removeFromQueue(uid);
            alert('Kullanıcı engellendi.');
        }

        function muteUser(uid) {
            firebase.database().ref(`mutedUsers/${uid}`).set(true);
            alert('Kullanıcı susturuldu.');
        }
    }

    // Initialize
    updateUserInfoPanel();
    checkConnection();
    initializeQueueSystem();
    chatContainer.insertBefore(userInfoPanel, chatContainer.firstChild);
}

// Kullanıcı listesi ve sıra yönetimi için fonksiyonlar
function initializeUserManagement() {
    const chatContainer = document.querySelector('.chat-container');
    const userListDiv = document.createElement('div');
    userListDiv.className = 'user-list-container';
    
    // Kullanıcı listesini güncelle
    function updateUserList() {
        firebase.database().ref('users').on('value', (snapshot) => {
            const users = snapshot.val() || {};
            userListDiv.innerHTML = `
                <div class="user-list-header">
                    <h3>Aktif Kullanıcılar</h3>
                    ${isAdmin ? '<button onclick="toggleUserManagement()">Yönet</button>' : ''}
                </div>
                <div class="user-list">
                    ${Object.entries(users).map(([uid, user]) => `
                        <div class="user-item ${user.online ? 'online' : 'offline'}">
                            <div class="user-info">
                                <span class="user-name">${user.name} ${user.surname}</span>
                                <span class="user-email">${user.email}</span>
                                <span class="user-status">${user.online ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
                            </div>
                            ${isAdmin && user.email !== 'cepyseo@outlook.com' ? `
                                <div class="user-actions">
                                    <button onclick="banUser('${uid}')" class="ban-btn">Engelle</button>
                                    <button onclick="muteUser('${uid}')" class="mute-btn">Sustur</button>
                                    <button onclick="removeFromQueue('${uid}')" class="remove-btn">Sıradan Çıkar</button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        });
    }

    // Sıra yönetimi
    function initializeQueue() {
        const queueDiv = document.createElement('div');
        queueDiv.className = 'queue-container';
        
        firebase.database().ref('queue').on('value', (snapshot) => {
            const queue = snapshot.val() || {};
            const onlineUsers = Object.entries(queue).filter(([_, data]) => data.online);
            
            queueDiv.innerHTML = `
                <div class="queue-header">
                    <h3>Sıradaki Kullanıcılar (${onlineUsers.length})</h3>
                </div>
                <div class="queue-list">
                    ${onlineUsers.map(([uid, data], index) => `
                        <div class="queue-item">
                            <span class="queue-position">#${index + 1}</span>
                            <div class="queue-user-info">
                                <span class="user-name">${data.name}</span>
                                <span class="user-email">${data.email}</span>
                            </div>
                            ${isAdmin ? `
                                <button onclick="removeFromQueue('${uid}')" class="remove-btn">
                                    Sıradan Çıkar
                                </button>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        });

        return queueDiv;
    }

    // Admin kontrolleri
    if (firebase.auth().currentUser?.email === 'cepyseo@outlook.com') {
        isAdmin = true;
        const adminControls = document.createElement('div');
        adminControls.className = 'admin-controls';
        adminControls.innerHTML = `
            <button onclick="showQueueManagement()">Sıra Yönetimi</button>
            <button onclick="showUserManagement()">Kullanıcı Yönetimi</button>
        `;
        chatContainer.insertBefore(adminControls, chatContainer.firstChild);
    }

    // Kullanıcı listesi ve sırayı ekle
    chatContainer.insertBefore(userListDiv, chatContainer.firstChild);
    chatContainer.insertBefore(initializeQueue(), chatContainer.firstChild);

    // İlk yükleme
    updateUserList();
}

// Admin fonksiyonları
window.banUser = function(uid) {
    if (!isAdmin) return;
    
    firebase.database().ref(`bannedUsers/${uid}`).set(true)
        .then(() => {
            removeFromQueue(uid);
            alert('Kullanıcı engellendi.');
        })
        .catch(error => {
            console.error('Ban hatası:', error);
            alert('Kullanıcı engellenirken bir hata oluştu.');
        });
};

window.muteUser = function(uid) {
    if (!isAdmin) return;
    
    firebase.database().ref(`mutedUsers/${uid}`).set(true)
        .then(() => {
            alert('Kullanıcı susturuldu.');
        })
        .catch(error => {
            console.error('Mute hatası:', error);
            alert('Kullanıcı susturulurken bir hata oluştu.');
        });
};

window.removeFromQueue = function(uid) {
    if (!isAdmin) return;
    
    firebase.database().ref(`queue/${uid}`).remove()
        .then(() => {
            alert('Kullanıcı sıradan çıkarıldı.');
        })
        .catch(error => {
            console.error('Sıradan çıkarma hatası:', error);
            alert('Kullanıcı sıradan çıkarılırken bir hata oluştu.');
        });
};

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', () => {
    initializeUserManagement();
});

// Admin paneli ve kullanıcı yönetimi için fonksiyonlar
function initializeAdminPanel() {
    // Admin kontrolü
    firebase.auth().onAuthStateChanged((user) => {
        if (user && user.email === 'cepyseo@outlook.com') {
            isAdmin = true;
            const adminContainer = document.createElement('div');
            adminContainer.className = 'admin-container';
            adminContainer.innerHTML = `
                <div class="admin-panel">
                    <h3>Admin Paneli</h3>
                    <div class="admin-buttons">
                        <button onclick="toggleUserList()">Kullanıcıları Görüntüle</button>
                        <button onclick="toggleQueueList()">Sıra Yönetimi</button>
                    </div>
                    <div id="adminContent" class="admin-content"></div>
                </div>
            `;
            document.querySelector('.dashboard-container').appendChild(adminContainer);
        }
    });
}

// Kullanıcı listesi görüntüleme
window.toggleUserList = function() {
    const adminContent = document.getElementById('adminContent');
    
    firebase.database().ref('users').once('value')
        .then((snapshot) => {
            const users = snapshot.val() || {};
            let html = `
                <div class="user-management">
                    <h4>Kullanıcı Listesi</h4>
                    <div class="user-list">
            `;
            
            Object.entries(users).forEach(([uid, user]) => {
                html += `
                    <div class="user-item">
                        <div class="user-info">
                            <span class="user-name">${user.name} ${user.surname}</span>
                            <span class="user-email">${user.email}</span>
                        </div>
                        <div class="user-actions">
                            <button onclick="banUser('${uid}')" class="ban-btn">Engelle</button>
                            <button onclick="muteUser('${uid}')" class="mute-btn">Sustur</button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
            adminContent.innerHTML = html;
        });
};

// Sıra yönetimi görüntüleme
window.toggleQueueList = function() {
    const adminContent = document.getElementById('adminContent');
    
    firebase.database().ref('queue').once('value')
        .then((snapshot) => {
            const queue = snapshot.val() || {};
            let html = `
                <div class="queue-management">
                    <h4>Sıradaki Kullanıcılar</h4>
                    <div class="queue-list">
            `;
            
            Object.entries(queue).forEach(([uid, queueData]) => {
                html += `
                    <div class="queue-item">
                        <div class="queue-info">
                            <span class="user-name">${queueData.name}</span>
                            <span class="user-email">${queueData.email}</span>
                            <span class="queue-time">Bekleme: ${formatWaitingTime(Date.now() - queueData.timestamp)}</span>
                        </div>
                        <div class="queue-actions">
                            <button onclick="removeFromQueue('${uid}')" class="remove-btn">Sıradan Çıkar</button>
                        </div>
                    </div>
                `;
            });
            
            html += `</div></div>`;
            adminContent.innerHTML = html;
        });
};

// Bekleme süresini formatla
function formatWaitingTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}dk ${seconds}sn`;
}

// Sayfa yüklendiğinde admin panelini başlat
document.addEventListener('DOMContentLoaded', () => {
    initializeAdminPanel();
}); 