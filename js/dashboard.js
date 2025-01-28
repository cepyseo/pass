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
    if (buyButton) {
        buyButton.addEventListener('click', () => {
            alert('Ödeme sistemi yakında eklenecek!');
        });
    }
}); 