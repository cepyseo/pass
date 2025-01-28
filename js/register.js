import { auth, createUserWithEmailAndPassword } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Kayıt formu işlemleri
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const surname = document.getElementById('registerSurname').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            try {
                // Kullanıcıyı oluştur
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // Kullanıcı bilgilerini kaydet
                await saveUserInfo(user, name, surname);

                // Email doğrulama gönder
                await user.sendEmailVerification();
                
                showNotification('Kayıt başarılı! Lütfen email adresinizi doğrulayın.', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } catch (error) {
                console.error('Kayıt hatası:', error);
                showNotification('Kayıt işlemi başarısız: ' + error.message, 'error');
            }
        });
    }

    // Eğer kullanıcı zaten giriş yapmışsa dashboard'a yönlendir
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });
});

// Kullanıcı kayıt fonksiyonunu güncelle
async function saveUserInfo(user, name, surname) {
    try {
        const userData = {
            uid: user.uid,
            name: name,
            surname: surname,
            email: user.email,
            isAdmin: user.email === 'cepyseo@outlook.com', // Admin kontrolü
            createdAt: Date.now(),
            lastSeen: Date.now()
        };

        await firebase.database().ref(`users/${user.uid}`).set(userData);
        return userData;
    } catch (error) {
        console.error('Kullanıcı bilgileri kaydedilemedi:', error);
        throw error;
    }
} 