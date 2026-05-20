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

// Koneksi Database (Ganti host ke 127.0.0.1 agar mencegah crash IPv6)
const db = mysql.createConnection({
    host: '127.0.0.1',
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

    // 1. Cek Login Guru / Operator
    db.query('SELECT * FROM guru WHERE username = ? AND password = ?', [username, password], (err, resG) => {
        if (err) throw err;

        if (resG.length > 0) {
            req.session.loggedin = true;
            req.session.id_guru = resG[0].id_guru;
            req.session.nama_lengkap = resG[0].nama_lengkap;
            req.session.role = resG[0].role;
            return res.redirect(resG[0].role === 'operator' ? '/dashboard-operator' : '/dashboard-guru');
        }

        // 2. Cek Login Murid (Gunakan kolom EMAIL sesuai dump SQL asli Anda)
        // Ganti baris query murid lama dengan yang ini jika ingin login pakai NISN:
        db.query('SELECT * FROM murid WHERE nisn = ? AND password = ?', [username, password], (err, resM) => {
            if (err) throw err;

            if (resM.length > 0) {
                req.session.loggedin = true;
                req.session.nisn = resM[0].nisn;
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

    // 1. Query Hitung 4 Kotak Angka Indikator Utama
    const queryCounters = `
        SELECT 
            (SELECT COUNT(*) FROM guru WHERE role="guru") AS total_guru,
            (SELECT COUNT(*) FROM murid) AS total_siswa,
            (SELECT COUNT(*) FROM kelas) AS total_kelas,
            (SELECT COUNT(*) FROM tugas) AS total_tugas
    `;

    // 2. Query Agregasi Grafik Bar 1: Jumlah Tugas Di Tiap-Tiap Kelas
    const queryTugasKelas = `
        SELECT k.nama_kelas, COUNT(t.id_tugas) AS jumlah 
        FROM kelas k 
        LEFT JOIN tugas t ON k.id_kelas = t.id_kelas 
        GROUP BY k.id_kelas
    `;

    // 3. Query Agregasi Grafik Bar 2: Jumlah Tugas yang Dibuat Oleh Masing-Masing Guru
    const queryTugasGuru = `
        SELECT g.nama_lengkap, COUNT(t.id_tugas) AS jumlah 
        FROM guru g 
        LEFT JOIN tugas t ON g.id_guru = t.id_guru 
        WHERE g.role = 'guru'
        GROUP BY g.id_guru
    `;

    // 4. Query Agregasi Grafik Doughnut 3: Rasio Status Penyelesaian Tugas Global
    const queryStatusTugas = `
        SELECT 
            SUM(CASE WHEN status = 'Selesai' OR status = 'selesai' THEN 1 ELSE 0 END) AS selesai,
            SUM(CASE WHEN status = 'Belum Selesai' OR status = 'belum' THEN 1 ELSE 0 END) AS belum
        FROM tugas
    `;

    db.query(queryCounters, (err, resCounters) => {
        if (err) throw err;

        db.query(queryTugasKelas, (err, resKelas) => {
            if (err) throw err;

            db.query(queryTugasGuru, (err, resGuru) => {
                if (err) throw err;

                db.query(queryStatusTugas, (err, resStatus) => {
                    if (err) throw err;

                    // Ekstraksi data array untuk grafik bar kelas
                    const kelasLabels = resKelas.map(item => item.nama_kelas);
                    const kelasData = resKelas.map(item => item.jumlah).join(',');

                    // Ekstraksi data array untuk grafik bar guru (potong gelar panjang agar tidak sempit)
                    const guruLabels = resGuru.map(item => item.nama_lengkap.split(',')[0]);
                    const guruData = resGuru.map(item => item.jumlah).join(',');

                    // Ambil angka pembagian tugas selesai vs belum
                    const totalSelesai = resStatus[0].selesai || 0;
                    const totalBelum = resStatus[0].belum || 0;

                    res.render('dashboard-operator', {
                        nama_lengkap: req.session.nama_lengkap,
                        stats: {
                            guru: resCounters[0].total_guru,
                            siswa: resCounters[0].total_siswa,
                            kelas: resCounters[0].total_kelas,
                            tugas: resCounters[0].total_tugas
                        },
                        charts: {
                            kelasLabels: kelasLabels,
                            kelasData: kelasData,
                            guruLabels: guruLabels,
                            guruData: guruData,
                            selesaiData: `${totalSelesai},${totalBelum}`
                        }
                    });
                });
            });
        });
    });
});

app.get('/manajemen-user', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.redirect('/');

    db.query('SELECT * FROM guru WHERE role = "guru"', (err, resGuru) => {
        if (err) throw err;

        db.query(`
            SELECT murid.*, kelas.nama_kelas 
            FROM murid 
            LEFT JOIN kelas ON murid.id_kelas = kelas.id_kelas
        `, (err, resMurid) => {
            if (err) throw err;

            db.query('SELECT * FROM kelas', (err, resKelas) => {
                if (err) throw err;

                res.render('manajemen-user', {
                    nama_lengkap: req.session.nama_lengkap,
                    halaman_aktif: 'user',
                    data_guru: resGuru,
                    data_murid: resMurid,
                    data_kelas: resKelas
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

app.get('/api/get-guru/:id', cekSession, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM guru WHERE id_guru = ?', [id], (err, result) => {
        db.query('SELECT id_kelas FROM guru_kelas WHERE id_guru = ?', [id], (err, kelas) => {
            res.json({ guru: result[0], kelas_ajar: kelas.map(k => k.id_kelas) });
        });
    });
});

app.post('/api/update-guru', cekSession, (req, res) => {
    const { id_guru, nama, mapel, email, id_kelas_wali, kelas_ajar } = req.body;
    const sql = "UPDATE guru SET nama_lengkap=?, mata_pelajaran=?, email=? WHERE id_guru=?";
    db.query(sql, [nama, mapel, email, id_guru], (err) => {
        db.query("UPDATE kelas SET id_wali_guru = NULL WHERE id_wali_guru = ?", [id_guru], () => {
            if (id_kelas_wali) {
                db.query("UPDATE kelas SET id_wali_guru = ? WHERE id_kelas = ?", [id_guru, id_kelas_wali]);
            }
        });
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

app.get('/api/hapus-guru/:id', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.status(403).send('Akses dilarang');
    db.query('DELETE FROM guru WHERE id_guru = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-user?pesan=hapus_berhasil');
    });
});

app.get('/api/hapus-murid/:nisn', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.status(403).send('Akses dilarang');
    db.query('DELETE FROM murid WHERE nisn = ?', [req.params.nisn], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-user?pesan=hapus_berhasil');
    });
});

// ================= DASHBOARD GURU ================= //

app.get('/dashboard-guru', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');

    const idGuru = req.session.id_guru;
    const namaGuru = req.session.nama_lengkap;

    const queryStats = `
        SELECT 
            (SELECT COUNT(*) FROM tugas WHERE id_guru = ?) AS dibuat,
            (SELECT COUNT(*) FROM tugas WHERE id_guru = ? AND (status = 'Belum Selesai' OR status = 'belum')) AS belum,
            (SELECT COUNT(*) FROM tugas WHERE id_guru = ? AND (status = 'Selesai' OR status = 'selesai')) AS tuntas,
            (SELECT COUNT(*) FROM guru_kelas WHERE id_guru = ?) AS kelas
    `;

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
        if (err) return res.status(500).send("Kesalahan Database");

        db.query(queryChart, [idGuru], (err, resChart) => {
            if (err) return res.status(500).send("Kesalahan Database");

            const susunanHari = { 'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0 };
            const dataSelesai = { ...susunanHari };
            const dataBelum = { ...susunanHari };

            resChart.forEach(row => {
                if (dataSelesai[row.nama_hari] !== undefined) {
                    dataSelesai[row.nama_hari] = row.jumlah_selesai;
                    dataBelum[row.nama_hari] = row.jumlah_belum;
                }
            });

            res.render('dashboard-guru', {
                nama_lengkap: namaGuru,
                halaman_aktif: 'beranda',
                stats: { dibuat: resStats[0].dibuat, belum: resStats[0].belum, tuntas: resStats[0].tuntas, kelas: resStats[0].kelas },
                chartData: { selesai: Object.values(dataSelesai).join(','), belum: Object.values(dataBelum).join(',') }
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

app.get('/tugas-kelas/:id_kelas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');
    
    const idKelas = req.params.id_kelas;
    const idGuru = req.session.id_guru; // Diambil dari session login guru

    // VALIDASI KEAMANAN: Cek apakah guru ini mengajar di kelas tersebut berdasarkan tabel guru_kelas
    const queryValidasi = `
        SELECT * FROM guru_kelas 
        WHERE id_guru = ? AND id_kelas = ?
    `;

    db.query(queryValidasi, [idGuru, idKelas], (err, resValidasi) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Kesalahan Database");
        }

        // Jika tidak ada data relasi, artinya guru ini mencoba mengintip kelas lain
        if (resValidasi.length === 0) {
            return res.send(`
                <script>
                    alert('Akses Ditolak! Anda tidak ditugaskan untuk mengajar di kelas ini.');
                    window.location.href = '/daftar-tugas-guru';
                </script>
            `);
        }

        // JIKA LOLOS VALIDASI, AMBIL DATA SEPERTI BIASA
        // 1. Ambil nama kelas untuk header
        db.query("SELECT nama_kelas FROM kelas WHERE id_kelas = ?", [idKelas], (err, resKelas) => {
            if (err) return res.status(500).send("Kesalahan Database");

            // 2. Query JOIN: Ambil tugas dan daftar murid khusus untuk kelas ini
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
                WHERE t.id_kelas = ? AND t.id_guru = ?
                ORDER BY t.id_tugas DESC, m.nama_lengkap ASC
            `;

            db.query(queryTabel, [idKelas, idGuru], (err, resData) => {
                if (err) return res.status(500).send("Kesalahan Database");

                res.render('tugas-kelas', {
                    id_kelas: idKelas,
                    nama_kelas: resKelas[0].nama_kelas,
                    data_gabungan: resData,
                    nama_lengkap: req.session.nama_lengkap
                });
            });
        });
    });
});

app.get('/api/ubah-status-tugas/:id', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');
    db.query("UPDATE tugas SET status = 'Selesai' WHERE id_tugas = ?", [req.params.id], (err) => {
        if (err) throw err;
        res.redirect(`/tugas-kelas/${req.query.id_kelas}`);
    });
});

app.get('/api/hapus-tugas/:id', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');
    db.query("DELETE FROM tugas WHERE id_tugas = ?", [req.params.id], (err) => {
        if (err) throw err;
        res.redirect(`/tugas-kelas/${req.query.id_kelas}`);
    });
});

app.post('/api/edit-tugas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');
    const { id_tugas, id_kelas, judul_tugas, tenggat_waktu } = req.body;

    db.query("UPDATE tugas SET judul_tugas = ?, tenggat_waktu = ? WHERE id_tugas = ?", [judul_tugas, tenggat_waktu, id_tugas], (err) => {
        if (err) throw err;
        res.redirect(`/tugas-kelas/${id_kelas}`);
    });
});

// ================= DASHBOARD SISWA (SINKRON DENGAN DUMP SQL) ================= //

app.get('/dashboard-siswa', cekSession, (req, res) => {
    if (req.session.role !== 'siswa') return res.redirect('/');

    const nisn = req.session.nisn;
    const namaSiswa = req.session.nama_lengkap;

    // 1. Query mencari nama kelas dan wali kelas
    const queryKelas = `
        SELECT k.id_kelas, k.nama_kelas, g.nama_lengkap AS wali_kelas 
        FROM murid m
        JOIN kelas k ON m.id_kelas = k.id_kelas
        LEFT JOIN guru g ON k.id_wali_guru = g.id_guru
        WHERE m.nisn = ?
    `;

    db.query(queryKelas, [nisn], (err, resKelas) => {
        if (err) {
            console.error("Error pada query kelas siswa:", err);
            return res.status(500).send("Kesalahan Database");
        }
        
        if (resKelas.length === 0) {
            return res.send("Data siswa tidak ditemukan di database.");
        }

        const idKelas = resKelas[0].id_kelas;
        const namaKelas = resKelas[0].nama_kelas;
        const waliKelas = resKelas[0].wali_kelas || "Belum ditentukan";

        // 2. Query hitung statistik kotak tugas
        const queryStats = `
            SELECT 
                (SELECT COUNT(*) FROM tugas WHERE id_kelas = ?) AS total,
                (SELECT COUNT(*) FROM tugas WHERE id_kelas = ? AND status = 'Belum Selesai') AS belum,
                (SELECT COUNT(*) FROM tugas WHERE id_kelas = ? AND status = 'Selesai') AS selesai
        `;

        // 3. Query ambil data tugas untuk mengisi tabel daftar_tugas
        const queryDaftarTugas = `
            SELECT t.judul_tugas, g.nama_lengkap AS nama_guru, 
                   DATE_FORMAT(t.tenggat_waktu, '%d %b %Y') AS deadline, t.status
            FROM tugas t
            LEFT JOIN guru g ON t.id_guru = g.id_guru
            WHERE t.id_kelas = ?
            ORDER BY t.tenggat_waktu ASC
        `;

        // 4. Query tren mingguan khusus untuk grafik chart siswa
        const queryChart = `
            SELECT 
                DAYNAME(tenggat_waktu) AS nama_hari,
                SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END) AS jumlah_selesai,
                SUM(CASE WHEN status = 'Belum Selesai' THEN 1 ELSE 0 END) AS jumlah_belum
            FROM tugas
            WHERE id_kelas = ? AND tenggat_waktu >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DAYNAME(tenggat_waktu)
        `;

        db.query(queryStats, [idKelas, idKelas, idKelas], (err, resStats) => {
            if (err) throw err;

            db.query(queryDaftarTugas, [idKelas], (err, resTugas) => {
                if (err) throw err;

                db.query(queryChart, [idKelas], (err, resChart) => {
                    if (err) throw err;

                    // Struktur penampung default agar urutan hari Sun - Sat konsisten di chart
                    const susunanHari = { 'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0 };
                    const dataSelesai = { ...susunanHari };
                    const dataBelum = { ...susunanHari };

                    // Memetakan hasil query database ke objek hari
                    resChart.forEach(row => {
                        if (dataSelesai[row.nama_hari] !== undefined) {
                            dataSelesai[row.nama_hari] = row.jumlah_selesai;
                            dataBelum[row.nama_hari] = row.jumlah_belum;
                        }
                    });

                    // Render halaman dengan mengirimkan SEMUA variabel termasuk chartData
                    res.render('dashboard-siswa', {
                        nama_lengkap: namaSiswa,
                        nama_kelas: namaKelas,
                        wali_kelas: waliKelas,
                        stats: {
                            total: resStats[0].total || 0,
                            belum: resStats[0].belum || 0,
                            selesai: resStats[0].selesai || 0
                        },
                        daftar_tugas: resTugas,
                        chartData: {
                            selesai: Object.values(dataSelesai).join(','), // Mengubah jadi string "0,0,1,0..."
                            belum: Object.values(dataBelum).join(',')
                        }
                    });
                });
            });
        });
    });
});

// ================= FORM & API TAMBAH TUGAS GURU ================= //

app.get('/tambah-tugas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.redirect('/');

    const queryKelas = `
        SELECT k.id_kelas, k.nama_kelas 
        FROM kelas k
        JOIN guru_kelas gk ON k.id_kelas = gk.id_kelas
        WHERE gk.id_guru = ?
    `;

    db.query(queryKelas, [req.session.id_guru], (err, results) => {
        if (err) throw err;
        res.render('tambah-tugas', {
            nama_lengkap: req.session.nama_lengkap,
            halaman_aktif: 'tambah-tugas',
            data_kelas: results
        });
    });
});

app.post('/api/simpan-tugas', cekSession, (req, res) => {
    if (req.session.role !== 'guru') return res.status(403).send('Akses dilarang');

    // Menangkap input form (termasuk deskripsi)
    const { judul_tugas, deskripsi, tenggat_waktu, kelas_tujuan } = req.body;
    const idGuru = req.session.id_guru;
    const statusDefault = 'Belum Selesai';

    if (!kelas_tujuan || kelas_tujuan.length === 0) {
        return res.send("<script>alert('Pilih minimal satu kelas tujuan!'); window.history.back();</script>");
    }

    // Amankan data jika guru hanya mencentang satu kelas agar tetap dibaca sebagai Array
    const daftarKelas = Array.isArray(kelas_tujuan) ? kelas_tujuan : [kelas_tujuan];
    
    // Susun Query Bulk Insert (id_kelas, id_guru, judul_tugas, deskripsi, tanggal_dibuat, tenggat_waktu, status)
    const sql = `INSERT INTO tugas (id_kelas, id_guru, judul_tugas, deskripsi, tanggal_dibuat, tenggat_waktu, status) VALUES ?`;
    
    const tanggalHariIni = new Date().toISOString().slice(0, 10); 
    
    // Memetakan struktur values sesuai kolom tabel tugas di database
    const values = daftarKelas.map(id_kelas => [
        id_kelas, 
        idGuru, 
        judul_tugas, 
        deskripsi || '', 
        tanggalHariIni, 
        tenggat_waktu, 
        statusDefault
    ]);

    db.query(sql, [values], (err, result) => {
        if (err) {
            console.error("Gagal menyimpan tugas:", err);
            return res.status(500).send("Kesalahan database saat menyimpan tugas.");
        }
        // Redirect kembali ke beranda manajemen tugas guru
        res.redirect('/daftar-tugas-guru?pesan=tugas_berhasil_dibuat');
    });
});

// --- API MANAJEMEN KELAS OPERATOR ---
app.post('/api/tambah-kelas', cekSession, (req, res) => {
    const { nama_kelas, id_wali } = req.body;
    db.query("INSERT INTO kelas (nama_kelas, id_wali_guru) VALUES (?, ?)", [nama_kelas, id_wali || null], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-kelas?pesan=tambah_berhasil');
    });
});

app.get('/api/get-kelas/:id', cekSession, (req, res) => {
    db.query('SELECT * FROM kelas WHERE id_kelas = ?', [req.params.id], (err, result) => {
        res.json(result[0]);
    });
});

app.post('/api/update-kelas', cekSession, (req, res) => {
    const { id_kelas, nama_kelas, id_wali } = req.body;
    db.query("UPDATE kelas SET nama_kelas = ?, id_wali_guru = ? WHERE id_kelas = ?", [nama_kelas, id_wali || null, id_kelas], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-kelas?pesan=update_berhasil');
    });
});

app.get('/api/hapus-kelas/:id', cekSession, (req, res) => {
    db.query('DELETE FROM kelas WHERE id_kelas = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/manajemen-kelas?pesan=hapus_berhasil');
    });
});
app.get('/daftar-tugas-siswa', cekSession, (req, res) => {
    if (req.session.role !== 'siswa') return res.redirect('/');

    const nisn = req.session.nisn;
    const namaSiswa = req.session.nama_lengkap;

    // 1. Cari tahu id_kelas dari siswa yang sedang aktif session-nya
    db.query("SELECT id_kelas FROM murid WHERE nisn = ?", [nisn], (err, resMurid) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Kesalahan Database");
        }
        if (resMurid.length === 0) return res.send("Data siswa tidak ditemukan.");

        const idKelas = resMurid[0].id_kelas;

        // 2. Query mengambil daftar tugas untuk kelas tersebut, di-JOIN dengan tabel guru untuk mendapatkan nama pengajar
        const queryTugas = `
            SELECT 
                t.id_tugas,
                t.judul_tugas,
                t.status,
                g.nama_lengkap AS nama_guru
            FROM tugas t
            LEFT JOIN guru g ON t.id_guru = g.id_guru
            WHERE t.id_kelas = ?
            ORDER BY t.id_tugas DESC
        `;

        db.query(queryTugas, [idKelas], (err, resTugas) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Kesalahan Database");
            }

            // Render ke file views/daftar-tugas-siswa.ejs
            res.render('daftar-tugas-siswa', {
                nama_lengkap: namaSiswa,
                data_tugas: resTugas
            });
        });
    });
});


// Ambil daftar seluruh murid yang terdaftar di satu kelas tertentu
app.get('/api/get-murid-kelas/:id_kelas', cekSession, (req, res) => {
    if (req.session.role !== 'operator') return res.status(403).json({ error: 'Akses dilarang' });
    
    const idKelas = req.params.id_kelas;
    const query = "SELECT nisn, nama_lengkap, email FROM murid WHERE id_kelas = ? ORDER BY nama_lengkap ASC";
    
    db.query(query, [idKelas], (err, results) => {
        if (err) {
            console.error("Gagal mengambil detail murid kelas:", err);
            return res.status(500).json({ error: "Kesalahan database" });
        }
        res.json(results); // Mengembalikan array data murid ke browser
    });
});
// Listen Port Server
app.listen(3000, () => console.log('Server running: http://localhost:3000'));