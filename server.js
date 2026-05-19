const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const path = require('path');

const app = express();

// Konfigurasi EJS & Statis
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// ================= ROUTING UTAMA & LOGIN ================= //

app.get('/', (req, res) => {
    res.render('login', { pesan: req.query.pesan || '' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM guru WHERE username = ? AND password = ?', [username, password], (err, resG) => {
        if (resG.length > 0) {
            req.session.loggedin = true;
            req.session.id_guru = resG[0].id_guru;
            req.session.nama_lengkap = resG[0].nama_lengkap;
            req.session.role = resG[0].role;
            return res.redirect(resG[0].role === 'operator' ? '/dashboard-operator' : '/dashboard-guru');
        }
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

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ================= DASHBOARD OPERATOR ================= //

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

app.get('/manajemen-user', cekSession, (req, res) => {
    // Pastikan hanya operator yang bisa akses
    if (req.session.role !== 'operator') return res.redirect('/');

    // 1. Ambil data guru
    db.query('SELECT * FROM guru WHERE role = "guru"', (err, resGuru) => {
        if (err) throw err;

        // 2. Ambil data murid bergabung dengan nama kelasnya
        db.query(`
            SELECT murid.*, kelas.nama_kelas 
            FROM murid 
            LEFT JOIN kelas ON murid.id_kelas = kelas.id_kelas
        `, (err, resMurid) => {
            if (err) throw err;

            // 3. AMBIL DATA KELAS (Ini yang tadi kurang!)
            db.query('SELECT * FROM kelas', (err, resKelas) => {
                if (err) throw err;

                // Kirim SEMUA data ke EJS
                res.render('manajemen-user', {
                    nama_lengkap: req.session.nama_lengkap,
                    halaman_aktif: 'user',
                    data_guru: resGuru,
                    data_murid: resMurid,
                    data_kelas: resKelas // Variabel ini yang ditunggu oleh line 134 di EJS
                });
            });
        });
    });
});

app.post('/api/tambah-guru', cekSession, (req, res) => {
    const { id_guru, nama, mapel, email, username, password, id_kelas_wali, kelas_ajar } = req.body;
    const sqlGuru = "INSERT INTO guru (id_guru, nama_lengkap, mata_pelajaran, email, username, password, role) VALUES (?, ?, ?, ?, ?, ?, 'guru')";

    db.query(sqlGuru, [id_guru, nama, mapel, email, username, password], (err, result) => {
        if (err) return res.redirect('/manajemen-user?pesan=error');
        if (id_kelas_wali) {
            db.query("UPDATE kelas SET id_wali_guru = ? WHERE id_kelas = ?", [id_guru, id_kelas_wali]);
        }
        if (kelas_ajar) {
            const dataKelas = Array.isArray(kelas_ajar) ? kelas_ajar : [kelas_ajar];
            const values = dataKelas.map(idK => [id_guru, idK]);
            db.query("INSERT INTO guru_kelas (id_guru, id_kelas) VALUES ?", [values]);
        }
        res.redirect('/manajemen-user?pesan=berhasil');
    });
});

app.post('/api/tambah-murid', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.status(403).send('Akses dilarang');

    const { nisn, nama, id_kelas, email, password } = req.body;

    const sql = "INSERT INTO murid (nisn, nama_lengkap, id_kelas, email, password) VALUES (?, ?, ?, ?, ?)";

    db.query(sql, [nisn, nama, id_kelas, email, password], (err, result) => {
        if (err) {
            console.error(err);
            return res.redirect('/manajemen-user?pesan=error_nisn_duplikat');
        }
        res.redirect('/manajemen-user?pesan=berhasil_tambah_murid');
    });
});

app.get('/manajemen-kelas', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.redirect('/');

    const sqlKelas = `
        SELECT k.id_kelas, k.nama_kelas, g.nama_lengkap AS wali_kelas, COUNT(m.nisn) AS jumlah_murid 
        FROM kelas k
        LEFT JOIN guru g ON k.id_wali_guru = g.id_guru
        LEFT JOIN murid m ON k.id_kelas = m.id_kelas 
        GROUP BY k.id_kelas
    `;

    db.query(sqlKelas, (err, resKelas) => {
        db.query('SELECT id_guru, nama_lengkap FROM guru WHERE role="guru"', (err, resGuru) => {
            res.render('manajemen-kelas', {
                nama_lengkap: req.session.nama_lengkap,
                halaman_aktif: 'kelas',
                data_kelas: resKelas,
                data_guru: resGuru
            });
        });
    });
});

// --- API GURU ---
// Ambil data satu guru untuk ditampilkan di modal edit
app.get('/api/get-guru/:id', cekSession, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM guru WHERE id_guru = ?', [id], (err, result) => {
        // Ambil juga kelas yang diajar
        db.query('SELECT id_kelas FROM guru_kelas WHERE id_guru = ?', [id], (err, kelas) => {
            res.json({ guru: result[0], kelas_ajar: kelas.map(k => k.id_kelas) });
        });
    });
});

