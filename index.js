const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const { Sticker } = require('wa-sticker-formatter');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');



// Gunakan auth tunggal agar file login bisa disimpan di GitHub/Railway

  const OWNER_NUMBER = "6283836348226@s.whatsapp.net";
  const BOT_NUMBER = '62882007141574@s.whatsapp.net';

const vipPath = './vip.json';
let vipList = new Set();

// Load VIP
try {
    const vipData = JSON.parse(fs.readFileSync(vipPath));
    vipList = new Set(vipData.vips);
} catch {
    vipList = new Set();
}

// Fungsi cek dan simpan
function isVIP(jid) {
    return vipList.has(jid) || jid === OWNER_NUMBER;
}

function saveVIP() {
    fs.writeFileSync(vipPath, JSON.stringify({ vips: [...vipList] }, null, 2));
}




// Load data muted dari file
let mutedUsers = new Set();
try {
    const data = fs.readFileSync('./muted.json');
    mutedUsers = new Set(JSON.parse(data));
} catch (e) {
    console.log('Gagal membaca file muted.json:', e);
}

// Fungsi simpan mute ke file
function simpanMuted() {
    fs.writeFileSync('./muted.json', JSON.stringify([...mutedUsers], null, 2));
}
const grupPath = './grupAktif.json';

function simpanGrupAktif() {
    fs.writeFileSync(grupPath, JSON.stringify(Object.fromEntries(grupAktif), null, 2));
}

let grupAktif = new Map();
try {
    const data = JSON.parse(fs.readFileSync(grupPath));
    grupAktif = new Map(Object.entries(data));
} catch (e) {
    console.log('📁 grupAktif.json belum ada, dibuat otomatis saat .on atau .off');
}

const skorPath = './skor.json';

function simpanSkorKeFile() {
    fs.writeFileSync(skorPath, JSON.stringify(Object.fromEntries(skorUser), null, 2));
}

try {
    const data = JSON.parse(fs.readFileSync('./skor.json'));
    skorUser = new Map(Object.entries(data));
} catch {
    console.log('📁 skor.json belum ada, akan dibuat otomatis.');
}

let suitGame = new Map();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const userHistory = new Set();

async function getAIReply(text) {
    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: "openai/gpt-3.5-turbo",
                messages: [{ role: 'user', content: text }]
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://openrouter.ai',
                    'X-Title': 'whatsapp-bot-fajar'
                }
            }
        );
        return response.data.choices[0].message.content.trim();
    } catch (e) {
        console.error('❌ Error AI:', e.response?.data || e.message);
        return 'Maaf, saya tidak bisa menjawab sekarang.';
    }
}

const truthList = [
  "Apa hal paling memalukan yang pernah kamu lakukan di depan umum?",
  "Siapa nama mantan yang masih suka kamu stalk?",
  "Kalau bisa balikan sama 1 orang, siapa yang bakal kamu pilih?",
  "Pernah pura-pura sakit biar gak sekolah? Ceritakan alasannya.",
  "Siapa teman yang paling ngeselin tapi kamu gak bisa jauhin?",
  "Pernah suka sama pacar orang? Ceritakan!",
  "Kalau kamu punya kekuatan gaib, kamu bakal pakai buat apa?",
  "Pernah curi-curi pandang siapa? Jelaskan.",
  "Pernah suka sama guru/dosen? Siapa?",
  "Hal paling gila yang pernah kamu lakukan demi cinta?",
  "Kalau disuruh jujur, siapa yang paling kamu benci diam-diam?",
  "Pernah diselingkuhin? Atau justru kamu yang selingkuh?",
  "Kapan terakhir kamu pura-pura bahagia?",
  "Siapa nama kontak yang kamu samarkan di HP karena malu?",
  "Kalau bisa ubah 1 hal dari masa lalu, apa itu?",
  "Kamu pilih cinta atau uang? Jelaskan kenapa.",
  "Pernah ciuman? Sama siapa dan di mana?",
  "Kalau bisa hilangin 1 orang dari hidupmu, siapa?",
  "Apa kebohongan terbesar yang belum ketahuan sampai sekarang?",
  "Hal tergila yang pengen kamu coba tapi belum berani?",
  "Siapa orang yang paling kamu pengen ajak chat sekarang?",
  "Apa hal yang paling kamu insecure-in dari dirimu?",
  "Kamu pernah punya pikiran jahat? Tentang apa?",
  "Siapa yang menurutmu paling fake tapi akrab sama kamu?",
  "Apa ketakutan terbesar kamu yang gak pernah kamu bilang ke siapa-siapa?"
];

const dareList = [
  "Ganti bio wa *Aku suka agus* dan biarkan 30 menit!",
  "VN 5 detik dengan suara ketawa paling serem versimu!",
  "Ganti foto profil jadi wajah temen random selama 15 menit!",
  "Kirim stiker paling cringe yang kamu punya!",
  "VN nyanyikan lagu *Balonku Ada Lima* tapi dengan huruf vokal i!",
  "Chat mantan dan bilang *aku masih sayang kamu* (screenshot ya!)",
  "Pake filter jelek di kamera dan kirim fotonya ke sini!",
  "Ketik *Aku ingin menikah tahun ini* di status WhatsApp!",
  "Rekam suara bilang 'Aku adalah budak cinta' dan kirim ke sini!",
  "Chat orang random dan tanya *Kamu percaya alien?*",
  "Ketik *Aku lagi pengen dimanja* di grup teman!",
  "Bilang ke orang random *Kamu cakep deh*",
  "Telepon kontak terakhir di WA dan bilang *Aku suka kamu!*",
  "Ganti nama kontak pacar jadi *Calon Suami/Istri*",
  "Ketik *Aku pengen peluk seseorang hari ini* di status WA",
  "Ceritakan rahasia tergokil kamu ke grup ini!",
  "Berikan pujian ke 3 orang di grup ini, sekarang juga!",
  "VN ngomong *aku ngaku salah* sambil pura-pura nangis",
  "VN ngomong dengan suara genit: 'Aduh om, jangan gitu dong'",
  "Kirim selfie dengan gaya paling kocak!",
  "VN nyebut nama crush kamu 5x nonstop!",
  "Tanya ke orang tua *Boleh nikah umur berapa ya?* lalu screenshot jawabannya",
  "Ketik *Pengen dipeluk* ke nomor orang random dikontakmu!",
  "Kirim foto tampang bangun tidur ke sini tanpa edit!",
  "Kirim emoji 🍑💦 ke orang random dan screenshot reaksinya!",
  "Kirim video kamu joget lagu TikTok yang lagi viral!"
];


// ================== TEBAK-AKU CONFIG ==================
const soalTebakan = [
    { soal: "Aku bisa dibuka tapi tak bisa ditutup. Aku apa?", jawaban: "telur" },
    { soal: "Aku punya kepala tapi tak punya badan. Aku apa?", jawaban: "koin" },
    { soal: "Aku selalu bertambah tapi tak pernah berkurang. Aku apa?", jawaban: "umur" },
    { soal: "Aku putih di luar, kuning di dalam, disukai anak-anak. Aku apa?", jawaban: "telur" },
    { soal: "Aku punya gigi tapi tidak bisa menggigit. Aku apa?", jawaban: "sisir" },
    { soal: "Aku bisa terbang tanpa sayap dan menangis tanpa mata. Aku apa?", jawaban: "awan" },
    { soal: "Aku ada di tengah malam tapi bukan benda. Aku apa?", jawaban: "huruf l" },
    { soal: "Aku selalu di depan cermin tapi tak pernah terlihat. Aku apa?", jawaban: "bayangan" },
    { soal: "Aku selalu datang tapi tak pernah tepat waktu. Aku apa?", jawaban: "kereta" },
    { soal: "Aku sering dipukul tapi tak pernah marah. Aku apa?", jawaban: "bedug" },
    { soal: "Aku bisa bersinar tapi bukan lampu. Aku apa?", jawaban: "matahari" },
    { soal: "Aku basah tapi bisa memadamkan api. Aku apa?", jawaban: "air" },
    { soal: "Aku selalu naik tapi tak pernah turun. Aku apa?", jawaban: "harga" },
    { soal: "Aku berbunyi saat disentuh, punya senar tapi bukan gitar. Aku apa?", jawaban: "biola" },
    { soal: "Aku bisa duduk tapi bukan orang. Aku apa?", jawaban: "kursi" },
    { soal: "Aku bisa diinjak tapi tak pernah protes. Aku apa?", jawaban: "sendal" },
    { soal: "Aku kecil, suka nyedot, bikin gatel. Aku apa?", jawaban: "nyamuk" },
    { soal: "Aku bulat, sering ditendang. Aku apa?", jawaban: "bola" },
    { soal: "Aku suka manjat tapi bukan monyet. Aku apa?", jawaban: "kucing" },
    { soal: "Aku manis, suka dibungkus permen. Aku apa?", jawaban: "gula" },
    { soal: "Aku di tangan tapi bukan jari. Aku apa?", jawaban: "jam" },
    { soal: "Aku nyala kalau gelap. Aku apa?", jawaban: "lampu" },
    { soal: "Aku bisa dibuka, punya gigi. Aku apa?", jawaban: "resleting" },
    { soal: "Aku berbunyi saat lapar disentuh. Aku apa?", jawaban: "perut" },
    { soal: "Aku naik turun tapi tetap di tempat. Aku apa?", jawaban: "lift" },
    { soal: "Aku keras, suka dipakai bangun rumah. Aku apa?", jawaban: "batu" },
    { soal: "Aku suka terbang tapi bukan burung. Aku apa?", jawaban: "pesawat" },
    { soal: "Aku putih, dingin, bisa dimakan. Aku apa?", jawaban: "es" },
    { soal: "Aku kecil, hitam, bikin pedas. Aku apa?", jawaban: "lada" },
    { soal: "Aku bulat, bisa meletus. Aku apa?", jawaban: "balon" },
    { soal: "Aku selalu lapar, makan listrik. Aku apa?", jawaban: "hp" },
    { soal: "Aku bulu tapi bukan bulu mata. Aku apa?", jawaban: "bulu" },
    { soal: "Aku disetrika biar rapi. Aku apa?", jawaban: "baju" },
    { soal: "Aku suka jatuh pas galau. Aku apa?", jawaban: "airmata" },
    { soal: "Aku suka dipegang, kadang dipeluk. Aku apa?", jawaban: "bantal" },
    { soal: "Aku warnanya kuning, suka digoreng. Aku apa?", jawaban: "pisang" },
    { soal: "Aku ada angka, bisa jalan. Aku apa?", jawaban: "jam" },
    { soal: "Aku bening, masuk ke botol. Aku apa?", jawaban: "air" },
    { soal: "Aku ditulis di kertas, bisa bikin senyum. Aku apa?", jawaban: "puisi" },
    { soal: "Aku kering tapi bisa basah. Aku apa?", jawaban: "handuk" },
    { soal: "Aku kecil, putih, bikin senyum cerah. Aku apa?", jawaban: "gigi" },
    { soal: "Aku sering jatuh di malam hari. Aku apa?", jawaban: "embun" },
    { soal: "Aku bisa mencium tapi tak punya hidung. Aku apa?", jawaban: "bunga" }
];

