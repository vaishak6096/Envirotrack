/**
 * EnviroTrack Dashboard Controller Logic
 * 
 * Shared across all sub-pages for:
 * - Session guards to prevent unauthorized access.
 * - Loading and rendering authenticated user info securely.
 * - Sign Out click handling.
 */

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyCG7-Cirt9lmhyriI1IGeYA2_OcaFeGl_g",
    authDomain: "envirotrack2026.firebaseapp.com",
    projectId: "envirotrack2026",
    storageBucket: "envirotrack2026.firebasestorage.app",
    messagingSenderId: "19464034276",
    appId: "1:19464034276:web:131063f465b7dbcca019f1",
    measurementId: "G-MW1D7Q2KSV"
};

// Check if Firebase configuration is still set to placeholder values
const isMockMode = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_");

let auth = null;

// Initialize Firebase if not in Mock Mode
if (!isMockMode) {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
    } catch (err) {
        console.error("Failed to initialize Firebase in Sub-Page:", err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Session Guard Check
    const cachedUser = localStorage.getItem('envirotrack_user');
    if (!cachedUser) {
        // No session found, bounce to login page immediately
        window.location.href = 'index.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(cachedUser);
    } catch (e) {
        localStorage.removeItem('envirotrack_user');
        window.location.href = 'index.html';
        return;
    }

    // 2. Populate User Profile Details (with null checks for sub-page safety)
    const profilePic = document.getElementById('profilePic');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const welcomeUser = document.getElementById('welcomeUser');
    const logoutBtn = document.getElementById('logoutBtn');

    if (profilePic) {
        profilePic.src = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`;
    }
    if (profileName) {
        profileName.textContent = user.name || 'EnviroTrack User';
    }
    if (profileEmail) {
        profileEmail.textContent = user.email || 'No email provided';
    }
    if (welcomeUser) {
        // First name extract for greeting banner
        const firstName = (user.name || 'Explorer').split(' ')[0];
        welcomeUser.textContent = firstName;
    }

    // 3. Logout Event Handler (with null checks)
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            // Clear local credentials
            localStorage.removeItem('envirotrack_user');
            
            // Log out from live Firebase if active
            if (!isMockMode && auth) {
                try {
                    await auth.signOut();
                } catch (err) {
                    console.error("Firebase Auth Sign Out failed:", err);
                }
            }
            
            // Redirect to Login Page
            window.location.href = 'index.html';
        });
    }
});
