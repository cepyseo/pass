// Auth durumunu kontrol et
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'index.html';
    }
});

// Çıkış yapma işlemi
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        alert('Çıkış hatası: ' + error.message);
    }
});

// Satın alma butonu işlemi
const buyButton = document.querySelector('.buy-button');
buyButton.addEventListener('click', () => {
    alert('Ödeme sistemi yakında eklenecek!');
}); 