// Proses Update Guru
app.post('/api/update-guru', cekSession, (req, res) => {
    const { id_guru, nama, mapel, email, id_kelas_wali, kelas_ajar } = req.body;
    const sql = "UPDATE guru SET nama_lengkap=?, mata_pelajaran=?, email=? WHERE id_guru=?";
    db.query(sql, [nama, mapel, email, id_guru], (err) => {
        // Update Wali Kelas di tabel kelas
        db.query("UPDATE kelas SET id_wali_guru = NULL WHERE id_wali_guru = ?", [id_guru], () => {
            if (id_kelas_wali) {
                db.query("UPDATE kelas SET id_wali_guru = ? WHERE id_kelas = ?", [id_guru, id_kelas_wali]);
            }
        });
        // Update Kelas Ajar (Hapus lama, isi baru)
        db.query("DELETE FROM guru_kelas WHERE id_guru = ?", [id_guru], () => {
            if (kelas_ajar) {
                const dataK = Array.isArray(kelas_ajar) ? kelas_ajar : [kelas_ajar];
                const values = dataK.map(idK => [id_guru, idK]);
                db.query("INSERT INTO guru_kelas (id_guru, id_kelas) VALUES ?", [values]);
            }
        });
        res.redirect('/manajemen-user?pesan=update_berhasil');
    });
});

// --- API MURID ---
app.get('/api/get-murid/:nisn', cekSession, (req, res) => {
    db.query('SELECT * FROM murid WHERE nisn = ?', [req.params.nisn], (err, result) => {
        res.json(result[0]);
    });
});

app.post('/api/update-murid', cekSession, (req, res) => {
    const { nisn, nama, id_kelas, email } = req.body;
    const sql = "UPDATE murid SET nama_lengkap=?, id_kelas=?, email=? WHERE nisn=?";
    db.query(sql, [nama, id_kelas, email, nisn], (err) => {
        res.redirect('/manajemen-user?pesan=update_berhasil');
    });
});

// --- API HAPUS GURU ---
app.get('/api/hapus-guru/:id', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.status(403).send('Akses dilarang');

    const id = req.params.id;
    // Karena kita menggunakan ON DELETE CASCADE di database, 
    // data di tabel guru_kelas akan otomatis terhapus.
    db.query('DELETE FROM guru WHERE id_guru = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-user?pesan=hapus_berhasil');
    });
});

// --- API HAPUS MURID ---
app.get('/api/hapus-murid/:nisn', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.status(403).send('Akses dilarang');

    const nisn = req.params.nisn;
    db.query('DELETE FROM murid WHERE nisn = ?', [nisn], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-user?pesan=hapus_berhasil');
    });
});

// ================= DASHBOARD GURU ================= //

