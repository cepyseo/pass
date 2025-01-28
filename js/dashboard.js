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
        
        // Hoşgeldin mesajını ekle
        addMessage("Merhaba! Size nasıl yardımcı olabilirim?", 'support');
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
            userRef.once('value').then((snapshot) => {
                const userData = snapshot.val();
                currentUserName = `${userData.name} ${userData.surname}`;
            });
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
        if (!isInQueue) {
            const queueRef = firebase.database().ref('queue');
            const userId = firebase.auth().currentUser.uid;
            
            queueRef.child(userId).set({
                name: currentUserName,
                email: firebase.auth().currentUser.email,
                timestamp: Date.now()
            });

            isInQueue = true;
            connectSupport.textContent = 'Sıradasınız...';
            connectSupport.disabled = true;
        }
    });

    // Chat işlemleri
    function startChat() {
        queueMessage.style.display = 'none';
        chatInput.disabled = false;
        sendMessage.disabled = false;
        
        // Hoşgeldin mesajını ekle
        addMessage("Merhaba! Size nasıl yardımcı olabilirim?", 'support');
    }

    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (message) {
            const now = new Date();
            const userId = firebase.auth().currentUser.uid;
            
            // Mesajı veritabanına kaydet
            firebase.database().ref('chats/' + userId).push({
                message: message,
                timestamp: now.getTime(),
                type: 'user',
                userName: currentUserName,
                userEmail: firebase.auth().currentUser.email
            });

            addMessage(message, 'user');
            chatInput.value = '';
        }
    }

    // Admin kontrolü
    function checkIfAdmin() {
        const user = firebase.auth().currentUser;
        return user.email === 'cepyseo@outlook.com';
    }

    // Chat sonuçlandırma (sadece admin için)
    function endChat(userId, status) {
        if (checkIfAdmin()) {
            const resultRef = firebase.database().ref('chatResults');
            const userChatsRef = firebase.database().ref('chats/' + userId);
            
            userChatsRef.once('value').then((snapshot) => {
                const chatData = snapshot.val();
                resultRef.push({
                    userId: userId,
                    userEmail: chatData.userEmail,
                    userName: chatData.userName,
                    status: status,
                    timestamp: Date.now()
                });
            });
        }
    }

    updateQueueCount();
}); 