const sesiTebakan = new Map(); // key: pengirim, value: { jawaban: string, timeout: TimeoutObject }

const soalKuis = [
    { soal: "Apa ibu kota negara Jepang?", pilihan: ["A. Seoul", "B. Tokyo", "C. Beijing", "D. Bangkok"], jawaban: "B" },
    { soal: "Siapa penemu lampu pijar?", pilihan: ["A. Newton", "B. Galileo", "C. Edison", "D. Tesla"], jawaban: "C" },
    { soal: "Berapa hasil dari 9 x 8?", pilihan: ["A. 72", "B. 64", "C. 81", "D. 56"], jawaban: "A" },
    { soal: "Suku asli Pulau Kalimantan disebut?", pilihan: ["A. Batak", "B. Dayak", "C. Sunda", "D. Bali"], jawaban: "B" },
    { soal: "Planet terbesar di tata surya?", pilihan: ["A. Mars", "B. Jupiter", "C. Saturnus", "D. Uranus"], jawaban: "B" },
    { soal: "Gunung tertinggi di dunia?", pilihan: ["A. Kilimanjaro", "B. Everest", "C. Elbrus", "D. Denali"], jawaban: "B" },
    { soal: "Negara dengan jumlah penduduk terbanyak?", pilihan: ["A. India", "B. Indonesia", "C. Tiongkok", "D. Rusia"], jawaban: "C" },
    { soal: "Apa ibukota Australia?", pilihan: ["A. Sydney", "B. Melbourne", "C. Canberra", "D. Brisbane"], jawaban: "C" },
    { soal: "Zodiak untuk orang yang lahir di bulan Januari?", pilihan: ["A. Aries", "B. Capricorn", "C. Leo", "D. Libra"], jawaban: "B" },
    { soal: "Berapa jumlah warna pelangi?", pilihan: ["A. 5", "B. 6", "C. 7", "D. 8"], jawaban: "C" },
    { soal: "Hewan tercepat di darat?", pilihan: ["A. Cheetah", "B. Kuda", "C. Singa", "D. Rusa"], jawaban: "A" },
    { soal: "Siapa presiden pertama Indonesia?", pilihan: ["A. Soeharto", "B. Soekarno", "C. Habibie", "D. Megawati"], jawaban: "B" },
    { soal: "Ibukota provinsi Jawa Barat?", pilihan: ["A. Bandung", "B. Semarang", "C. Yogyakarta", "D. Surabaya"], jawaban: "A" },
    { soal: "Lambang sila pertama Pancasila?", pilihan: ["A. Rantai", "B. Banteng", "C. Bintang", "D. Padi dan kapas"], jawaban: "C" },
    { soal: "Benua terbesar di dunia?", pilihan: ["A. Afrika", "B. Amerika", "C. Asia", "D. Eropa"], jawaban: "C" },
    { soal: "Air dalam bentuk padat disebut?", pilihan: ["A. Uap", "B. Salju", "C. Embun", "D. Es"], jawaban: "D" },
    { soal: "Ibukota Italia?", pilihan: ["A. Paris", "B. Roma", "C. Milan", "D. Napoli"], jawaban: "B" },
    { soal: "Huruf pertama dalam alfabet Yunani?", pilihan: ["A. Alpha", "B. Beta", "C. Gamma", "D. Delta"], jawaban: "A" },
    { soal: "Angka Romawi untuk 100?", pilihan: ["A. L", "B. D", "C. C", "D. M"], jawaban: "C" },
    { soal: "Nama ilmiah dari air?", pilihan: ["A. H2", "B. HO", "C. H2O", "D. O2H"], jawaban: "C" },
    { soal: "Siapa penemu gravitasi?", pilihan: ["A. Galileo", "B. Newton", "C. Tesla", "D. Edison"], jawaban: "B" },
    { soal: "Benda langit yang mengelilingi planet?", pilihan: ["A. Matahari", "B. Asteroid", "C. Bulan", "D. Komet"], jawaban: "C" },
    { soal: "Berapa hasil 100 dibagi 4?", pilihan: ["A. 20", "B. 25", "C. 30", "D. 40"], jawaban: "B" },
    { soal: "Bahasa resmi Brasil?", pilihan: ["A. Spanyol", "B. Portugis", "C. Inggris", "D. Italia"], jawaban: "B" },
    { soal: "Alat musik tiup berikut ini adalah?", pilihan: ["A. Gitar", "B. Drum", "C. Seruling", "D. Biola"], jawaban: "C" },
    { soal: "Organ yang memompa darah?", pilihan: ["A. Paru-paru", "B. Ginjal", "C. Hati", "D. Jantung"], jawaban: "D" },
    { soal: "Bentuk bumi adalah?", pilihan: ["A. Datar", "B. Bulat", "C. Kotak", "D. Segitiga"], jawaban: "B" },
    { soal: "Pulau terbesar di Indonesia?", pilihan: ["A. Bali", "B. Jawa", "C. Kalimantan", "D. Sumatra"], jawaban: "C" },
    { soal: "Hewan berkaki delapan?", pilihan: ["A. Ular", "B. Semut", "C. Laba-laba", "D. Kupu-kupu"], jawaban: "C" },
    { soal: "Planet terdekat ke matahari?", pilihan: ["A. Mars", "B. Bumi", "C. Venus", "D. Merkurius"], jawaban: "D" },
    { soal: "Apa hasil dari (5 + 3) x 2?", pilihan: ["A. 10", "B. 16", "C. 13", "D. 18"], jawaban: "B" },
    { soal: "Binatang apa yang selalu benar?", pilihan: ["A. Ayam", "B. Kucing", "C. Benar-benar", "D. Gajah"], jawaban: "C" },
    { soal: "Berapa sisi segi lima?", pilihan: ["A. 4", "B. 5", "C. 6", "D. 8"], jawaban: "B" },
    { soal: "Angka 0 dibagi dengan angka berapapun hasilnya?", pilihan: ["A. Nol", "B. Satu", "C. Tak hingga", "D. Tidak bisa"], jawaban: "A" },
    { soal: "Organ apa yang berfungsi menyaring darah?", pilihan: ["A. Paru-paru", "B. Ginjal", "C. Jantung", "D. Otak"], jawaban: "B" },
    { soal: "Tahun kabisat terjadi setiap ...?", pilihan: ["A. 2 tahun", "B. 3 tahun", "C. 4 tahun", "D. 5 tahun"], jawaban: "C" },
    { soal: "Apa lawan kata dari konveksi?", pilihan: ["A. Radiasi", "B. Evaporasi", "C. Kondensasi", "D. Konduksi"], jawaban: "D" },
    { soal: "Benda apa yang jika dibalik tetap bisa dipakai membaca?", pilihan: ["A. Buku", "B. Koran", "C. Komik", "D. Majalah"], jawaban: "B" },
    { soal: "Apa ibukota dari negara Islandia?", pilihan: ["A. Helsinki", "B. Reykjavik", "C. Oslo", "D. Nuuk"], jawaban: "B" },
    { soal: "Jika hari ini Rabu, maka 9 hari lagi adalah?", pilihan: ["A. Jumat", "B. Sabtu", "C. Minggu", "D. Jumat"], jawaban: "C" },
    { soal: "Jumlah huruf pada kata 'Indonesia' adalah?", pilihan: ["A. 7", "B. 8", "C. 9", "D. 10"], jawaban: "C" },
    { soal: "Berapa liter dalam 1 galon (standar Indonesia)?", pilihan: ["A. 15", "B. 19", "C. 20", "D. 25"], jawaban: "B" },
    { soal: "Apa simbol kimia dari Emas?", pilihan: ["A. Ag", "B. Au", "C. Fe", "D. Cu"], jawaban: "B" },
    { soal: "Apa nama bulan di antara Juli dan September?", pilihan: ["A. Juni", "B. Agustus", "C. Oktober", "D. Mei"], jawaban: "B" },
    { soal: "Hewan apa yang bisa hidup di darat dan air?", pilihan: ["A. Ikan", "B. Ular", "C. Katak", "D. Burung"], jawaban: "C" },
    { soal: "Jika kamu punya 3 apel dan kamu makan 1, berapa sisa?", pilihan: ["A. 2", "B. 3", "C. 1", "D. 0"], jawaban: "A" },
    { soal: "Apa warna sekunder dari merah dan kuning?", pilihan: ["A. Hijau", "B. Oranye", "C. Ungu", "D. Biru"], jawaban: "B" },
    { soal: "Lagu 'Indonesia Raya' diciptakan oleh?", pilihan: ["A. WR Supratman", "B. Ismail Marzuki", "C. Soe Hok Gie", "D. Chairil Anwar"], jawaban: "A" },
    { soal: "Berapa jumlah huruf vokal di kata 'Sekolah'?", pilihan: ["A. 2", "B. 3", "C. 4", "D. 5"], jawaban: "B" },
    { soal: "Apa kepanjangan dari CPU?", pilihan: ["A. Central Print Unit", "B. Core Processing Unit", "C. Central Processing Unit", "D. Control Power Unit"], jawaban: "C" }
];

const sesiKuis = new Map(); // key: pengirim, value: { jawaban: string, timeout: TimeoutObject }

const soalSusunKata = [
    "komputer", "android", "internet", "bahagia", "semangat", 
    "program", "senyuman", "mainan", "teknologi", "pelajar",
    "sekolah", "rumah", "cerdas", "pintar", "botak", "kecerdasan",
    "belajar", "perpustakaan", "universitas", "penghapus", "penggaris",
    "pelangi", "matahari", "bulan", "bintang", "angkasa", "awan", "langit",
    "merah", "biru", "kuning", "jingga", "hitam", "putih", "ungu", "coklat",
    "kopi", "teh", "susu", "air", "eskrim", "permen", "kue", "nasi", "roti",
    "kucing", "anjing", "kelinci", "ular", "burung", "ikan", "gajah", "singa",
    "pasar", "hotel", "bioskop", "kantor", "bank", "toko", "warung",
    "pagi", "siang", "malam", "subuh", "senja", "fajar", "surya",
    "berlari", "berenang", "makan", "tidur", "mandi", "minum", "menangis",
    "senyum", "tertawa", "menulis", "membaca", "berhitung", "menggambar",
    "peluru", "pisang", "jeruk", "semangka", "apel", "durian", "nanas",
    "televisi", "kamera", "laptop", "printer", "mouse", "keyboard", "monitor",
    "jam", "meja", "kursi", "lemari", "jendela", "pintu", "atap", "dinding",
    "jalan", "mobil", "motor", "sepeda", "kereta", "pesawat", "kapal",
    "dompet", "tas", "buku", "pena", "penggaris", "kalkulator", "kertas",
    "jaket", "baju", "celana", "sepatu", "sandal", "kaos", "topi",
    "telinga", "mata", "hidung", "mulut", "tangan", "kaki", "perut", "kepala",
    "bola", "raket", "gawang", "wasit", "gol", "tim", "lapangan", "penonton",
    "kamera", "drama", "film", "musik", "lagu", "penyanyi", "gitar", "piano",
    "surat", "email", "pesan", "video", "foto", "data", "dokumen"
];