app.get('/dashboard-guru', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');

    const idGuru = req.session.id_guru;
    const namaGuru = req.session.nama_lengkap;

    // 1. Query Akumulasi untuk 4 Kotak Statistik Utama
    // 1. Query Akumulasi untuk 4 Kotak Statistik Utama (Disesuaikan kondisinya)
    const queryStats = `
        SELECT 
            (SELECT COUNT(*) FROM tugas WHERE id_guru = ?) AS dibuat,
            (SELECT COUNT(*) FROM tugas WHERE id_guru = ? AND (status = 'Belum Selesai' OR status = 'belum')) AS belum,
            (SELECT COUNT(*) FROM tugas WHERE id_guru = ? AND (status = 'Selesai' OR status = 'selesai')) AS tuntas,
            (SELECT COUNT(*) FROM guru_kelas WHERE id_guru = ?) AS kelas
    `;

    // 2. Query Grafik Tren Mingguan berdasarkan Hari (Sun - Sat) dalam 7 hari terakhir
    const queryChart = `
        SELECT 
            DAYNAME(tenggat_waktu) AS nama_hari,
            SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) AS jumlah_selesai,
            SUM(CASE WHEN status = 'Belum Selesai' THEN 1 ELSE 0 END) AS jumlah_belum
        FROM tugas
        WHERE id_guru = ? AND tenggat_waktu >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DAYNAME(tenggat_waktu)
    `;

    db.query(queryStats, [idGuru, idGuru, idGuru, idGuru], (err, resStats) => {
        if (err) {
            console.error("Gagal mengambil statistik beranda:", err);
            return res.status(500).send("Kesalahan Database");
        }

        db.query(queryChart, [idGuru], (err, resChart) => {
            if (err) {
                console.error("Gagal mengambil data tren grafik:", err);
                return res.status(500).send("Kesalahan Database");
            }

            // Struktur penampung default agar urutan hari Sun - Sat konsisten
            const susunanHari = { 'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0 };
            const dataSelesai = { ...susunanHari };
            const dataBelum = { ...susunanHari };

            // Memasukkan hasil query database ke dalam map hari yang sesuai
            resChart.forEach(row => {
                if (dataSelesai[row.nama_hari] !== undefined) {
                    dataSelesai[row.nama_hari] = row.jumlah_selesai;
                    dataBelum[row.nama_hari] = row.jumlah_belum;
                }
            });

            // Ubah objek menjadi deretan array angka murni murni agar bisa dibaca JSON.parse() di EJS
            res.render('dashboard-guru', {
                nama_lengkap: namaGuru,
                halaman_aktif: 'beranda',
                stats: {
                    dibuat: resStats[0].dibuat,
                    belum: resStats[0].belum,
                    tuntas: resStats[0].tuntas,
                    kelas: resStats[0].kelas
                },
                chartData: {
                    selesai: Object.values(dataSelesai).join(','),
                    belum: Object.values(dataBelum).join(',')
                }
            });
        });
    });
});
app.get('/daftar-tugas-guru', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');
    const query = `
        SELECT k.id_kelas, k.nama_kelas, (SELECT COUNT(*) FROM murid m WHERE m.id_kelas = k.id_kelas) AS jumlah_siswa
        FROM kelas k
        JOIN guru_kelas gk ON k.id_kelas = gk.id_kelas
        WHERE gk.id_guru = ?
    `;
    db.query(query, [req.session.id_guru], (err, results) => {
        res.render('daftar-tugas-guru', {
            nama_lengkap: req.session.nama_lengkap,
            halaman_aktif: 'tugas',
            data_kelas: results
        });
    });
});

app.get('/tambah-tugas/:id_kelas', cekSession, (req, res) => {
    const idK = req.params.id_kelas;
    db.query('SELECT nama_kelas FROM kelas WHERE id_kelas = ?', [idK], (err, resK) => {
        const sqlTugas = `
            SELECT t.*, m.nama_lengkap AS nama_siswa FROM tugas t 
            LEFT JOIN murid m ON t.id_kelas = m.id_kelas
            WHERE t.id_kelas = ? AND t.id_guru = ?
        `;
        db.query(sqlTugas, [idK, req.session.id_guru], (err, resT) => {
            res.render('tambah-tugas', {
                nama_lengkap: req.session.nama_lengkap,
                halaman_aktif: 'tugas',
                nama_kelas: resK[0].nama_kelas,
                data_tugas: resT
            });
        });
    });
});

// --- API MANAJEMEN KELAS ---

// 1. Tambah Kelas
app.post('/api/tambah-kelas', cekSession, (req, res) => {
    const { nama_kelas, id_wali } = req.body;
    const sql = "INSERT INTO kelas (nama_kelas, id_wali_guru) VALUES (?, ?)";
    db.query(sql, [nama_kelas, id_wali || null], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-kelas?pesan=tambah_berhasil');
    });
});

// 2. Ambil Data Satu Kelas (untuk Edit)
app.get('/api/get-kelas/:id', cekSession, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM kelas WHERE id_kelas = ?', [id], (err, result) => {
        res.json(result[0]);
    });
});

// 3. Update Kelas
app.post('/api/update-kelas', cekSession, (req, res) => {
    const { id_kelas, nama_kelas, id_wali } = req.body;
    const sql = "UPDATE kelas SET nama_kelas = ?, id_wali_guru = ? WHERE id_kelas = ?";
    db.query(sql, [nama_kelas, id_wali || null, id_kelas], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-kelas?pesan=update_berhasil');
    });
});

