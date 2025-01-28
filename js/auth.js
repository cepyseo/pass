// Giriş işlemi
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            if (userCredential.user) {
                console.log("Giriş başarılı, yönlendiriliyor...");
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.error("Giriş hatası:", error);
            let errorMessage = '';
            
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Geçersiz email adresi.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Bu hesap devre dışı bırakılmış.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'Bu email adresi ile kayıtlı kullanıcı bulunamadı.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Yanlış şifre.';
                    break;
                case 'auth/invalid-login-credentials':
                    errorMessage = 'Email veya şifre hatalı.';
                    break;
                default:
                    errorMessage = 'Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.';
            }
            
            // Hata mesajını göster
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.color = '#ff4444';
            errorDiv.style.marginTop = '10px';
            errorDiv.style.textAlign = 'center';
            errorDiv.textContent = errorMessage;

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
        }
    });
}

// Auth durumunu kontrol et
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        window.location.href = 'dashboard.html';
    }
}); 