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
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Kullanıcı bilgilerini kaydet
                await firebase.database().ref('users/' + user.uid).set({
                    name: name,
                    surname: surname,
                    email: email
                });

                // Email doğrulama gönder
                await user.sendEmailVerification();
                
                alert('Kayıt başarılı! Lütfen email adresinizi doğrulayın.');
                window.location.href = 'index.html';
            } catch (error) {
                alert('Kayıt hatası: ' + error.message);
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