app.get('/api/ubah-status-tugas/:id', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');
    
    const idTugas = req.params.id;
    const idKelas = req.query.id_kelas;

    // Pastikan kata 'Selesai' di sini sama persis dengan yang dicari di queryBeranda atas
    db.query("UPDATE tugas SET status = 'Selesai' WHERE id_tugas = ?", [idTugas], (err) => {
        if (err) throw err;
        res.redirect(`/tugas-kelas/${idKelas}`);
    });
});

// 4. Hapus Kelas
app.get('/api/hapus-kelas/:id', cekSession, (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM kelas WHERE id_kelas = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-kelas?pesan=hapus_berhasil');
    });
});
// Rute 1: Tampilkan Halaman Utama Grid Kelas
app.get('/daftar-tugas-guru', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');
    
    // Ambil data seluruh kelas untuk grid beranda tugas
    db.query("SELECT k.*, (SELECT COUNT(*) FROM siswa s WHERE s.id_kelas = k.id_kelas) AS jumlah_siswa FROM kelas k", (err, resKelas) => {
        if (err) throw err;
        res.render('daftar-tugas-guru', {
            data_kelas: resKelas,
            nama_lengkap: req.session.nama_lengkap
        });
    });
});

// Rute 2: Tampilkan Detail Tabel Tugas Per Kelas yang Dipilih
// ==========================================
// 1. TAMPILKAN HALAMAN DETAIL TUGAS KELAS (GABUNGAN TUGAS & MURID)
// ==========================================
app.get('/tugas-kelas/:id_kelas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');
    const idKelas = req.params.id_kelas;

    // Ambil informasi nama kelas untuk Sub-Header halaman
    db.query("SELECT nama_kelas FROM kelas WHERE id_kelas = ?", [idKelas], (err, resKelas) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Kesalahan Database");
        }
        if (resKelas.length === 0) return res.send("Kelas tidak ditemukan");

        // Query JOIN: Menampilkan daftar tugas kelas sekaligus data nama murid di kelas tersebut
        const queryTabel = `
            SELECT 
                t.id_tugas, 
                t.judul_tugas, 
                DATE_FORMAT(t.tenggat_waktu, '%Y-%m-%d') AS tanggal_raw,
                DATE_FORMAT(t.tenggat_waktu, '%d %b %Y') AS tenggat_waktu, 
                t.status AS status_tugas,
                m.nama_lengkap AS nama_siswa,
                m.nisn
            FROM tugas t
            LEFT JOIN murid m ON t.id_kelas = m.id_kelas
            WHERE t.id_kelas = ?
            ORDER BY t.id_tugas DESC, m.nama_lengkap ASC
        `;

        db.query(queryTabel, [idKelas], (err, resData) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Kesalahan Database");
            }

            res.render('tugas-kelas', {
                id_kelas: idKelas,
                nama_kelas: resKelas[0].nama_kelas,
                data_gabungan: resData,
                nama_lengkap: req.session.nama_lengkap
            });
        });
    });
});

// ==========================================
// 2. API: PROSES TANDAI SELESAI (UPDATE STATUS TUGAS)
// ==========================================
app.get('/api/ubah-status-tugas/:id', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');
    
    const idTugas = req.params.id;
    const idKelas = req.query.id_kelas;

    // Mengubah status tugas di database menjadi 'Selesai'
    db.query("UPDATE tugas SET status = 'Selesai' WHERE id_tugas = ?", [idTugas], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal mengubah status tugas");
        }
        // Redirect kembali ke halaman tugas kelas asal agar tabel ter-refresh
        res.redirect(`/tugas-kelas/${idKelas}`);
    });
});

// ==========================================
// 3. API: PROSES HAPUS TUGAS DARI DATABASE
// ==========================================
app.get('/api/hapus-tugas/:id', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');

    const idTugas = req.params.id;
    const idKelas = req.query.id_kelas;

    db.query("DELETE FROM tugas WHERE id_tugas = ?", [idTugas], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal menghapus tugas");
        }
        res.redirect(`/tugas-kelas/${idKelas}`);
    });
});