const sesiSusunKata = new Map(); // key: pengirim, value: { jawaban, timeout }

const soalFamily100 = [
  {
    pertanyaan: "Sesuatu yang ada di kamar mandi?",
    jawaban: ["sabun", "handuk", "gayung", "sikat gigi", "pasta gigi"]
  },
  {
    pertanyaan: "Hewan yang bisa terbang?",
    jawaban: ["burung", "kelelawar", "nyamuk", "lebah", "lalat"]
  },
  {
    pertanyaan: "Sesuatu yang ada di dapur?",
    jawaban: ["kompor", "panci", "sendok", "pisau", "gas"]
  },
  {
    pertanyaan: "Minuman yang disukai banyak orang?",
    jawaban: ["kopi", "teh", "susu", "jus", "air putih"]
  },
  {
    pertanyaan: "Sesuatu yang berwarna merah?",
    jawaban: ["apel", "cabai", "darah", "mobil", "merah"]
  },
  {
    pertanyaan: "Hewan yang hidup di air?",
    jawaban: ["ikan", "hiu", "lumba-lumba", "ubur-ubur", "paus"]
  },
  {
    pertanyaan: "Profesi di rumah sakit?",
    jawaban: ["dokter", "perawat", "resepsionis", "satpam", "bidan"]
  },
  {
    pertanyaan: "Sesuatu yang digunakan saat hujan?",
    jawaban: ["payung", "jas hujan", "sepatu boots", "jaket", "mantel"]
  },
  {
    pertanyaan: "Makanan yang digoreng?",
    jawaban: ["tempe", "tahu", "ayam", "ikan", "telur"]
  },
  {
    pertanyaan: "Alat yang ada di sekolah?",
    jawaban: ["papan tulis", "penghapus", "meja", "kursi", "spidol"]
  },
  {
    pertanyaan: "Buah yang berwarna kuning?",
    jawaban: ["pisang", "nanas", "mangga", "jeruk", "pepaya"]
  },
  {
    pertanyaan: "Hewan yang berkaki empat?",
    jawaban: ["kucing", "anjing", "sapi", "kambing", "kuda"]
  },
  {
    pertanyaan: "Sesuatu yang ada di meja makan?",
    jawaban: ["piring", "sendok", "garpu", "makanan", "gelas"]
  },
  {
    pertanyaan: "Sesuatu yang sering dicari saat hilang?",
    jawaban: ["hp", "kunci", "dompet", "remote", "kacamata"]
  },
  {
    pertanyaan: "Warna yang sering dipakai untuk baju sekolah?",
    jawaban: ["putih", "merah", "biru", "abu-abu", "coklat"]
  },
  {
    pertanyaan: "Sesuatu yang dilakukan saat bosan?",
    jawaban: ["main hp", "tidur", "makan", "nonton", "scroll tiktok"]
  },
  {
    pertanyaan: "Barang yang dibawa ke sekolah?",
    jawaban: ["buku", "pulpen", "tas", "kotak pensil", "botol minum"]
  },
  {
    pertanyaan: "Sesuatu yang panas?",
    jawaban: ["matahari", "api", "air panas", "kompor", "mie rebus"]
  },
  {
    pertanyaan: "Hewan yang hidup di darat?",
    jawaban: ["kucing", "anjing", "sapi", "kambing", "gajah"]
  },
  {
    pertanyaan: "Sesuatu yang dipakai di kepala?",
    jawaban: ["topi", "helm", "bando", "kerudung", "kacamata"]
  },
  {
    pertanyaan: "Minuman yang disajikan dingin?",
    jawaban: ["es teh", "jus", "es kopi", "air", "soda"]
  },
  {
    pertanyaan: "Buah yang berwarna hijau?",
    jawaban: ["melon", "apel", "anggur", "alpukat", "pir"]
  },
  {
    pertanyaan: "Sesuatu yang dilakukan saat bangun tidur?",
    jawaban: ["ngucek mata", "minum", "mandi", "doa", "ngecek hp"]
  },
  {
    pertanyaan: "Sesuatu yang ada di tas sekolah?",
    jawaban: ["buku", "pulpen", "penghapus", "bekal", "pensil"]
  },
  {
    pertanyaan: "Sesuatu yang ada di langit?",
    jawaban: ["matahari", "bulan", "bintang", "awan", "pesawat"]
  },
  {
    pertanyaan: "Sesuatu yang biasa dipakai saat olahraga?",
    jawaban: ["sepatu", "kaos", "celana", "headband", "raket"]
  },
  {
    pertanyaan: "Benda yang bisa mengeluarkan suara?",
    jawaban: ["radio", "hp", "tv", "speaker", "alarm"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dikunci?",
    jawaban: ["pintu", "lemari", "motor", "mobil", "hp"]
  },
  {
    pertanyaan: "Hewan yang hidup di kebun binatang?",
    jawaban: ["singa", "harimau", "gajah", "zebra", "unta"]
  },
  {
    pertanyaan: "Alat yang digunakan untuk membersihkan?",
    jawaban: ["sapu", "pel", "lap", "vacuum", "kain"]
  },
  {
    pertanyaan: "Sesuatu yang sering dipegang saat nonton TV?",
    jawaban: ["remote", "bantal", "snack", "minuman", "selimut"]
  },
  {
    pertanyaan: "Sesuatu yang dipakai di kaki?",
    jawaban: ["sepatu", "sandal", "kaos kaki", "sepatu roda", "sepatu bola"]
  },
  {
    pertanyaan: "Sesuatu yang sering ditemukan di meja belajar?",
    jawaban: ["lampu", "buku", "pulpen", "penghapus", "catatan"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dipotong?",
    jawaban: ["kertas", "rambut", "baju", "kue", "sayur"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dibuka dan ditutup?",
    jawaban: ["pintu", "jendela", "botol", "tas", "hp"]
  },
  {
    pertanyaan: "Sesuatu yang dipakai saat tidur?",
    jawaban: ["bantal", "selimut", "sprei", "piyama", "guling"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dikupas?",
    jawaban: ["pisang", "jeruk", "mangga", "kentang", "bawang"]
  },
  {
    pertanyaan: "Sesuatu yang bisa ditulis?",
    jawaban: ["buku", "kertas", "papan", "note", "catatan"]
  },
  {
    pertanyaan: "Tempat yang ramai saat liburan?",
    jawaban: ["pantai", "mall", "kebun binatang", "bioskop", "taman"]
  },
  {
    pertanyaan: "Sesuatu yang bergerak cepat?",
    jawaban: ["mobil", "motor", "pesawat", "kucing", "peluru"]
  },
  {
    pertanyaan: "Sesuatu yang memiliki roda?",
    jawaban: ["motor", "mobil", "sepeda", "gerobak", "skateboard"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dipeluk?",
    jawaban: ["bantal", "boneka", "orang", "guling", "hewan"]
  },
  {
    pertanyaan: "Sesuatu yang biasa diwarnai?",
    jawaban: ["gambar", "tembok", "kertas", "baju", "kuku"]
  },
  {
    pertanyaan: "Alat yang digunakan untuk makan?",
    jawaban: ["sendok", "garpu", "tangan", "sumpit", "piring"]
  },
  {
    pertanyaan: "Sesuatu yang bisa naik turun?",
    jawaban: ["lift", "tangga", "berat badan", "kurs", "panas"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dimakan mentah?",
    jawaban: ["salad", "buah", "timun", "wortel", "sushi"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dicium baunya?",
    jawaban: ["bunga", "parfum", "makanan", "bensin", "kotoran"]
  },
  {
    pertanyaan: "Sesuatu yang digunakan untuk menutup?",
    jawaban: ["pintu", "tutup", "penutup", "masker", "selimut"]
  },
  {
    pertanyaan: "Hewan yang bisa dijadikan peliharaan?",
    jawaban: ["kucing", "anjing", "kelinci", "burung", "hamster"]
  },
  {
    pertanyaan: "Transportasi di udara?",
    jawaban: ["pesawat", "helikopter", "paralayang", "balon udara", "jet"]
  },
  {
    pertanyaan: "Alat untuk menulis?",
    jawaban: ["pulpen", "pensil", "spidol", "kapur", "pena"]
  },
  {
    pertanyaan: "Sesuatu yang dilakukan saat libur?",
    jawaban: ["jalan-jalan", "tidur", "nonton", "main game", "masak"]
  },
  {
    pertanyaan: "Sesuatu yang ada di lemari es?",
    jawaban: ["susu", "air", "sayur", "telur", "buah"]
  },
  {
    pertanyaan: "Sesuatu yang bisa dibaca?",
    jawaban: ["buku", "koran", "novel", "majalah", "artikel"]
  },
  {
    pertanyaan: "Sesuatu yang bisa meledak?",
    jawaban: ["bom", "kembang api", "balon", "ban", "tabung gas"]
  }
];

const sesiFamily100 = new Map();
let skorUser = new Map();
const sesiJudi = new Map(); // key: sender, value: { msgId }


// Muat skor dari skor.json ke dalam Map
if (fs.existsSync('./skor.json')) {
    const dataSkor = JSON.parse(fs.readFileSync('./skor.json'));
    for (const [nomor, poin] of Object.entries(dataSkor)) {
        skorUser.set(nomor, poin);
    }
}


async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');


const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true,
  defaultQueryTimeoutMs: undefined
});

  sock.ev.on('creds.update', saveCreds);

    let wasDisconnected = false;

sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
        console.log('📸 Scan QR untuk login...');
        qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode || 0;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        wasDisconnected = true;

        console.log('🔌 Terputus. Alasan:', code);
        if (shouldReconnect) {
            console.log('🔄 Reconnecting in 5 seconds...');
            setTimeout(() => startBot(), 5000);
        } else {
            console.log('❌ Bot logout, scan ulang.');
        }

    } else if (connection === 'open') {
        console.log('✅ Bot aktif!');

        if (wasDisconnected) {
            wasDisconnected = false;

            try {
                const chats = await sock.groupFetchAllParticipating();
                const grupList = Object.keys(chats);

                for (const grupId of grupList) {
                    await sock.sendMessage(grupId, {
                        text: '🔔 *Bot aktif kembali!*\nMohon maaf ada sedikit kendala.'
                    });
                }

                console.log(`✅ Notifikasi dikirim ke ${grupList.length} grup.`);
            } catch (e) {
                console.error('❌ Gagal kirim notifikasi ke grup:', e);
            }
        }
    }
});


    // Anti spam cooldown
const cooldownSuit = new Set();

// Helper aman kirim pesan
async function safeSend(jid, content, options = {}) {
    try {
        await sock.sendMessage(jid, content, options);
    } catch (err) {
        console.error(`❌ Gagal kirim ke ${jid}:`, err.message);
    }
}


    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        
        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption || '';

        const imageContent = (
            msg.message?.imageMessage ||
            msg.message?.documentMessage?.mimetype?.includes("image") && msg.message.documentMessage ||
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
        );
        const isImage = !!imageContent;

        const msgType = Object.keys(msg.message)[0];
        const body = text.toLowerCase(); // ⬅ WAJIB ADA!
        const isGroup = from.endsWith('@g.us');
        console.log(`📩 Pesan dari ${from}: ${text}`);

        // 🔒 Jika bot nonaktif di grup ini, abaikan semua kecuali perintah .on
        if (from.endsWith('@g.us') && grupAktif.get(from) === false && !text.startsWith('.on')) {
            return;
        }

        // 🗨️ Respon pertama kali
        if (!userHistory.has(from)) {
            userHistory.add(from);
            await sock.sendMessage(from, {
                text: "Halo saya adalah bot AI WhatsApp yang dibuat oleh Fajar, Gunakan *.menu* untuk melihat list tools yang tersedia."
            });
        }

        function simpanSkorKeFile() {
        const skorObj = Object.fromEntries(skorUser);
        fs.writeFileSync('./skor.json', JSON.stringify(skorObj, null, 2));
    }

        function tambahSkor(nomor, jumlah) {
        const poinLama = skorUser.get(nomor) || 0;
        skorUser.set(nomor, poinLama + jumlah);
        simpanSkorKeFile(); // simpan setiap kali skor ditambah

    }

if (mutedUsers.has(sender)) {
    try {
        await sock.sendMessage(from, {
            text: '⚠️ Anda sedang dimute dan tidak bisa mengirim pesan.',
            quoted: msg
        });
        await sock.sendMessage(from, { delete: msg.key }); // hapus pesannya
    } catch (e) {
        console.log('Gagal hapus pesan dari user yang dimute.');
    }
    return;
}

    if (text.trim() === '.skor') {
    const nomor = sender;
    const poin = skorUser.get(nomor) || 0;

    await sock.sendMessage(from, {
        text: `📊 *SKOR KAMU*\n───────────────\n📱 Nomor: @${nomor.split('@')[0]}\n🏆 Skor: *${poin} poin*`,
        mentions: [sender]
    });

    return;
}

if (body.startsWith('.listskor')) {
  if (!isVIP(sender)) {
    await sock.sendMessage(from, {
      text: '❌ Perintah hanya bisa digunakan *Owner* dan *Vip*.'
    }, { quoted: msg });
    return;
  }

  // Hanya bisa digunakan di grup
  if (!isGroup) {
    await sock.sendMessage(from, {
      text: '❌ Perintah ini hanya bisa digunakan di dalam grup.'
    }, { quoted: msg });
    return;
  }

  // Ambil anggota grup
  const groupMetadata = await sock.groupMetadata(from);
  const groupMembers = groupMetadata.participants.map(p => p.id);

  // Filter skor yang hanya ada di grup
  const skorKeys = [...skorUser.keys()].filter(jid => groupMembers.includes(jid));

  if (skorKeys.length === 0) {
    await sock.sendMessage(from, {
      text: '📊 Belum ada data skor.'
    }, { quoted: msg });
    return;
  }

  // Urutkan berdasarkan skor tertinggi
  const sorted = skorKeys.sort((a, b) => skorUser.get(b) - skorUser.get(a));

  let teks = `╔══ 📊 *DAFTAR SKOR* 📊 ══╗\n`;

  // Tampilkan Owner dulu jika ada di grup
  if (groupMembers.includes(OWNER_NUMBER)) {
    const skorOwner = skorUser.get(OWNER_NUMBER) || 0;
    teks += `║ 👑 Owner : @${OWNER_NUMBER.split('@')[0]} → *${skorOwner} poin*\n`;
  }

  let count = 1;
  for (const jid of sorted) {
    if (jid === OWNER_NUMBER) continue; // Owner sudah ditampilkan di atas
    const nomor = jid.split('@')[0];
    const skor = skorUser.get(jid);
    teks += `║ ${count++}. @${nomor} → *${skor} poin*\n`;
  }

  teks += `╚═════════════════════╝`;

  await sock.sendMessage(from, {
    text: teks,
    mentions: [OWNER_NUMBER, ...sorted.filter(jid => jid !== OWNER_NUMBER)]
  }, { quoted: msg });
}


if (body.startsWith('.listvip')) {
  if (!isVIP(sender)) {
    await sock.sendMessage(from, {
      text: '❌ Perintah hanya bisa digunakan *Owner* dan *Vip*.'
    }, { quoted: msg });
    return;
  }

  // Cek hanya di grup
  if (!isGroup) {
    await sock.sendMessage(from, {
      text: '❌ Perintah hanya bisa digunakan di grup.'
    }, { quoted: msg });
    return;
  }

    const metadata = await sock.groupMetadata(from);
    const participants = metadata.participants;
    const groupMembers = participants.map(p => p.id);

  const allVIP = [...vipList].filter(jid => groupMembers.includes(jid));
  const vipLain = allVIP.filter(v => v !== OWNER_NUMBER);

  let teks = `╔══ 🎖️ *DAFTAR VIP* 🎖️ ══╗\n`;

  if (groupMembers.includes(OWNER_NUMBER)) {
    teks += `║ 👑 Owner : @${OWNER_NUMBER.split('@')[0]}\n`;
  }

  if (vipLain.length === 0) {
    teks += `║\n║ Belum ada VIP.\n`;
  } else {
    vipLain.forEach((jid, i) => {
      teks += `║ ${i + 1}. @${jid.split('@')[0]}\n`;
    });
  }

  teks += `╚═══════════════════╝`;

  await sock.sendMessage(from, {
    text: teks,
    mentions: [OWNER_NUMBER, ...vipLain]
  }, { quoted: msg });
}

if (body.startsWith('.setvip') && isGroup) {
  if (!isVIP(sender)) {
    return sock.sendMessage(from, {
      text: '❌ Hanya VIP atau Owner yang bisa menambahkan VIP.'
    }, { quoted: msg });
  }

  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (!mentioned || mentioned.length === 0) {
    return sock.sendMessage(from, {
      text: '❌ Tag orang yang mau dijadikan VIP.\nContoh: *.setvip @user*'
    }, { quoted: msg });
  }

  const target = mentioned[0];

  if (vipList.has(target)) {
    return sock.sendMessage(from, {
      text: `⚠️ @${target.split('@')[0]} sudah VIP.`,
      mentions: [target]
    }, { quoted: msg });
  }

  vipList.add(target);
  saveVIP();

  return sock.sendMessage(from, {
    text: `✅ @${target.split('@')[0]} sekarang adalah *VIP*!`,
    mentions: [target]
  }, { quoted: msg });
}

if (body.startsWith('.unsetvip') && isGroup) {
  if (!isVIP(sender)) {
    return sock.sendMessage(from, {
      text: '❌ Hanya VIP atau Owner yang bisa menghapus VIP.'
    }, { quoted: msg });
  }

  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (!mentioned || mentioned.length === 0) {
    return sock.sendMessage(from, {
      text: '❌ Tag orang yang mau dihapus dari VIP.\nContoh: *.unsetvip @user*'
    }, { quoted: msg });
  }

  const target = mentioned[0];

  if (target === OWNER_NUMBER) {
    return sock.sendMessage(from, {
      text: `🚫 Owner tidak bisa dihapus dari VIP!`
    }, { quoted: msg });
  }

  if (!vipList.has(target)) {
    return sock.sendMessage(from, {
      text: `⚠️ @${target.split('@')[0]} bukan VIP.`,
      mentions: [target]
    }, { quoted: msg });
  }

  vipList.delete(target);
  saveVIP();

  return sock.sendMessage(from, {
    text: `🗑️ @${target.split('@')[0]} berhasil dihapus dari *VIP*.`,
    mentions: [target]
  }, { quoted: msg });
}

if (text.trim() === '.beli') {
    const skor = skorUser.get(sender) || 0;
    const hargaVIP = 10000;

    if (vipList.has(sender)) {
        await sock.sendMessage(from, {
            text: '✅ Kamu sudah menjadi *VIP*!'
        });
        return;
    }

    if (skor < hargaVIP) {
        await sock.sendMessage(from, {
            text: `💸 *Skor kamu belum cukup!*\n\n• Skor kamu: *${skor} poin*\n• Harga VIP: *${hargaVIP} poin*\n\n💡 Main game untuk kumpulkan skor dan beli VIP.`
        });
        return;
    }

    skorUser.set(sender, skor - hargaVIP);
    simpanSkorKeFile();
    vipList.add(sender);
    saveVIP();

    await sock.sendMessage(from, {
        text: `🎉 *Selamat!*\n\nKamu telah membeli *VIP* seharga *${hargaVIP} poin*.\n\n👑 Kini kamu bisa akses fitur *VIP*`
    });
    return;
}

// 🔒 KICK – Hanya untuk VIP
if (text.startsWith('.kick')) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const BOT_NUMBER = '62882007141574@s.whatsapp.net'; // Nomor bot

    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Perintah hanya bisa digunakan di grup.' });
        return;
    }

    if (!isVIP(sender)) {
        await sock.sendMessage(from, { text: '🔐 Perintah ini hanya bisa digunakan oleh VIP.' });
        return;
    }

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = quotedMsg?.mentionedJid;

    if (!mentionedJid || mentionedJid.length === 0) {
        await sock.sendMessage(from, {
            text: '❗ Tag orang yang ingin dikeluarkan.\nContoh: *.kick @users*',
            mentions: []
        });
        return;
    }

    for (const target of mentionedJid) {
        if (target === BOT_NUMBER) {
            await sock.sendMessage(from, {
                text: '🤖 Bot tidak bisa mengeluarkan dirinya sendiri.',
                mentions: [target]
            });
            continue;
        }

        if (target === OWNER_NUMBER) {
            await sock.sendMessage(from, {
                text: '👑 Tidak bisa mengeluarkan Owner!',
                mentions: [target]
            });
            continue;
        }

        try {
            await sock.groupParticipantsUpdate(from, [target], 'remove');
            await sock.sendMessage(from, {
                text: `✅ Berhasil mengeluarkan @${target.split('@')[0]}`,
                mentions: [target]
            });
        } catch (err) {
            console.error('❌ Gagal mengeluarkan:', err);
            await sock.sendMessage(from, {
                text: `❌ Gagal mengeluarkan @${target.split('@')[0]}.\nPastikan bot adalah admin dan user masih di grup.`,
                mentions: [target]
            });
        }
    }
}

