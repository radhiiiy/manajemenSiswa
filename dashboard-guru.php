<?php 
session_start();

// Cek apakah pengguna sudah login
if($_SESSION['status'] != "login"){
    header("location:login-guru.php?pesan=belum_login");
    exit;
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Guru</title>
    <link rel="stylesheet" href="styles.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>

    <div class="dashboard-wrapper">
        <aside class="sidebar">
            <div class="profile-section">
                <div class="profile-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                </div>
                <!-- Menampilkan nama lengkap dari database -->
                <h3><?php echo $_SESSION['nama_lengkap']; ?></h3>
            </div>
            
            <nav class="sidebar-nav">
                <a href="#" class="active">Beranda</a>
                <a href="#">Daftar Tugas</a>
                <a href="#">Tambah Tugas</a>
            </nav>

            <!-- Tombol Keluar mengarah ke file logout.php -->
            <a href="logout.php" class="logout-btn">Keluar</a>
        </aside>

        <!-- Sisa kodingan area main dan chart JavaScript sama seperti sebelumnya -->
        <main class="content-area">
            <!-- (Masukkan kode bagian content-area yang sebelumnya di sini) -->
        </main>
    </div>
</body>
</html>