const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');

const app = express();

// Konfigurasi EJS & Statis
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Konfigurasi Session
app.use(session({
    secret: 'rahasia-sistem-tugas',
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
    console.log('MySQL Connected...');
});

// Middleware Proteksi
const cekSession = (req, res, next) => {
    if (!req.session.loggedin) return res.redirect('/?pesan=belum_login');
    next();
};

// ================= ROUTING ================= //

app.get('/', (req, res) => {
    res.render('login', { pesan: req.query.pesan || '' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Cek Guru/Operator
    db.query('SELECT * FROM guru WHERE username = ? AND password = ?', [username, password], (err, resG) => {
        if (resG.length > 0) {
            req.session.loggedin = true;
            req.session.nama_lengkap = resG[0].nama_lengkap;
            req.session.role = resG[0].role;
            return res.redirect(resG[0].role === 'operator' ? '/dashboard-operator' : '/dashboard-guru');
        }
        // Cek Siswa (Username = NISN)
        db.query('SELECT * FROM murid WHERE nisn = ? AND password = ?', [username, password], (err, resM) => {
            if (resM.length > 0) {
                req.session.loggedin = true;
                req.session.nama_lengkap = resM[0].nama_lengkap;
                req.session.role = 'siswa';
                return res.redirect('/dashboard-siswa');
            }
            res.redirect('/?pesan=gagal');
        });
    });
});

app.get('/dashboard-operator', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.redirect('/');
    db.query('SELECT COUNT(*) AS g FROM guru WHERE role="guru"', (e, rG) => {
        db.query('SELECT COUNT(*) AS s FROM murid', (e, rS) => {
            db.query('SELECT COUNT(*) AS k FROM kelas', (e, rK) => {
                db.query('SELECT COUNT(*) AS t FROM tugas', (e, rT) => {
                    res.render('dashboard-operator', {
                        nama_lengkap: req.session.nama_lengkap,
                        stats: { guru: rG[0].g, siswa: rS[0].s, kelas: rK[0].k, tugas: rT[0].t }
                    });
                });
            });
        });
    });
});

app.get('/dashboard-siswa', cekSession, (req, res) => {
    if (req.session.role !== 'siswa') return res.redirect('/');
    const namaSiswa = req.session.nama_lengkap;
    db.query('SELECT id_kelas FROM murid WHERE nama_lengkap = ?', [namaSiswa], (err, resMurid) => {
        const idKelas = resMurid[0].id_kelas;
        db.query('SELECT COUNT(*) AS total FROM tugas WHERE id_kelas = ?', [idKelas], (err, resTotal) => {
            res.render('dashboard-siswa', {
                nama_lengkap: namaSiswa,
                halaman_aktif: 'beranda',
                stats: { total: resTotal[0].total, belum: 0, selesai: resTotal[0].total }
            });
        });
    });
});

app.get('/daftar-tugas', (req, res) => {
    if (!req.session.loggedin || req.session.role !== 'siswa') {
        return res.redirect('/');
    }

    const namaSiswa = req.session.nama_lengkap;

    // Perhatikan: sekarang menggunakan t.judul_tugas (sesuai database kamu)
    const sql = `
        SELECT 
            t.id_tugas AS id, 
            t.judul_tugas AS mapel, 
            g.nama_lengkap AS guru,
            'belum' AS status 
        FROM tugas t
        JOIN guru g ON t.id_guru = g.id_guru
        JOIN murid m ON m.id_kelas = t.id_kelas
        WHERE m.nama_lengkap = ?
    `;

    db.query(sql, [namaSiswa], (err, results) => {
        if (err) {
            console.error("Error Detail:", err.message);
            return res.send("Terjadi kesalahan SQL: " + err.message);
        }

        res.render('daftar-tugas', {
            nama_lengkap: namaSiswa,
            tugas: results 
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(3000, () => console.log('Server running: http://localhost:3000'));