if (text.startsWith('.setskor')) {
    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Perintah hanya bisa digunakan di grup.' });
        return;
    }

    if (!isVIP(sender)) {
        await sock.sendMessage(from, {
            text: '🚫 Perintah ini hanya untuk pengguna *VIP*.'
        });
        return;
    }

    const args = text.trim().split(/\s+/);
    const angka = parseInt(args[2] || args[1]); // Bisa .setskor @user 100 atau .setskor 100

    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = quoted?.mentionedJid?.[0];
    const target = mentionedJid || quoted?.participant || (args[1]?.startsWith('@') ? args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);

    const targetJid = target || sender;

    if (targetJid === OWNER_NUMBER && sender !== OWNER_NUMBER) {
        await sock.sendMessage(from, {
            text: '🚫 Tidak bisa mengubah skor *Owner*!'
        });
        return;
    }

    if (isNaN(angka)) {
        await sock.sendMessage(from, {
            text: `❗ Format salah!\nGunakan: *.setskor 100* atau *.setskor @user 100*`
        });
        return;
    }

    skorUser.set(targetJid, angka);
    simpanSkorKeFile();

    await sock.sendMessage(from, {
        text: `✅ *Skor berhasil diatur!*\n\n👤 Pengguna: @${targetJid.split('@')[0]}\n🎯 Skor: *${angka} poin*\n🛡️ Oleh: @${sender.split('@')[0]}`,
        mentions: [targetJid, sender],
    });
}

