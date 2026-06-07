# 🏗️ Concrete Mix Optimizer

## Simulasi Optimasi Komposisi Campuran Beton Menggunakan Hill Climbing, Simulated Annealing, dan Genetic Algorithm Berbasis Web

![HTML](https://img.shields.io/badge/HTML5-Frontend-orange)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow)
![Optimization](https://img.shields.io/badge/AI-Optimization-blue)
![License](https://img.shields.io/badge/License-Educational-green)

## 📖 Deskripsi

**Concrete Mix Optimizer** adalah aplikasi berbasis web yang mensimulasikan proses optimasi komposisi campuran beton menggunakan tiga algoritma optimasi populer:

- Hill Climbing
- Simulated Annealing
- Genetic Algorithm

Aplikasi ini dibuat sebagai media pembelajaran untuk memahami penerapan algoritma kecerdasan buatan dan optimasi pada bidang **rekayasa material konstruksi**, khususnya dalam menentukan komposisi campuran beton yang menghasilkan kekuatan tinggi dengan biaya yang efisien.

---

## 🎯 Tujuan Optimasi

Sistem bertujuan untuk mencari komposisi terbaik dari:

- Semen (Cement)
- Pasir (Sand)
- Kerikil (Gravel)
- Air (Water)

dengan mempertimbangkan beberapa kriteria berikut:

✅ Memaksimalkan kekuatan tekan beton (Compressive Strength)

✅ Meminimalkan biaya material

✅ Menjaga workability atau kemudahan pengerjaan beton

---

## 🧠 Algoritma yang Digunakan

### 1. Hill Climbing

Hill Climbing merupakan algoritma pencarian lokal yang bergerak menuju solusi dengan nilai fitness yang lebih baik secara bertahap.

#### Varian yang tersedia

- Simple Hill Climbing
- Steepest Ascent Hill Climbing
- Stochastic Hill Climbing

#### Parameter

- Step Size
- Random Restart
- Jumlah Iterasi

---

### 2. Simulated Annealing

Simulated Annealing mengadopsi konsep pendinginan logam dalam proses pencarian solusi.

Algoritma ini dapat menerima solusi yang lebih buruk dengan probabilitas tertentu sehingga mampu keluar dari local optimum.

#### Parameter

- Initial Temperature (T₀)
- Cooling Rate
- Minimum Temperature (Tmin)

---

### 3. Genetic Algorithm

Genetic Algorithm meniru proses evolusi biologis melalui mekanisme:

- Seleksi
- Crossover
- Mutasi
- Elitisme

#### Parameter

- Population Size
- Number of Generations
- Mutation Rate
- Crossover Rate
- Elitism

#### Metode Seleksi

- Tournament Selection
- Roulette Wheel Selection

---

## 📊 Model Evaluasi (Fitness Function)

Setiap solusi dievaluasi berdasarkan tiga faktor utama.

### 🔹 Kekuatan Beton

Menggunakan pendekatan **Abrams' Law** yang menghubungkan rasio air terhadap semen *(Water-Cement Ratio)* dengan kekuatan tekan beton.

Semakin kecil rasio air terhadap semen, maka potensi kekuatan beton akan semakin tinggi.

### 🔹 Biaya Material

Perhitungan biaya menggunakan estimasi harga material konstruksi:

| Material | Harga |
|-----------|-----------:|
| Semen | Rp1.200/kg |
| Pasir | Rp300/kg |
| Kerikil | Rp250/kg |
| Air | Rp10/kg |

### 🔹 Workability

Workability diukur menggunakan pendekatan nilai slump.

Campuran yang memiliki nilai slump di bawah standar akan dikenakan penalti sehingga menghasilkan nilai fitness yang lebih rendah.

---

## ✨ Fitur Aplikasi

### 🔹 Hill Climbing

- Pemilihan jenis Hill Climbing
- Pengaturan step size
- Random restart
- Grafik konvergensi fitness
- Hasil komposisi terbaik

### 🔹 Simulated Annealing

- Pengaturan suhu awal
- Cooling rate
- Suhu minimum
- Grafik temperatur
- Grafik konvergensi fitness

### 🔹 Genetic Algorithm

- Pengaturan populasi
- Pengaturan generasi
- Mutation rate
- Crossover rate
- Elitism
- Visualisasi evolusi fitness

### 🔹 Perbandingan Algoritma

Menjalankan seluruh algoritma secara bersamaan dan membandingkan:

- Nilai fitness
- Kekuatan beton
- Biaya material
- Workability
- Waktu eksekusi

---

## 📈 Output Sistem

Setiap algoritma menghasilkan:

- Komposisi semen optimal (kg/m³)
- Komposisi pasir optimal (kg/m³)
- Komposisi kerikil optimal (kg/m³)
- Komposisi air optimal (kg/m³)
- Prediksi kekuatan beton (MPa)
- Estimasi biaya material
- Nilai fitness akhir
- Grafik konvergensi proses optimasi

---

## 🛠️ Teknologi yang Digunakan

| Teknologi | Kegunaan |
|------------|-----------|
| HTML5 | Struktur halaman |
| CSS3 | Desain antarmuka |
| JavaScript | Logika aplikasi |
| Chart.js | Visualisasi grafik |
| Bootstrap | Responsive UI |

---

## 🚀 Menjalankan Proyek

### Clone Repository

```bash
git clone https://github.com/username/concrete-mix-optimizer.git
Masuk ke Folder Proyek
cd concrete-mix-optimizer
Jalankan Aplikasi

Buka file:

index.html

menggunakan browser favorit Anda.

🌐 Deployment

Aplikasi ini sepenuhnya berbasis frontend sehingga dapat di-deploy dengan mudah menggunakan:

Vercel
Netlify
GitHub Pages

Tidak memerlukan:

Backend Server
Database
API Eksternal
🎓 Manfaat Akademik

Proyek ini dapat digunakan sebagai:

Tugas Artificial Intelligence
Tugas Sistem Cerdas
Tugas Optimasi
Simulasi Rekayasa Material
Studi Perbandingan Algoritma Optimasi
Media Pembelajaran AI Berbasis Web
👨‍💻 Pengembang

Irfan Fauzi

Mahasiswa Teknik Informatika

Proyek ini dibuat untuk mengimplementasikan dan membandingkan performa algoritma optimasi dalam menyelesaikan permasalahan nyata pada bidang rekayasa material konstruksi.
