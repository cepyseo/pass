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
        messageDiv.textContent = text;
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
            addMessage(message, 'user');
            chatInput.value = '';
            
            // Mesajı veritabanına kaydet
            firebase.database().ref('chats').push({
                message: message,
                timestamp: Date.now(),
                type: 'user'
            });
        }
    }
}); 