if (text.startsWith('.mute')) {
    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Perintah hanya bisa digunakan di grup.' });
        return;
    }

    if (!isVIP(sender)) {
        await sock.sendMessage(from, { text: '❌ Hanya *VIP* yang dapat menggunakan perintah ini.' });
        return;
    }

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = quotedMsg?.mentionedJid?.[0] || quotedMsg?.participant;

    if (!mentionedJid) {
        await sock.sendMessage(from, {
            text: '❌ Tag atau reply pengguna yang ingin dimute.\nContoh: *.mute @user*',
        });
        return;
    }

    if (mentionedJid === OWNER_NUMBER) {
        await sock.sendMessage(from, { text: '❌ Owner tidak bisa dimute.' });
        return;
    }

    if (mentionedJid === BOT_NUMBER) {
        await sock.sendMessage(from, { text: '❌ Bot tidak bisa dimute.' });
        return;
    }

    mutedUsers.add(mentionedJid);
    await sock.sendMessage(from, {
        text: `🔇 @${mentionedJid.split('@')[0]} telah dimute.`,
        mentions: [mentionedJid]
    });
}

if (text.startsWith('.unmute')) {
    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Perintah hanya bisa digunakan di grup.' });
        return;
    }

    if (!isVIP(sender)) {
        await sock.sendMessage(from, { text: '❌ Hanya *VIP* yang dapat menggunakan perintah ini.' });
        return;
    }

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = quotedMsg?.mentionedJid?.[0] || quotedMsg?.participant;

    if (!mentionedJid) {
        await sock.sendMessage(from, {
            text: '❌ Tag atau reply pengguna yang ingin di-unmute.\nContoh: *.unmute @user*',
        });
        return;
    }

    if (mutedUsers.has(mentionedJid)) {
        mutedUsers.delete(mentionedJid);
        await sock.sendMessage(from, {
            text: `✅ @${mentionedJid.split('@')[0]} telah di-unmute.`,
            mentions: [mentionedJid]
        });
    } else {
        await sock.sendMessage(from, { text: '⚠️ User ini tidak sedang dimute.' });
    }
}



                // ✅ FITUR TEBAK-AKU
        const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    if (textMessage.toLowerCase() === '.tebak-aku') {
    const soal = soalTebakan[Math.floor(Math.random() * soalTebakan.length)];

    const sent = await sock.sendMessage(from, {
        text: `🎮 *TEBAK-TEBAKAN DIMULAI!*\n\n🧠 *Soal:* _${soal.soal}_\n\n⏱️ Jawab dalam 30 detik!\n\n_Reply pesan ini untuk menjawab._`
    });

    const timeout = setTimeout(() => {
        sesiTebakan.delete(sent.key.id);
        sock.sendMessage(from, {
            text: `⏰ Waktu habis!\nJawaban yang benar adalah: *${soal.jawaban}*`
        });
    }, 30000);

    sesiTebakan.set(sent.key.id, { jawaban: soal.jawaban.toLowerCase(), timeout });
    return;
}

// 🧠 Cek jawaban berdasarkan reply
if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    const replyId = msg.message.extendedTextMessage.contextInfo.stanzaId;
    const sesi = sesiTebakan.get(replyId);

    if (sesi) {
        clearTimeout(sesi.timeout);
        sesiTebakan.delete(replyId);

        const userAnswer = textMessage.trim().toLowerCase();
        if (userAnswer === sesi.jawaban) {
            tambahSkor(sender, 15);
            await sock.sendMessage(from, {
                text: `✅ *Benar!* Jawabanmu adalah *${userAnswer}* 🎉\n🏆 Kamu mendapatkan *15 poin!*\n\nMau lagi? Ketik *.tebak-aku*`
        });

        } else {
            await sock.sendMessage(from, {
                text: `❌ *Salah!* Jawabanmu: *${userAnswer}*\n✅ Jawaban benar: *${sesi.jawaban}*\n\nCoba lagi? Ketik *.tebak-aku*`
            });
        }
        return;
    }
}

        if (text.trim() === '.kuis') {
    const soal = soalKuis[Math.floor(Math.random() * soalKuis.length)];
    const teksSoal = `🎓 *KUIS DIMULAI!*\n\n📌 *Soal:* ${soal.soal}\n\n${soal.pilihan.join('\n')}\n\n✍️ Jawab dengan huruf A/B/C/D dengan mereply pesan ini\n⏱️ Waktu 30 detik!`;

    const sent = await sock.sendMessage(from, { text: teksSoal });

    const timeout = setTimeout(() => {
        sesiKuis.delete(sent.key.id);
        sock.sendMessage(from, {
            text: `⏰ Waktu habis!\nJawaban yang benar adalah: *${soal.jawaban}*`
        });
    }, 30000);

    sesiKuis.set(sent.key.id, { jawaban: soal.jawaban.toUpperCase(), timeout });
    return;
}

