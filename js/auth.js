// Form geçişleri için
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

// Form geçiş fonksiyonları
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
});

// Giriş işlemi
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'dashboard.html';
    } catch (error) {
        alert('Giriş hatası: ' + error.message);
    }
});

// Kayıt işlemi
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert('Kayıt başarılı! Giriş yapabilirsiniz.');
        // Kayıt başarılı olduğunda giriş formunu göster
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    } catch (error) {
        alert('Kayıt hatası: ' + error.message);
    }
});

// Auth durumunu kontrol et
auth.onAuthStateChanged((user) => {
    if (user) {
        window.location.href = 'dashboard.html';
    }
}); 