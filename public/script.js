/**
 * EnviroTrack Frontend Authentication Logic
 * 
 * Configured with:
 * - Firebase Authentication with Google Sign-in.
 * - Dynamic Mock Development Mode (auto-enabled if config is placeholder).
 * - Redirection to dashboard.html on successful login.
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
        console.log("Firebase Auth initialized successfully.");
    } catch (err) {
        console.error("Failed to initialize Firebase:", err);
        alert("Firebase initialization failed. Falling back to Mock Development Mode.");
    }
} else {
    console.warn("Firebase config is empty. EnviroTrack is running in [MOCK DEVELOPMENT MODE].");
}

document.addEventListener('DOMContentLoaded', () => {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const authError = document.getElementById('authError');
    const oauthContainer = document.querySelector('.oauth-container');

    // Check localStorage for existing session
    const cachedUser = localStorage.getItem('envirotrack_user');
    if (cachedUser) {
        // Already authenticated, redirect to dashboard
        window.location.href = 'dashboard.html';
        return;
    }

    function showError(message) {
        authError.textContent = message;
        authError.classList.add('error', 'visible');
    }

    function clearError() {
        authError.classList.remove('error', 'visible');
        setTimeout(() => {
            if (!authError.classList.contains('visible')) {
                authError.textContent = '';
            }
        }, 300);
    }

    // Google Sign-In Event Handler
    googleLoginBtn.addEventListener('click', async () => {
        clearError();
        
        // Button loading state
        googleLoginBtn.style.opacity = '0.7';
        googleLoginBtn.style.cursor = 'not-allowed';
        const buttonSpan = googleLoginBtn.querySelector('span');
        const originalText = buttonSpan.textContent;
        buttonSpan.textContent = 'Connecting...';

        if (isMockMode) {
            // --- MOCK DEVELOPMENT OAUTH POPUP ---
            const width = 450;
            const height = 600;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            
            const popup = window.open(
                'oauth-mock.html',
                'Google OAuth Sign-In Simulation',
                `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
            );

            // Set up a listener for the message callback
            const handleMockMessage = async (event) => {
                if (event.origin !== window.location.origin) return;
                
                if (event.data && event.data.type === 'MOCK_OAUTH_SUCCESS') {
                    window.removeEventListener('message', handleMockMessage);
                    
                    try {
                        const response = await verifyTokenWithBackend(event.data.idToken, true);
                        if (response.ok) {
                            const data = await response.json();
                            localStorage.setItem('envirotrack_user', JSON.stringify(data.user));
                            window.location.href = 'dashboard.html';
                        } else {
                            const errData = await response.json();
                            showError(errData.error || 'Server validation failed');
                        }
                    } catch (err) {
                        showError('Network validation error. Is backend server running?');
                    } finally {
                        resetButtonState();
                    }
                }
            };

            window.addEventListener('message', handleMockMessage);

            // Check if popup is closed manually
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    setTimeout(() => {
                        window.removeEventListener('message', handleMockMessage);
                        if (!localStorage.getItem('envirotrack_user') && !authError.textContent) {
                            showError('Authentication cancelled by user.');
                            resetButtonState();
                        }
                    }, 500);
                }
            }, 500);

        } else {
            // --- LIVE FIREBASE AUTHENTICATION ---
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await auth.signInWithPopup(provider);
                const idToken = await result.user.getIdToken();
                
                const response = await verifyTokenWithBackend(idToken, false);
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('envirotrack_user', JSON.stringify(data.user));
                    window.location.href = 'dashboard.html';
                } else {
                    const errData = await response.json();
                    showError(errData.error || 'Registration failed');
                }
            } catch (error) {
                console.error("Firebase Login Error:", error);
                if (error.code === 'auth/popup-closed-by-user') {
                    showError('Sign in window was closed before completion.');
                } else {
                    showError(error.message || 'Firebase authentication failed.');
                }
            } finally {
                resetButtonState();
            }
        }

        function resetButtonState() {
            googleLoginBtn.style.opacity = '1';
            googleLoginBtn.style.cursor = 'pointer';
            buttonSpan.textContent = originalText;
        }
    });

    // Backend verification endpoint caller
    async function verifyTokenWithBackend(idToken, isMock) {
        return fetch('/api/auth/oauth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ idToken, isMock })
        });
    }
});