// 🔍 CEK JAWABAN KUIS (Reply)
if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    const replyId = msg.message.extendedTextMessage.contextInfo.stanzaId;
    const sesi = sesiKuis.get(replyId);

    if (sesi) {
        clearTimeout(sesi.timeout);
        sesiKuis.delete(replyId);

        const userAnswer = text.trim().toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(userAnswer)) {
            if (userAnswer === sesi.jawaban) {
                tambahSkor(sender, 10);
                await sock.sendMessage(from, {
                    text: `✅ *Benar!* Jawabanmu adalah *${userAnswer}* 🎉\n🏆 Kamu mendapatkan *10 poin!*\n\nMau lagi? Ketik *.kuis*`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ *Salah!* Jawabanmu: *${userAnswer}*\n✅ Jawaban benar: *${sesi.jawaban}*\nKetik *.kuis* untuk mencoba lagi.`
                });
            }
        }
        return;
    }
}

if (text.trim() === '.susunkata') {
    const kata = soalSusunKata[Math.floor(Math.random() * soalSusunKata.length)];
    const acak = kata.split('').sort(() => Math.random() - 0.5).join('');

    const sent = await sock.sendMessage(from, {
        text: `🎮 *SUSUN KATA DIMULAI!*\n\n🔤 Huruf Acak: _${acak}_\n\n⏱️ Susun huruf menjadi kata yang benar dalam 30 detik!\n_Reply pesan ini untuk menjawab._`
    });

    const timeout = setTimeout(() => {
        sesiSusunKata.delete(sent.key.id);
        sock.sendMessage(from, {
            text: `⏰ Waktu habis!\nJawaban yang benar adalah: *${kata}*`
        });
    }, 30000);

    sesiSusunKata.set(sent.key.id, { jawaban: kata.toLowerCase(), timeout });
    return;
}

// ✅ CEK JAWABAN SUSUN KATA (Reply)
if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    const replyId = msg.message.extendedTextMessage.contextInfo.stanzaId;
    const sesi = sesiSusunKata.get(replyId);

    if (sesi) {
        clearTimeout(sesi.timeout);
        sesiSusunKata.delete(replyId);

        const jawabanUser = text.trim().toLowerCase();
        if (jawabanUser === sesi.jawaban) {
             tambahSkor(sender, 20);
            await sock.sendMessage(from, {
                text: `✅ *Benar!* Jawabanmu adalah *${userAnswer}* 🎉\n🏆 Kamu mendapatkan *20 poin!*\n\nMau lagi? Ketik *.susunkata*`
            });
        } else {
            await sock.sendMessage(from, {
                text: `❌ *Salah!* Jawabanmu: *${jawabanUser}*\n✅ Jawaban benar: *${sesi.jawaban}*\n\nCoba lagi? Ketik *.susunkata*`
            });
        }
        return;
    }
}

if (text === '.family100') {
    if (sesiFamily100.has(from)) {
        await sock.sendMessage(from, {
            text: `⚠️ *Permainan Sedang Berlangsung!*\n━━━━━━━━━\nMohon selesaikan permainan sebelumnya terlebih dahulu.\nBalas (reply) pertanyaan yang muncul untuk menjawab.`
        });
        return;
    }

    const soal = soalFamily100[Math.floor(Math.random() * soalFamily100.length)];
    const kosong = soal.jawaban.map((_, i) => `*${i + 1}.*`).join("\n");

    const pesanPertanyaan = `🎮 *Family 100 Dimulai!*\n━━━━━━━━━\n🧠 *Pertanyaan:*\n${soal.pertanyaan}\n\n📋 *Jawaban:*\n${kosong}\n\n⏳ *Waktu:* 60 detik\n↩️ *Balas pesan ini untuk menjawab.*`;

    const sent = await sock.sendMessage(from, { text: pesanPertanyaan });

    const timeout = setTimeout(async () => {
        const sesi = sesiFamily100.get(from);
        const jawabanBenar = soalFamily100.find(s => s.pertanyaan === sesi.pertanyaan).jawaban;

        const jawabanAkhir = jawabanBenar.map((j, i) => {
            const user = sesi.jawabanLolos[i];
            if (user) {
                return `*${i + 1}.* ✅ ${j} (@${user})`;
            } else {
                return `*${i + 1}.* ❌ ${j}`;
            }
        }).join("\n");

        await sock.sendMessage(from, {
            text: `⏱️ *Waktu Habis!*\n🎉 *Family 100 Selesai!*\n━━━━━━━━━\n🧠 *Pertanyaan:*\n${soal.pertanyaan}\n\n📋 *Jawaban Lengkap:*\n${jawabanAkhir}\n\n🎊 *Terima kasih telah bermain!*`,
            mentions: sesi.jawabanLolos.filter(Boolean).map(u => u + '@s.whatsapp.net')
        });

        sesiFamily100.delete(from);
    }, 60000); // 30 detik

    sesiFamily100.set(from, {
        pesanId: sent.key.id,
        pertanyaan: soal.pertanyaan,
        jawaban: Array(soal.jawaban.length).fill(null),
        jawabanLolos: Array(soal.jawaban.length).fill(null),
        timeout
    });

    return;
}

// Tangani jawaban
if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    const sesi = sesiFamily100.get(from);
    if (sesi && msg.message.extendedTextMessage.contextInfo.stanzaId === sesi.pesanId) {
        const userJawab = text.trim().toLowerCase();
        const sender = msg.key.participant || msg.key.remoteJid;
        const userTag = sender.split('@')[0];

        const index = soalFamily100.find(s => s.pertanyaan === sesi.pertanyaan)
            .jawaban.findIndex(j => j.toLowerCase() === userJawab);

        if (index !== -1 && !sesi.jawaban[index]) {
    sesi.jawaban[index] = soalFamily100.find(s => s.pertanyaan === sesi.pertanyaan).jawaban[index];
    sesi.jawabanLolos[index] = userTag;

    tambahSkor(sender, 5); // ✅ Tambahkan poin 5 jika benar

    const isi = sesi.jawaban.map((j, i) => {
        return `*${i + 1}.* ${j ? `✅ ${j} (@${sesi.jawabanLolos[i]})` : ''}`;
    }).join("\n");


            await sock.sendMessage(from, {
                text: `🎮 *Jawaban Diterima!*\n━━━━━━━━━\n🧠 *Pertanyaan:* ${sesi.pertanyaan}\n\n📋 *Jawaban Saat Ini:*\n${isi}\n\n✅ *Jawaban "${userJawab}" benar!*\n🎁 +5 poin untuk @${userTag}\n↩️ Balas pesan ini untuk menjawab.`,
                mentions: [sender]
            });

            if (sesi.jawaban.every(j => j !== null)) {
                clearTimeout(sesi.timeout);
                sesiFamily100.delete(from);
                await sock.sendMessage(from, {
                    text: `🎉 *Family 100 Selesai!*\n📢 *Pertanyaan:* ${sesi.pertanyaan}\n\n📋 *Jawaban Akhir:*\n${isi}\n\n🎊 Terima kasih sudah bermain!`
                });
            }
        } else {
            const isi = sesi.jawaban.map((j, i) => {
                return `*${i + 1}.* ${j ? `${j} (@${sesi.jawabanLolos[i]})` : ''}`;
            }).join("\n");

            await sock.sendMessage(from, {
                text: `🚫 *Jawaban Salah!*\n━━━━━━━━━\n🧠 *Pertanyaan:* ${sesi.pertanyaan}\n\n📋 *Jawaban Saat Ini:*\n${isi}\n\n❌ *"${userJawab}" tidak ada dalam daftar jawaban.*\n↩️ Balas pesan ini untuk menjawab.`,
                mentions: [sender]
            });
        }
        return;
    }
}

if (text.trim() === '.judi') {
    const skor = skorUser.get(sender) || 0;

    if (skor < 30) {
        await sock.sendMessage(from, {
            text: `🚫 *Skor kamu terlalu rendah!*\n━━━━━━━━━━━━━━━\n📉 Skor saat ini: *${skor} poin*\n🔒 Minimal skor untuk ikut judi adalah *30 poin*\n\n💡 Ayo main kuis atau tebak-tebakan dulu untuk kumpulkan skor!`,
            mentions: [sender]
        });
        return;
    }

    const kirim = await sock.sendMessage(from, {
        text: `🎰 *GAME JUDI GANJIL / GENAP*\n━━━━━━━━━━━━━━━━━━\n🧠 *Cara Main:*\nPilih salah satu:\n\n🔴 *Ganjil*\n🔵 *Genap*\n\n📥 *Balas pesan ini* untuk bermain\n\n🎁 Hadiah:\n• Benar ➜ +50 poin\n• Salah ➜ -30 poin\n━━━━━━━━━━━━━━━━━━\n💰 Skor kamu saat ini: *${skor} poin*\n🎲 Ayo uji keberuntunganmu!`,
        mentions: [sender]
    });

    sesiJudi.set(sender, { msgId: kirim.key.id });
    return;
}


if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    const replyId = msg.message.extendedTextMessage.contextInfo.stanzaId;
    const sesi = sesiJudi.get(sender);

    if (sesi && sesi.msgId === replyId) {
        const pilihan = text.trim().toLowerCase();
        const hasilAcak = Math.floor(Math.random() * 100) + 1;
        const hasil = hasilAcak % 2 === 0 ? 'genap' : 'ganjil';

        if (pilihan !== 'ganjil' && pilihan !== 'genap') {
            await sock.sendMessage(from, {
                text: `🚫 *Pilihan tidak valid!*\nBalas hanya dengan *ganjil* atau *genap* ya.`,
                mentions: [sender]
            });
            return;
        }

        sesiJudi.delete(sender);

        const benar = pilihan === hasil;
        const poinSebelum = skorUser.get(sender) || 0;
        let poinTambahan = 0;

        if (benar) {
            poinTambahan = 50;
        } else {
            poinTambahan = -30;
        }

        tambahSkor(sender, poinTambahan);
        const poinSesudah = skorUser.get(sender) || 0;

        let pesan = `🎰 *HASIL JUDI GANJIL / GENAP*\n━━━━━━━━━━━━━━━━━━\n📥 Tebakanmu: *${pilihan.toUpperCase()}*\n🎲 Angka: *${hasilAcak}* ➜ *${hasil.toUpperCase()}*\n`;

        if (benar) {
            pesan += `\n🎉 *Kamu BENAR!* +50 poin 💰\n✨ Keberuntungan sedang berpihak padamu!`;
        } else {
            pesan += `\n💔 *Salah!* -30 poin\n😹Yahaha kasihan kalah, coba lagi`;
        }

        pesan += `\n\n🏅 Skor kamu sekarang: *${poinSesudah} poin*\n━━━━━━━━━━━━━━━━━━\n📌 *Ketik .judi* untuk main lagi!`;

        await sock.sendMessage(from, {
            text: pesan,
            mentions: [sender]
        });

        return;
    }
}

if (text.startsWith('.ttmp3')) {
    const tiktokUrl = text.split(' ')[1];
    const userTag = `@${sender.split('@')[0]}`;

    if (!tiktokUrl || !tiktokUrl.includes("tiktok.com")) {
        await sock.sendMessage(from, {
            text: "❌ Link TikTok tidak valid.\nGunakan: *.ttmp3 <link TikTok>*"
        });
        return;
    }

    await sock.sendMessage(from, {
        text: `🎵 Mengambil audio TikTok... ${userTag}`,
        mentions: [sender]
    });

    try {
        const { data } = await axios.get(`https://tikwm.com/api/`, {
            params: { url: tiktokUrl }
        });

        const audioURL = data?.data?.music;

        if (!audioURL) {
            throw new Error("❌ Gagal ambil audio dari TikTok");
        }

        const audioRes = await axios.get(audioURL, { responseType: 'arraybuffer' });
        const audioBuffer = Buffer.from(audioRes.data, 'binary');

        await sock.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/mp4', // bisa juga 'audio/mpeg'
            ptt: false
        });

        console.log(`✅ Audio TikTok berhasil dikirim ke ${from}`);
    } catch (err) {
        console.error('❌ ERROR TTMP3:', err.message);
        await sock.sendMessage(from, {
            text: "❌ Gagal mengunduh audio TikTok. Coba link lain atau nanti lagi."
        });
    }

    return;
}


if (text.startsWith('.wm')) {
    const tiktokUrl = text.split(' ')[1];
    const userTag = `@${sender.split('@')[0]}`;

    if (!tiktokUrl || !tiktokUrl.includes("tiktok.com")) {
        await sock.sendMessage(from, {
            text: "❌ Link TikTok tidak valid.\nGunakan: *.wm <link TikTok>*"
        });
        return;
    }

    await sock.sendMessage(from, {
        text: `⏳ Mengambil video TikTok... ${userTag}`,
        mentions: [sender]
    });

    try {
        const { data } = await axios.get(`https://tikwm.com/api/`, {
            params: { url: tiktokUrl }
        });

        if (!data || !data.data || !data.data.play) {
            throw new Error("❌ Gagal parsing data dari API");
        }

        const videoURL = data.data.play;

        const videoRes = await axios.get(videoURL, { responseType: 'arraybuffer' });
        const videoBuffer = Buffer.from(videoRes.data, 'binary');

        await sock.sendMessage(from, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption: `✅ *Video tanpa watermark*\nUntuk: ${userTag}`,
            mentions: [sender]
        });

        console.log(`✅ Video berhasil dikirim ke ${from}`);
    } catch (err) {
        console.error('❌ ERROR TikTok API:', err.message);
        await sock.sendMessage(from, {
            text: "❌ Gagal mengunduh video TikTok.\nSilakan coba dengan link lain atau nanti."
        });
    }

    return;
}



        // 🧊 STIKER
        if (text.trim().toLowerCase() === '.stiker') {
            console.log(`📥 Permintaan stiker dari ${from}...`);
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const imageDirect = msg.message?.imageMessage;
            const imageQuoted = quoted?.imageMessage;

            const messageForMedia = imageDirect
                ? msg
                : imageQuoted
                    ? {
                        ...msg,
                        message: {
                            imageMessage: imageQuoted
                        }
                    }
                    : null;

            if (!messageForMedia) {
                await sock.sendMessage(from, { text: "❌ Tidak ada gambar untuk dijadikan stiker" });
                return;
            }

            try {
                console.log("📥 Mengunduh media...");
                const mediaBuffer = await downloadMediaMessage(messageForMedia, "buffer", {}, { logger: console });

                const sticker = new Sticker(mediaBuffer, {
                    pack: 'Bot Jarr',
                    author: 'Fajar',
                    type: 'FULL',
                    quality: 100
                });

                await sock.sendMessage(from, await sticker.toMessage());
                console.log(`✅ Stiker berhasil dikirim ke ${from}`);
            } catch (err) {
                console.error("❌ Gagal membuat stiker:", err);
                await sock.sendMessage(from, { text: "❌ Gagal membuat stiker. Pastikan gambar tidak rusak dan coba lagi." });
            }

            return;
        }

                // 📢 TAG SEMUA ANGGOTA GRUP
        if (text.trim() === '.tagall') {
            if (!msg.key.remoteJid.endsWith('@g.us')) {
                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di dalam grup.' });
                return;
            }

            try {
                const metadata = await sock.groupMetadata(from);
                const participants = metadata.participants;

                const mentions = participants.map(p => p.id);
                const teksMention = participants.map(p => `- @${p.id.split('@')[0]}`).join('\n');

                await sock.sendMessage(from, {
                    text: `📢 *Tag All* (${participants.length} anggota):\n\n${teksMention}`,
                    mentions
                });

                console.log(`📢 Men-tag ${participants.length} anggota grup`);
            } catch (e) {
                console.error('❌ Gagal tagall:', e);
                await sock.sendMessage(from, { text: '❌ Gagal mengambil data anggota grup.' });
            }

            return;
        }

