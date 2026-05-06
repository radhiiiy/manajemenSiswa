const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');

const app = express();

// Konfigurasi EJS sebagai Templating Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mengatur folder 'public' untuk file statis (seperti CSS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Konfigurasi Session
app.use(session({
    secret: 'kunci-rahasia-sistem',
    resave: false,
    saveUninitialized: true
}));

// Koneksi Database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_manajemen_tugas'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Database MySQL Terhubung!');
});

// ================= ROUTING HALAMAN ================= //

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    const pesan = req.query.pesan || '';
    res.render('login-guru', { pesan });
});

// Proses Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM guru WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.loggedin = true;
            req.session.nama_lengkap = results[0].nama_lengkap;
            req.session.role = results[0].role;
            
            if (results[0].role === 'operator') {
                res.redirect('/dashboard-operator');
            } else {
                res.redirect('/dashboard-guru'); // Opsional jika kamu buat nanti
            }
        } else {
            res.redirect('/login?pesan=gagal');
        }
    });
});

// Middleware Proteksi Akses Khusus Operator
const cekOperator = (req, res, next) => {
    if (!req.session.loggedin || req.session.role !== 'operator') {
        return res.redirect('/login?pesan=belum_login');
    }
    next();
};

// Routing Dashboard Operator (Dilindungi Middleware)
app.get('/dashboard-operator', cekOperator, (req, res) => {
    res.render('dashboard-operator', { 
        nama_lengkap: req.session.nama_lengkap,
        halaman_aktif: 'beranda' 
    });
});

// Routing Manajemen User (Dilindungi Middleware)
app.get('/manajemen-user', cekOperator, (req, res) => {
    res.render('manajemen-user', { 
        nama_lengkap: req.session.nama_lengkap,
        halaman_aktif: 'manajemen-user'
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});