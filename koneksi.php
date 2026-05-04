<?php
$host = "localhost";
$user = "root"; // Username default XAMPP
$pass = "";     // Password default XAMPP (kosong)
$db   = "db_manajemen_tugas";

$koneksi = mysqli_connect($host, $user, $pass, $db);

if (!$koneksi) {
    die("Koneksi database gagal: " . mysqli_connect_error());
}
?>