// ==========================================
// 4. API: PROSES SIMPAN PERUBAHAN EDIT TUGAS (POST)
// ==========================================
app.post('/api/edit-tugas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');

    const { id_tugas, id_kelas, judul_tugas, tenggat_waktu } = req.body;

    const queryUpdate = "UPDATE tugas SET judul_tugas = ?, tenggat_waktu = ? WHERE id_tugas = ?";
    db.query(queryUpdate, [judul_tugas, tenggat_waktu, id_tugas], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Gagal memperbarui data tugas");
        }
        res.redirect(`/tugas-kelas/${id_kelas}`);
    });
});
// ================= DASHBOARD SISWA ================= //

app.get('/dashboard-siswa', cekSession, (req, res) => {
    const namaSiswa = req.session.nama_lengkap;
    db.query('SELECT id_kelas FROM murid WHERE nama_lengkap = ?', [namaSiswa], (err, resM) => {
        const idK = resM[0].id_kelas;
        db.query('SELECT COUNT(*) AS total FROM tugas WHERE id_kelas = ?', [idK], (err, resT) => {
            res.render('dashboard-siswa', {
                nama_lengkap: namaSiswa,
                halaman_aktif: 'beranda',
                stats: { total: resT[0].total, belum: 0, selesai: resT[0].total }
            });
        });
    });
});

app.listen(3000, () => console.log('Server running: http://localhost:3000'));

app.get('/daftar-tugas-guru', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');

    const idGuru = req.session.id_guru;

    // Query mengambil kelas yang diajar oleh guru ini beserta jumlah siswanya
    const queryKelas = `
        SELECT k.id_kelas, k.nama_kelas, 
        (SELECT COUNT(*) FROM murid m WHERE m.id_kelas = k.id_kelas) AS jumlah_siswa
        FROM kelas k
        JOIN guru_kelas gk ON k.id_kelas = gk.id_kelas
        WHERE gk.id_guru = ?
    `;

    db.query(queryKelas, [idGuru], (err, results) => {
        if (err) {
            console.error("Gagal memuat daftar kelas guru:", err);
            return res.status(500).send("Kesalahan Server");
        }
        
        res.render('daftar-tugas-guru', {
            nama_lengkap: req.session.nama_lengkap,
            halaman_aktif: 'tugas',
            data_kelas: results
        });
    });
});

// --- Halaman Form Tambah Tugas ---
app.get('/tambah-tugas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');

    const idGuru = req.session.id_guru;

    // Ambil daftar kelas yang diajar oleh guru ini untuk pilihan di form (checkbox)
    const queryKelas = `
        SELECT k.id_kelas, k.nama_kelas 
        FROM kelas k
        JOIN guru_kelas gk ON k.id_kelas = gk.id_kelas
        WHERE gk.id_guru = ?
    `;

    db.query(queryKelas, [idGuru], (err, results) => {
        if (err) throw err;
        res.render('tambah-tugas', {
            nama_lengkap: req.session.nama_lengkap,
            halaman_aktif: 'tambah-tugas', // Sesuaikan dengan kondisi active di partials/sidebar-guru
            data_kelas: results
        });
    });
});

// --- API Proses Simpan Tugas Baru (Multi-Kelas) ---
app.post('/api/simpan-tugas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');

    const { judul_tugas, tenggat_waktu, kelas_tujuan } = req.body;
    const idGuru = req.session.id_guru;
    const statusDefault = 'Belum Selesai';

    if (!kelas_tujuan || kelas_tujuan.length === 0) {
        return res.send("<script>alert('Pilih minimal satu kelas tujuan!'); window.history.back();</script>");
    }

    const daftarKelas = Array.isArray(kelas_tujuan) ? kelas_tujuan : [kelas_tujuan];

    // Query disesuaikan dengan struktur asli dump SQL (ditambah tanggal_dibuat dan status)
    const sql = `INSERT INTO tugas (id_kelas, id_guru, judul_tugas, tanggal_dibuat, tenggat_waktu, status) VALUES ?`;
    
    // CURDATE() diwakili dengan objek Date hari ini di Node.js (YYYY-MM-DD)
    const tanggalHariIni = new Date().toISOString().slice(0, 10); 
    
    const values = daftarKelas.map(id_kelas => [id_kelas, idGuru, judul_tugas, tanggalHariIni, tenggat_waktu, statusDefault]);

    db.query(sql, [values], (err, result) => {
        if (err) {
            console.error("Gagal menyimpan tugas baru:", err);
            return res.status(500).send("Kesalahan database.");
        }
        res.redirect('/daftar-tugas-guru?pesan=tugas_berhasil_dibuat');
    });
});