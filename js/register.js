import { auth, createUserWithEmailAndPassword } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Kayıt formu işlemleri
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            try {
                await createUserWithEmailAndPassword(auth, email, password);
                alert('Kayıt başarılı! Giriş yapabilirsiniz.');
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