if (text.startsWith('.kirimskor')) {
    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa dipakai di grup.' });
        return;
    }

    const args = text.trim().split(/\s+/);
    const jumlah = parseInt(args[2] || args[1]); // Bisa .kirimskor @user 100 atau .kirimskor 100 (kalau reply)
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const target = quoted?.mentionedJid?.[0] || quoted?.participant;

    if (!target || isNaN(jumlah) || jumlah <= 0) {
        await sock.sendMessage(from, {
            text: `❗ *Format salah!*\n\nContoh:\n.kirimskor @user 100*`
        });
        return;
    }

    const pengirim = sender;
    const skorPengirim = skorUser.get(pengirim) || 0;

    if (skorPengirim < jumlah) {
        await sock.sendMessage(from, {
            text: `Skormu tidak cukup!\n💰 Skor kamu: *${skorPengirim}*`
        });
        return;
    }

    // Proses transfer
    skorUser.set(pengirim, skorPengirim - jumlah);
    skorUser.set(target, (skorUser.get(target) || 0) + jumlah);
    simpanSkorKeFile();

    await sock.sendMessage(from, {
        text: `🎁 *Skor Terkirim!*\n\n👤 Dari: @${pengirim.split('@')[0]}\n🎯 Ke: @${target.split('@')[0]}\n💸 Jumlah: *${jumlah} poin*`,
        mentions: [pengirim, target]
    });
}


if (text === '.dwfoto') {
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = quotedInfo?.quotedMessage;
    const targetSender = quotedInfo?.participant;

    if (!quoted || (!quoted.imageMessage && !quoted.viewOnceMessageV2)) {
        await sock.sendMessage(from, {
            text: '❌ Reply pesan foto sekali lihat dengan perintah ini.\nContoh: reply lalu *.dwfoto*',
            mentions: [sender]
        });
        return;
    }

    await sock.sendMessage(from, { text: '⏳ Mohon tunggu sebentar, sedang mengambil foto...' });

    try {
        const mediaBuffer = await downloadMediaMessage(
            { message: quoted, key: { remoteJid: from, fromMe: false, id: quotedInfo.stanzaId, participant: targetSender } },
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.reuploadRequest }
        );

        await sock.sendMessage(from, {
            image: mediaBuffer,
            caption: '📸 Foto sekali lihat berhasil di ambil.',
            mentions: [sender]
        });
    } catch (err) {
        console.error('❌ Gagal mengunduh foto sekali lihat:', err);
        await sock.sendMessage(from, {
            text: '❌ Gagal mengambil foto. Pastikan kamu mereply foto sekali lihat.',
            mentions: [sender]
        });
    }

    return;
}

// 📥 DWVIDEO – Ambil Video Sekali Lihat
if (text === '.dwvideo') {
    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const targetMsg = quoted?.quotedMessage;
    const targetSender = quoted?.participant;

    if (!targetMsg || !targetMsg.videoMessage || !targetMsg.videoMessage.viewOnce) {
        await sock.sendMessage(from, {
            text: '❌ Balas video sekali lihat dengan perintah *.dwvideo*.',
            mentions: [sender]
        });
        return;
    }

    // Kirim info loading dulu
    await sock.sendMessage(from, { text: '⏳ Mohon tunggu sebentar, sedang mengambil video...' });

    try {
        const mediaBuffer = await downloadMediaMessage(
            { message: targetMsg, key: { remoteJid: from, fromMe: false, id: quoted.stanzaId, participant: targetSender } },
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.reuploadRequest }
        );

        await sock.sendMessage(from, {
            video: mediaBuffer,
            caption: '📸 Video sekali lihat berhasil di ambil.',
            mentions: [sender]
        });
    } catch (err) {
        console.error('❌ Gagal mengambil video sekali lihat:', err);
        await sock.sendMessage(from, {
            text: '❌ Gagal mengambil video. Pastikan kamu mereply video sekali lihat.',
            mentions: [sender]
        });
    }

    return;
}

if (text.trim() === '.off') {
    if (sender !== OWNER_NUMBER) {
        await sock.sendMessage(from, {
            text: '❌ Hanya *Owner* yang bisa mematikan bot di grup ini.'
        });
        return;
    }

    grupAktif.set(from, false);
    simpanGrupAktif();

    const waktu = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    await sock.sendMessage(from, {
        text: `⚠️ *Bot Dimatikan*\n\n🔴 Status: *OFF*\n📅 Tanggal: ${waktu}\n\n👑 Owner: @6283836348226`,
        mentions: ['6283836348226@s.whatsapp.net']
    });
    return;
}


if (text.trim() === '.on') {
    if (sender !== OWNER_NUMBER) {
        await sock.sendMessage(from, {
            text: '❌ Hanya *Owner* yang bisa menyalakan bot di grup ini.'
        });
        return;
    }

    grupAktif.set(from, true);
    simpanGrupAktif();

    const waktu = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    await sock.sendMessage(from, {
        text: `✅ *Bot Aktif*\n\n🟢 Status: *ON*\n📅 Tanggal: ${waktu}\n\n👑 Owner: @6283836348226`,
        mentions: ['6283836348226@s.whatsapp.net']
    });
    return;
}

const angkaToEmoji = {
    '1': '✌️',
    '2': '✊',
    '3': '✋'
};

if (text.startsWith('.suit')) {
    const sender = msg.key.participant || msg.key.remoteJid;

    if (!from.endsWith('@g.us')) {
        await safeSend(from, { text: '❌ Hanya bisa digunakan di grup.' });
        return;
    }

    if (cooldownSuit.has(sender)) {
        await safeSend(from, { text: '⏳ Tunggu 30 detik sebelum main suit lagi!' });
        return;
    }

    if (suitGame.has(from)) {
        await safeSend(from, { text: '⚠️ Masih ada game suit yang aktif di grup ini!' });
        return;
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = quoted?.mentionedJid?.[0];

    if (!mentioned || mentioned === sender) {
        await safeSend(from, {
            text: '❗ Tag lawan main kamu!\nContoh: *.suit @user*',
        });
        return;
    }

    suitGame.set(from, {
        pemain1: sender,
        pemain2: mentioned,
        pilihan: {},
        timeout: setTimeout(() => {
            suitGame.delete(from);
            safeSend(from, { text: '⏰ Waktu habis, suit dibatalkan!' });
        }, 60000)
    });

    await safeSend(from, {
        text: `🎮 *SUIT DIMULAI!*\n\n@${sender.split('@')[0]} vs @${mentioned.split('@')[0]}\n\nSilakan kirim angka berikut ke chat bot (chat pribadi):\n\n1 = ✌️ Gunting\n2 = ✊ Batu\n3 = ✋ Kertas\n\n⏳ Waktu 1 menit!`,
        mentions: [sender, mentioned]
    });

    try {
        await safeSend(mentioned, {
            text: `👋 Kamu ditantang main *SUIT* oleh @${sender.split('@')[0]}!\n\nKirim angka ke sini:\n1 = ✌️ Gunting\n2 = ✊ Batu\n3 = ✋ Kertas\n\n⏳ Waktu 1 menit!`,
            mentions: [sender]
        });

        await safeSend(sender, {
            text: `✅ Tantangan terkirim!\nSilakan pilih angka disini:\n1 = ✌️ Gunting\n2 = ✊ Batu\n3 = ✋ Kertas`
        });
    } catch (err) {
        console.log('❌ Gagal kirim notifikasi suit:', err.message);
    }

    cooldownSuit.add(sender);
    setTimeout(() => cooldownSuit.delete(sender), 30_000); // 30 detik cooldown
}

if (!text.startsWith('.') && ['1', '2', '3'].includes(text.trim()) && !msg.key.remoteJid.endsWith('@g.us')) {
    const sender = msg.key.remoteJid;
    const angka = text.trim();
    const pilihan = angkaToEmoji[angka];

    let grupKey = null;
    for (const [grup, game] of suitGame.entries()) {
        if (game.pemain1 === sender || game.pemain2 === sender) {
            grupKey = grup;
            break;
        }
    }

    if (!grupKey) {
        await safeSend(sender, { text: '⚠️ Kamu tidak sedang ikut game suit.' });
        return;
    }

    const game = suitGame.get(grupKey);
    if (game.pilihan[sender]) {
        await safeSend(sender, { text: '❗ Kamu sudah memilih!' });
        return;
    }

    game.pilihan[sender] = pilihan;
    await safeSend(sender, { text: `✅ Pilihan kamu tercatat: *${pilihan}*` });

    if (game.pilihan[game.pemain1] && game.pilihan[game.pemain2]) {
        clearTimeout(game.timeout);

        const p1 = game.pilihan[game.pemain1];
        const p2 = game.pilihan[game.pemain2];
        const hasil = getPemenang(p1, p2);

        let teksHasil = `🎮 *HASIL SUIT!*\n\n`;
        teksHasil += `👤 @${game.pemain1.split('@')[0]} memilih: ${p1}\n`;
        teksHasil += `👤 @${game.pemain2.split('@')[0]} memilih: ${p2}\n\n`;

        if (hasil === 'seri') {
            teksHasil += '🤝 Hasil: *Seri!*';
        } else {
            const pemenang = hasil === 'p1' ? game.pemain1 : game.pemain2;
            const kalah = hasil === 'p1' ? game.pemain2 : game.pemain1;

            const skorMenang = (skorUser.get(pemenang) || 0) + 20;
            const skorKalah = Math.max((skorUser.get(kalah) || 0) - 10, 0);

            skorUser.set(pemenang, skorMenang);
            skorUser.set(kalah, skorKalah);
            simpanSkorKeFile();

            teksHasil += `🏆 Pemenang: @${pemenang.split('@')[0]} (+20 poin)\n`;
            teksHasil += `😢 Kalah: @${kalah.split('@')[0]} (-10 poin)`;
        }

        await safeSend(grupKey, {
            text: teksHasil,
            mentions: [game.pemain1, game.pemain2]
        });

        suitGame.delete(grupKey);
    }
}

function getPemenang(p1, p2) {
    if (p1 === p2) return 'seri';
    if ((p1 === '✊' && p2 === '✌️') || (p1 === '✋' && p2 === '✊') || (p1 === '✌️' && p2 === '✋')) return 'p1';
    return 'p2';
}


if (text.startsWith('.gay')) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const sender = msg.key.participant || msg.key.remoteJid;
    const target = mentioned || sender;
    const nama = target.split('@')[0];
    const persen = Math.floor(Math.random() * 101); // 0–100%

    const teks = `╭─🌈 *GAY KAUM PELANGI* 🌈─╮
│
│ 👤 @${nama}
│ 🏳️‍🌈 Tingkat Gay: *${persen}%*
│
│ ${persen < 30 ? '🧍‍♂️ Masih aman lah ya' :
     persen < 60 ? '😏 Udah belok nih' :
     persen < 85 ? '💅 Parah kalau ini mah...' :
     '👑 SELAMAT MANUSIA GAY'}
│
╰──────────────────╯`;

    await sock.sendMessage(from, {
        text: teks,
        mentions: [target]
    });
}

