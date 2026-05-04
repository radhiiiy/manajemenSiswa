const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');

const app = express();

// Middleware untuk memproses data dari form HTML
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Mengatur folder saat ini sebagai tempat file statis (HTML, CSS, JS)
app.use(express.static(__dirname));

// Konfigurasi Session
app.use(session({
    secret: 'kunci-rahasia-sistem',
    resave: false,
    saveUninitialized: true
}));

// Koneksi ke Database MySQL (Pastikan MySQL di XAMPP menyala)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_manajemen_tugas'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Berhasil terhubung ke database MySQL');
});

// Endpoint Proses Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.query('SELECT * FROM guru WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            const user = results[0];
            // Simpan data ke session
            req.session.loggedin = true;
            req.session.username = user.username;
            req.session.nama_lengkap = user.nama_lengkap;
            req.session.role = user.role;

            // Arahkan sesuai hak akses
            if (user.role === 'operator') {
                res.redirect('/dashboard-operator.html');
            } else {
                res.redirect('/dashboard-guru.html');
            }
        } else {
            res.redirect('/login-guru.html?pesan=gagal');
        }
    });
});

// Endpoint untuk mengecek sesi (Digunakan oleh frontend HTML)
app.get('/api/session', (req, res) => {
    if (req.session.loggedin) {
        res.json({ 
            loggedin: true, 
            nama_lengkap: req.session.nama_lengkap, 
            role: req.session.role 
        });
    } else {
        res.json({ loggedin: false });
    }
});

// Endpoint Logout
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/index.html');
});

// Jalankan Server
app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});