-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.0.30 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.1.0.6537
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for db_manajemen_tugas
CREATE DATABASE IF NOT EXISTS `db_manajemen_tugas` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `db_manajemen_tugas`;

-- Dumping structure for table db_manajemen_tugas.guru
CREATE TABLE IF NOT EXISTS `guru` (
  `id_guru` varchar(10) NOT NULL,
  `nama_lengkap` varchar(100) NOT NULL,
  `mata_pelajaran` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('operator','guru') DEFAULT 'guru',
  PRIMARY KEY (`id_guru`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table db_manajemen_tugas.guru: ~3 rows (approximately)
INSERT INTO `guru` (`id_guru`, `nama_lengkap`, `mata_pelajaran`, `email`, `username`, `password`, `role`) VALUES
	('G001', 'Dra. Sri Wahyuni', 'Biologi', 'sriw@school.ac.id', 'sri', '123', 'guru'),
	('G002', 'Budi Santoso, M.Pd.', 'Bahasa Inggris', 'budis@school.ac.id', 'budi', '123', 'guru'),
	('G005', 'firman', 'game', 'r@gmail.com', 'firman', '123', 'guru'),
	('OP01', 'Admin Operator', '-', 'admin@school.ac.id', 'operator', 'admin123', 'operator');

-- Dumping structure for table db_manajemen_tugas.guru_kelas
CREATE TABLE IF NOT EXISTS `guru_kelas` (
  `id_guru_kelas` int NOT NULL AUTO_INCREMENT,
  `id_guru` varchar(10) DEFAULT NULL,
  `id_kelas` int DEFAULT NULL,
  PRIMARY KEY (`id_guru_kelas`),
  KEY `id_guru` (`id_guru`),
  KEY `id_kelas` (`id_kelas`),
  CONSTRAINT `guru_kelas_ibfk_1` FOREIGN KEY (`id_guru`) REFERENCES `guru` (`id_guru`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `guru_kelas_ibfk_2` FOREIGN KEY (`id_kelas`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table db_manajemen_tugas.guru_kelas: ~4 rows (approximately)
INSERT INTO `guru_kelas` (`id_guru_kelas`, `id_guru`, `id_kelas`) VALUES
	(9, 'G001', 1),
	(10, 'G001', 3),
	(11, 'G002', 3),
	(12, 'G002', 4),
	(19, 'G005', 1);

-- Dumping structure for table db_manajemen_tugas.kelas
CREATE TABLE IF NOT EXISTS `kelas` (
  `id_kelas` int NOT NULL AUTO_INCREMENT,
  `nama_kelas` varchar(50) NOT NULL,
  `wali_kelas` varchar(100) DEFAULT NULL,
  `id_wali_guru` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id_kelas`),
  KEY `fk_wali_kelas` (`id_wali_guru`),
  CONSTRAINT `fk_wali_kelas` FOREIGN KEY (`id_wali_guru`) REFERENCES `guru` (`id_guru`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table db_manajemen_tugas.kelas: ~3 rows (approximately)
INSERT INTO `kelas` (`id_kelas`, `nama_kelas`, `wali_kelas`, `id_wali_guru`) VALUES
	(1, 'XI RPL 2', 'Budi Santoso, M.Pd.', NULL),
	(3, 'XII RPL 1', NULL, 'G002'),
	(4, 'X TKJ 2', NULL, NULL);

-- Dumping structure for table db_manajemen_tugas.murid
CREATE TABLE IF NOT EXISTS `murid` (
  `nisn` varchar(20) NOT NULL,
  `nama_lengkap` varchar(100) NOT NULL,
  `id_kelas` int DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  PRIMARY KEY (`nisn`),
  KEY `id_kelas` (`id_kelas`),
  CONSTRAINT `murid_ibfk_1` FOREIGN KEY (`id_kelas`) REFERENCES `kelas` (`id_kelas`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table db_manajemen_tugas.murid: ~2 rows (approximately)
INSERT INTO `murid` (`nisn`, `nama_lengkap`, `id_kelas`, `email`, `password`) VALUES
	('0081234567', 'Ahmad Fathoni', 3, 'ahmad.f@student.ac.id', '123'),
	('0087654321', 'Siti Nurhaliza', 4, 'siti.n@student.ac.id', '123'),
	('123', 'radhi', 1, 'radhiyyan232@gmail.com', '123');

-- Dumping structure for table db_manajemen_tugas.tugas
CREATE TABLE IF NOT EXISTS `tugas` (
  `id_tugas` int NOT NULL AUTO_INCREMENT,
  `judul_tugas` varchar(150) NOT NULL,
  `deskripsi` text,
  `id_guru` varchar(10) DEFAULT NULL,
  `id_kelas` int DEFAULT NULL,
  `tanggal_dibuat` date DEFAULT NULL,
  `tenggat_waktu` date DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Belum Selesai',
  PRIMARY KEY (`id_tugas`),
  KEY `id_guru` (`id_guru`),
  KEY `id_kelas` (`id_kelas`),
  CONSTRAINT `tugas_ibfk_1` FOREIGN KEY (`id_guru`) REFERENCES `guru` (`id_guru`) ON DELETE CASCADE,
  CONSTRAINT `tugas_ibfk_2` FOREIGN KEY (`id_kelas`) REFERENCES `kelas` (`id_kelas`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table db_manajemen_tugas.tugas: ~1 rows (approximately)
INSERT INTO `tugas` (`id_tugas`, `judul_tugas`, `deskripsi`, `id_guru`, `id_kelas`, `tanggal_dibuat`, `tenggat_waktu`, `status`) VALUES
	(2, 'Tugas Reading Comprehension', 'Baca teks bahasa Inggris di halaman 40', 'G002', 4, '2026-05-06', '2026-05-10', 'Selesai'),
	(3, 'game', 'coding', 'G005', 1, '2026-05-20', '2026-05-21', 'Selesai');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