if (text.startsWith('.cantik')) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const sender = msg.key.participant || msg.key.remoteJid;
    const target = mentioned || sender;
    const nama = target.split('@')[0];
    const persen = Math.floor(Math.random() * 100) + 1;

    const teks = `╭─💄 *CANTIK METER 30000* 💄─╮
│
│ 👤 @${nama}
│ 💖 Skor Cantik: *${persen}%*
│
│ ${persen < 30 ? '😢 Cantik itu relatif' :
     persen < 60 ? '😊 Senyum terus yaa' :
     persen < 85 ? '😍 Cantiknya masyaalah' :
     '✨ DEWI TURUN KE BUMI'}
│
╰────────────────────────╯`;

    await sock.sendMessage(from, {
        text: teks,
        mentions: [target]
    });
}

if (text.startsWith('.ganteng')) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const sender = msg.key.participant || msg.key.remoteJid;
    const target = mentioned || sender;
    const nama = target.split('@')[0];
    const persen = Math.floor(Math.random() * 100) + 1;

    const teks = `╭─😎 *GANTENG LEVEL CHECK* 😎─╮
│
│ 👤 @${nama}
│ 🪞 Skor Ganteng: *${persen}%*
│
│ ${persen < 30 ? '😭 Gantengnya ketuker waktu lahir' :
     persen < 60 ? '🙂 Lumayan ga burik amat' :
     persen < 85 ? '😎 Bikin cewek klepek klepek' :
     '🔥 LEVEL MAX! GANTENG PARAH!!'}
│
╰────────────────────────╯`;

    await sock.sendMessage(from, {
        text: teks,
        mentions: [target]
    });
}

if (text.startsWith('.lesbi')) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const sender = msg.key.participant || msg.key.remoteJid;
    const target = mentioned || sender;
    const nama = target.split('@')[0];
    const persen = Math.floor(Math.random() * 100) + 1;

    const teks = `╭─🌈 *LESBIAN DETECTOR* 🌈─╮
│
│ 👤 @${nama}
│ 🎯 Persentase: *${persen}%*
│
│ ${persen < 30 ? '😌 Masih suka cowok kok' :
     persen < 60 ? '😏 Cewekpun di embat' :
     persen < 85 ? '😳 Jauhin aja bahaya ni orang' :
     '💥 100% LESBI POWER AKTIF!'}
│
╰───────────────────────╯`;

    await sock.sendMessage(from, {
        text: teks,
        mentions: [target]
    });
}

if (text.startsWith('.jodoh')) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    if (!mentioned || mentioned.length < 2) {
        await sock.sendMessage(from, {
            text: '❗ Format salah!\nGunakan: *.jodoh @user1 @user2*',
        }, { quoted: msg });
        return;
    }

    const [user1, user2] = mentioned;
    const nama1 = user1.split('@')[0];
    const nama2 = user2.split('@')[0];
    const persen = Math.floor(Math.random() * 101); // 0 - 100
    let komentar = '';

    if (persen < 20) {
        komentar = '💔 Seperti langit & bumi...';
    } else if (persen < 40) {
        komentar = '😬 Masih bisa sahabatan aja deh.';
    } else if (persen < 60) {
        komentar = '🙂 Lumayan cocok, tapi butuh usaha!';
    } else if (persen < 80) {
        komentar = '😍 Udah cocok bener ini, lanjut chat ya!';
    } else {
        komentar = '💘 JODOH SEJATI! Langsung akad nih!';
    }

    const hasil = `
╔══💞 *Kecocokan Jodoh* 💞══╗

👩 @${nama1}
👨 @${nama2}

💓 Tingkat kecocokan:
💯 *${persen}%*

📝 Komentar:
${komentar}

╚═══════════════════════╝
    `;

    await sock.sendMessage(from, {
        text: hasil,
        mentions: [user1, user2]
    }, { quoted: msg });
}

if (body === '.truth') {
  const truthText = truthList[Math.floor(Math.random() * truthList.length)];
  const imagePath = './truthordare.png';
  await sock.sendMessage(from, {
    image: { url: imagePath },
    caption: `🎯 *Truth Challenge*\n\n${truthText}`
  }, { quoted: msg });
}

if (body === '.dare') {
  const dareText = dareList[Math.floor(Math.random() * dareList.length)];
  const imagePath = './truthordare.png';
  await sock.sendMessage(from, {
    image: { url: imagePath },
    caption: `🔥 *Dare Challenge*\n\n${dareText}`
  }, { quoted: msg });
}



if (text.trim() === '.info') {
    await sock.sendMessage(from, {
        text: `╭──〔 *ℹ️ INFO BOT JARR* 〕──╮
│ 🤖 *Nama Bot* : JARR BOT AI
│ 👨‍💻 *Owner*   : Fajar Aditya Pratama
│ 💡 *Fungsi*   : AI Asisten, Game, Tools Media
│ 🛠️ *Bahasa*  : Node.js (Baileys API)
│ 🌐 *Versi*    : 1.0.0 Beta
│ 🧠 *Model AI* : GPT-3.5-turbo
│ 🕒 *Aktif*    : 24 Jam Nonstop
│
│ 🚀 *Fitur Unggulan* :
│   • AI Chatting 🔮
│   • Game Kuis & Tebakan 🎮
│   • Download YouTube 🎵 & TikTok 🎥
│   • Download Foto/Video sekali lihat 📸
│   • Stiker Generator 🖼️
│   • Tools Admin Grup 👥
│
│ 🔗 *Kontak Owner*: wa.me/6283836348226
│ 🌟 *Powered by*: Baileys + Fajar
╰────────────────────────╯`
    });
    return;
}


if (text.trim() === '.menu') {
    const waktu = new Date();
    const tanggal = waktu.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    await sock.sendMessage(from, {
        text: `╭─〔 *🤖 BOT JARR MENU* 〕─╮
│
├ 🎮 *Game* 
│ • .kuis → Kuis pilihan ganda
│ • .suit → Main suit lawan teman
│ • .judi → Tebak ganjil / genap
│ • .truth → Jawab jujur
│ • .dare → Lakukan tantangan
│ • .tebak-aku → Tebakan lucu
│ • .susunkata → Susun huruf
│ • .family100 → Jawaban terbanyak
│
├ 🏳️‍🌈 *Fitur Lucu*
│ • .gay @user → Seberapa gay?
│ • .lesbi @user → Seberapa lesbi?
│ • .cantik @user → Seberapa cantik?
│ • .ganteng @user → Seberapa ganteng?
│ • .jodoh @user @user → Cocoklogi cinta
│
├ 🧠 *AI Assistant*
│ • .ai <pertanyaan> → Tanya ke AI
│
├ 🖼️ *Media*
│ • .stiker → Ubah gambar jadi stiker
│ • .dwfoto → Unduh foto sekali lihat
│ • .dwvideo → Unduh video sekali lihat
│
├ 🎥 *TikTok Tools*
│ • .ttmp3 <link> → Unduh mp3 TikTok
│ • .wm <link> → Unduh tanpa watermark
│
├ 👥 *Fitur Grup*
│ • .tagall → Mention semua member
│
├ 📊 *Skor Game*
│ • .skor → Lihat skor kamu
│ • .kirimskor → Kirim skor ke teman
│
├ 📋 *Info*
│ • .beli → Beli VIP
│ • .info → Info bot & owner
│ • .menu → Tampilkan menu ini
│
╰─📅 ${tanggal}

╭─〔 *🔐 FITUR VIP / OWNER* 〕─╮
│
├ 👥 *Grup VIP*
│ • .kick @user → Kick user
│ • .mute @user → Mute user
│ • .unmute @user → Buka mute
│
├ 📊 *Skor Khusus*
│ • .setskor → Atur skor user
│
├ 👑 *VIP Control*
│ • .setvip @user → Jadikan VIP
│ • .unsetvip @user → Cabut VIP
│ • .listvip → Daftar VIP
│ • .listskor → Daftar SKOR
│
├ ⚙️ *Bot Control* (Owner Only)
│ • .on → Aktifkan bot
│ • .off → Nonaktifkan bot
│
╰─👑 Owner: @${OWNER_NUMBER?.split('@')[0] || '6283836348226'}
        `,
        mentions: [OWNER_NUMBER]
    });
    return;
}


// 🤖 AI Chat pakai .ai
    if (text.startsWith('.ai')) {
    const pertanyaan = text.slice(3).trim();

    if (!pertanyaan) {
        await sock.sendMessage(from, { text: "❗Gunakan .ai *pertanyaanmu*" });
        return;
    }

    const aiReply = await getAIReply(pertanyaan);
    await sock.sendMessage(from, { text: aiReply });
    return;
}


    });
    }

// Paling bawah index.js
// Jalankan bot
startBot().catch(err => console.error('❌ Error saat menjalankan bot:', err));

