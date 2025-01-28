import { auth, signOut } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
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
        logoutBtn.addEventListener('click', async () => {
            try {
                await firebase.auth().signOut();
                window.location.href = 'index.html';
            } catch (error) {
                alert('Çıkış hatası: ' + error.message);
            }
        });
    }

    // Satın alma butonu işlemi
    const buyButton = document.querySelector('.buy-button');
    if (buyButton) {
        buyButton.addEventListener('click', () => {
            alert('Ödeme sistemi yakında eklenecek!');
        });
    }
}); 