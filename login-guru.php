<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Guru - Sistem Manajemen Tugas</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="header-login"></div>

    <div class="login-container">
        <div class="login-box">
            <h2>Login Guru</h2>
            
            <!-- Notifikasi jika gagal login -->
            <?php 
            if(isset($_GET['pesan'])){
                if($_GET['pesan'] == "gagal"){
                    echo "<p style='color: red; text-align: center; margin-bottom: 15px;'>Username atau Password salah!</p>";
                } else if($_GET['pesan'] == "belum_login"){
                    echo "<p style='color: orange; text-align: center; margin-bottom: 15px;'>Anda harus login untuk mengakses dashboard!</p>";
                }
            }
            ?>

            <!-- Form mengirim data ke proses-login.php -->
            <form action="proses-login.php" method="POST">
                <div class="input-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" required>
                </div>
                
                <div class="input-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password" required>
                </div>
                
                <button type="submit" class="btn-masuk">Masuk</button>
            </form>
        </div>
    </div>
</body>
</html>