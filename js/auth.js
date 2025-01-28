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
            alert('Giriş hatası: ' + error.message);
        }
    });
}

// Auth durumunu kontrol et
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        window.location.href = 'dashboard.html';
    }
}); 