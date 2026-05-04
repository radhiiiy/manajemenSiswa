<?php 
// Mengaktifkan session PHP
session_start();

// Menghubungkan dengan koneksi database
include 'koneksi.php';

// Menangkap data yang dikirim dari form
$username = $_POST['username'];
$password = $_POST['password'];

// Menyeleksi data guru dengan username dan password yang sesuai
$data = mysqli_query($koneksi, "SELECT * FROM guru WHERE username='$username' AND password='$password'");

// Menghitung jumlah data yang ditemukan
$cek = mysqli_num_rows($data);

if($cek > 0){
    $akun = mysqli_fetch_assoc($data);
    
    // Menyimpan data ke dalam session
    $_SESSION['username'] = $username;
    $_SESSION['nama_lengkap'] = $akun['nama_lengkap'];
    $_SESSION['status'] = "login";
    
    // Alihkan ke halaman dashboard
    header("location:dashboard-guru.php");
} else {
    // Alihkan kembali ke halaman login jika gagal
    header("location:login-guru.php?pesan=gagal");
}
?>