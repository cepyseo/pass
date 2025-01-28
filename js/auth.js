// Giriş işlemi
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Form verilerini al
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        // Hata mesajı gösterme fonksiyonu
        const showError = (message) => {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = message;

            // Varsa eski hata mesajını kaldır
            const oldError = loginForm.querySelector('.error-message');
            if (oldError) {
                oldError.remove();
            }

            // Yeni hata mesajını ekle
            loginForm.appendChild(errorDiv);

            // Input alanlarını vurgula
            const emailInput = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');
            emailInput.classList.add('error');
            passwordInput.classList.add('error');

            // 5 saniye sonra hata mesajını ve vurguları kaldır
            setTimeout(() => {
                errorDiv.remove();
                emailInput.classList.remove('error');
                passwordInput.classList.remove('error');
            }, 5000);
        };

        // Basit validasyon
        if (!email || !password) {
            showError('Email ve şifre alanları boş bırakılamaz.');
            return;
        }

        // Email formatı kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showError('Geçerli bir email adresi giriniz.');
            return;
        }

        try {
            // Firebase ile giriş denemesi
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            if (userCredential.user) {
                console.log("Giriş başarılı!");
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.error("Giriş hatası:", error);
            
            // Hata mesajlarını Türkçeleştir
            let errorMessage;
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Geçersiz email formatı.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Bu hesap devre dışı bırakılmış.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Bu email ile kayıtlı kullanıcı bulunamadı.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Hatalı şifre.';
                    break;
                case 'auth/invalid-login-credentials':
                    errorMessage = 'Email veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.';
                    break;
                default:
                    errorMessage = 'Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.';
            }
            showError(errorMessage);
        }
    });
}

// Auth durumunu kontrol et
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        window.location.href = 'dashboard.html';
    }
}); 