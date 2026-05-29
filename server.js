const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create oauth users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            firebase_uid TEXT UNIQUE NOT NULL,
            photo_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error("Error creating users table:", err.message);
            } else {
                console.log("Users table verified.");
            }
        });
    }
});

// Initialize Firebase Admin (optional setup, handles safe fallback if key file is missing)
let firebaseAdminActive = false;
let admin = null;

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || './firebase-service-account.json';
if (fs.existsSync(serviceAccountPath)) {
    try {
        admin = require('firebase-admin');
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        firebaseAdminActive = true;
        console.log("Firebase Admin SDK successfully initialized.");
    } catch (err) {
        console.error("Failed to initialize Firebase Admin SDK:", err.message);
        console.log("Proceeding in development mode with Mock Auth verification.");
    }
} else {
    console.log("No firebase-service-account.json found. Proceeding with Mock Auth fallback.");
}

/**
 * OAuth Login & Registration API
 * 
 * Verifies ID Token (either via live Firebase Admin SDK or simulated mock decoding)
 * Saves or updates user profiles in the local SQLite database.
 */
app.post('/api/auth/oauth', async (req, res) => {
    const { idToken, isMock } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: 'Auth ID token is required.' });
    }

    let uid, email, name, photoURL;

    // 1. Resolve Auth Credentials (either Mock, Insecure JWT Decode, or Firebase Admin)
    if (isMock) {
        // Mock Token Format: mock_firebase_id_token_<base64_encoded_user_object>
        try {
            if (idToken.startsWith('mock_firebase_id_token_')) {
                const base64Data = idToken.replace('mock_firebase_id_token_', '');
                const decodedJson = Buffer.from(base64Data, 'base64').toString('utf-8');
                const mockUser = JSON.parse(decodedJson);
                
                email = mockUser.email;
                name = mockUser.name;
                photoURL = mockUser.photoURL;
                uid = 'mock_uid_' + email.replace(/[^a-zA-Z0-9]/g, '');
            } else {
                throw new Error("Invalid mock token format");
            }
        } catch (e) {
            console.error("Mock token decode failure:", e.message);
            return res.status(401).json({ error: 'Invalid mock credentials supplied.' });
        }
    } else if (!firebaseAdminActive) {
        // Real token received, but Firebase Admin SDK is not initialized.
        // For developer convenience, decode JWT payload insecurely for local testing.
        try {
            const parts = idToken.split('.');
            if (parts.length === 3) {
                // Base64URL decoding payload part of JWT
                const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const decodedJson = Buffer.from(base64Payload, 'base64').toString('utf-8');
                const payload = JSON.parse(decodedJson);

                uid = payload.sub || payload.user_id;
                email = payload.email;
                name = payload.name || '';
                photoURL = payload.picture || '';
                
                console.warn("⚠️  [SECURITY WARNING]: Received real Firebase ID token, but firebase-service-account.json is missing.");
                console.warn("   Insecurely decoding token payload without verifying signature for development testing.");
                console.warn(`   Authenticated User: ${email}`);
            } else {
                throw new Error("Invalid JWT token format");
            }
        } catch (e) {
            console.error("Insecure JWT decode failure:", e.message);
            return res.status(401).json({ error: 'Failed to decode auth credentials.' });
        }
    } else {
        // Live Secure Firebase Token Verification
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            uid = decodedToken.uid;
            email = decodedToken.email;
            name = decodedToken.name || '';
            photoURL = decodedToken.picture || '';
        } catch (error) {
            console.error("Firebase ID Token verification failed:", error.message);
            return res.status(401).json({ error: 'Authentication failed: Invalid token.' });
        }
    }

    if (!email || !uid) {
        return res.status(400).json({ error: 'Incomplete user profile from OAuth provider.' });
    }

    // 2. Save/Update User Profile in SQLite Database
    // Check if user already exists
    const findSql = 'SELECT * FROM users WHERE email = ?';
    db.get(findSql, [email], (err, user) => {
        if (err) {
            console.error("Database lookup error:", err.message);
            return res.status(500).json({ error: 'Database verification error.' });
        }

        if (user) {
            // User exists, update details (in case name or profile pic changed)
            const updateSql = 'UPDATE users SET name = ?, photo_url = ?, firebase_uid = ? WHERE email = ?';
            db.run(updateSql, [name, photoURL, uid, email], function(err) {
                if (err) {
                    console.error("Database update error:", err.message);
                }
                const updatedUser = { email, name, photoURL, uid };
                console.log(`User Logged In (Updated): ${email}`);
                return res.status(200).json({ message: 'Login successful!', user: updatedUser });
            });
        } else {
            // User does not exist, insert as registration
            const insertSql = 'INSERT INTO users (email, name, firebase_uid, photo_url) VALUES (?, ?, ?, ?)';
            db.run(insertSql, [email, name, uid, photoURL], function(err) {
                if (err) {
                    console.error("Database registration error:", err.message);
                    return res.status(500).json({ error: 'Failed to record registration.' });
                }
                const newUser = { email, name, photoURL, uid };
                console.log(`New User Registered: ${email}`);
                return res.status(201).json({ message: 'Registration successful!', user: newUser });
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
