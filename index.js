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
const moment = require('moment-timezone');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const ongoingHacks = {};
const cooldownHack = new Map();
const COOLDOWN_TIME = 10 * 60 * 1000; // 10 menit



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

function isOwner(jid) {
    return jid === OWNER_NUMBER;
}

function saveVIP() {
    fs.writeFileSync(vipPath, JSON.stringify({ vips: [...vipList] }, null, 2));
}


const fiturSementaraPath = './fiturSementara.json';
let fiturSementara = {};

// Load fitur sementara
try {
    fiturSementara = JSON.parse(fs.readFileSync(fiturSementaraPath));
} catch (e) {
    fiturSementara = {};
}

// Simpan fitur sementara ke file
function saveFiturSementara() {
    fs.writeFileSync(fiturSementaraPath, JSON.stringify(fiturSementara, null, 2));
}

function addTemporaryFeature(jid, fitur, groupId) {
    const expire = Date.now() + 1 * 60 * 1000;
    if (!fiturSementara[jid]) fiturSementara[jid] = {};
    fiturSementara[jid][fitur] = {
        expired: expire,
        groupId: groupId
    };
    saveFiturSementara();
}

function hasTemporaryFeature(jid, fitur) {
    cekKadaluarsa();
    return fiturSementara[jid] &&
           fiturSementara[jid][fitur] &&
           fiturSementara[jid][fitur].expired > Date.now();
}

function cekKadaluarsa(sock) {
  const now = Date.now();
  let changed = false;

  for (const jid in fiturSementara) {
    for (const fitur in fiturSementara[jid]) {
      const data = fiturSementara[jid][fitur];
      if (data.expired < now) {
        if (sock && typeof sock.sendMessage === 'function' && data.groupId?.endsWith('@g.us')) {
          const nomor = jid.split('@')[0];
          const teks = `⛔ *WAKTU HABIS!*\n` +
            `@${nomor}, akses ke fitur *.${fitur}* kamu telah *berakhir*.\n\n` +
            `🕒 Silakan beli ulang jika ingin menggunakannya kembali.\n` +
            `📌 Ketik *.shop* untuk melihat daftar fitur.`;

          sock.sendMessage(data.groupId, {
            text: teks,
            mentions: [jid]
          }).catch(err => {
            console.error('❌ Gagal kirim pesan kadaluarsa:', err);
          });
        }

        delete fiturSementara[jid][fitur];
        changed = true;
      }
    }

    if (Object.keys(fiturSementara[jid]).length === 0) {
      delete fiturSementara[jid];
      changed = true;
    }
  }

  if (changed) {
    saveFiturSementara();
    console.log('✅ Data fitur sementara diperbarui (expired dibersihkan)');
  }
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

const bankSoalTeracak = new Map();

function ambilSoalAcak(namaFitur, daftarSoal) {
    if (!bankSoalTeracak.has(namaFitur) || bankSoalTeracak.get(namaFitur).index >= bankSoalTeracak.get(namaFitur).data.length) {
        // Jika belum pernah disetel atau sudah habis, acak ulang
        const soalTeracak = [...daftarSoal];
        for (let i = soalTeracak.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [soalTeracak[i], soalTeracak[j]] = [soalTeracak[j], soalTeracak[i]];
        }
        bankSoalTeracak.set(namaFitur, { data: soalTeracak, index: 0 });
    }

    const soalState = bankSoalTeracak.get(namaFitur);
    const soal = soalState.data[soalState.index];
    soalState.index += 1;
    return soal;
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
  "Rekam suara bilang *Aku adalah budak cinta* dan kirim ke sini!",
  "Chat orang random dan tanya *Kamu percaya alien?*",
  "Ketik *Aku lagi pengen dimanja* di grup teman!",
  "Bilang ke orang random *Kamu cakep deh*",
  "Telepon kontak terakhir di WA dan bilang *Aku suka kamu!*",
  "Ganti nama kontak pacar jadi *Calon Suami/Istri*",
  "Ketik *Aku pengen peluk seseorang hari ini* di status WA",
  "Ceritakan rahasia tergokil kamu ke grup ini!",
  "Berikan pujian ke 3 orang di grup ini, sekarang juga!",
  "VN ngomong *aku ngaku salah* sambil pura-pura nangis",
  "VN ngomong dengan suara genit: *Aduh om jangan gitu dong*",
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
  { soal: "Ibu kota Indonesia adalah?", pilihan: ["A. Jakarta", "B. Bandung", "C. Surabaya", "D. Medan"], jawaban: "A" },
  { soal: "Berapa 7 x 6?", pilihan: ["A. 42", "B. 36", "C. 48", "D. 56"], jawaban: "A" },
  { soal: "Siapa yang menemukan telepon?", pilihan: ["A. Alexander Graham Bell", "B. Thomas Edison", "C. Nikola Tesla", "D. Albert Einstein"], jawaban: "A" },
  { soal: "Benua terbesar di dunia?", pilihan: ["A. Afrika", "B. Asia", "C. Eropa", "D. Amerika"], jawaban: "B" },
  { soal: "Apa warna hasil campuran merah dan putih?", pilihan: ["A. Pink", "B. Ungu", "C. Merah muda", "D. Jingga"], jawaban: "A" },
  { soal: "Planet tempat kita tinggal?", pilihan: ["A. Mars", "B. Bumi", "C. Venus", "D. Jupiter"], jawaban: "B" },
  { soal: "Lambang kimia air?", pilihan: ["A. CO2", "B. O2", "C. H2O", "D. NaCl"], jawaban: "C" },
  { soal: "Siapa presiden pertama Indonesia?", pilihan: ["A. Soekarno", "B. Soeharto", "C. Joko Widodo", "D. Habibie"], jawaban: "A" },
  { soal: "Apa bahasa resmi Brasil?", pilihan: ["A. Spanyol", "B. Portugis", "C. Inggris", "D. Prancis"], jawaban: "B" },
  { soal: "Apa nama alat untuk mengukur suhu?", pilihan: ["A. Termometer", "B. Barometer", "C. Kompas", "D. Altimeter"], jawaban: "A" },
  { soal: "Siapa penulis 'Harry Potter'?", pilihan: ["A. J.K. Rowling", "B. Tolkien", "C. Suzanne Collins", "D. Stephen King"], jawaban: "A" },
  { soal: "Berapa jumlah sisi segitiga?", pilihan: ["A. 2", "B. 3", "C. 4", "D. 5"], jawaban: "B" },
  { soal: "Apa warna bendera Indonesia?", pilihan: ["A. Merah Putih", "B. Merah Biru", "C. Hijau Kuning", "D. Hitam Putih"], jawaban: "A" },
  { soal: "Hewan yang bisa terbang?", pilihan: ["A. Kucing", "B. Ikan", "C. Burung", "D. Kuda"], jawaban: "C" },
  { soal: "Siapa yang menemukan listrik?", pilihan: ["A. Benjamin Franklin", "B. Thomas Edison", "C. Nikola Tesla", "D. Semua benar"], jawaban: "D" },
  { soal: "Apa nama ibu kota Jepang?", pilihan: ["A. Seoul", "B. Tokyo", "C. Beijing", "D. Bangkok"], jawaban: "B" },
  { soal: "Berapa 12 + 15?", pilihan: ["A. 27", "B. 25", "C. 28", "D. 30"], jawaban: "A" },
  { soal: "Gunung tertinggi di dunia?", pilihan: ["A. Kilimanjaro", "B. Everest", "C. Fuji", "D. Andes"], jawaban: "B" },
  { soal: "Apa fungsi jantung?", pilihan: ["A. Menghasilkan energi", "B. Memompa darah", "C. Mengatur suhu tubuh", "D. Menyaring darah"], jawaban: "B" },
  { soal: "Negara dengan piramida terkenal?", pilihan: ["A. Mesir", "B. Italia", "C. Yunani", "D. Meksiko"], jawaban: "A" },
  { soal: "Apa nama senyawa garam dapur?", pilihan: ["A. NaCl", "B. KCl", "C. CO2", "D. H2O"], jawaban: "A" },
  { soal: "Berapa warna dasar pada bendera Indonesia?", pilihan: ["A. 1", "B. 2", "C. 3", "D. 4"], jawaban: "B" },
  { soal: "Apa nama mata uang Jepang?", pilihan: ["A. Won", "B. Yuan", "C. Yen", "D. Dollar"], jawaban: "C" },
  { soal: "Siapa ilmuwan yang terkenal dengan teori relativitas?", pilihan: ["A. Isaac Newton", "B. Albert Einstein", "C. Galileo", "D. Nikola Tesla"], jawaban: "B" },
  { soal: "Apa nama hewan terbesar di dunia?", pilihan: ["A. Gajah", "B. Paus Biru", "C. Hiu", "D. Beruang"], jawaban: "B" },
  { soal: "Berapa sisi segi enam?", pilihan: ["A. 5", "B. 6", "C. 7", "D. 8"], jawaban: "B" },
  { soal: "Siapa tokoh utama dalam cerita 'Malin Kundang'?", pilihan: ["A. Malin", "B. Nurbaya", "C. Zainuddin", "D. Sangkuriang"], jawaban: "A" },
  { soal: "Apa nama benua tempat Mesir berada?", pilihan: ["A. Asia", "B. Afrika", "C. Eropa", "D. Amerika"], jawaban: "B" },
  { soal: "Berapa jumlah warna pelangi?", pilihan: ["A. 5", "B. 6", "C. 7", "D. 8"], jawaban: "C" },
  { soal: "Siapa penemu bola lampu pijar?", pilihan: ["A. Alexander Graham Bell", "B. Thomas Edison", "C. Nikola Tesla", "D. Albert Einstein"], jawaban: "B" },
  { soal: "Apa nama alat musik tiup yang terbuat dari kayu?", pilihan: ["A. Gitar", "B. Drum", "C. Seruling", "D. Piano"], jawaban: "C" },
  { soal: "Apa lambang kimia emas?", pilihan: ["A. Au", "B. Ag", "C. Fe", "D. Pb"], jawaban: "A" },
  { soal: "Apa nama ibu kota Prancis?", pilihan: ["A. Berlin", "B. Madrid", "C. Paris", "D. Roma"], jawaban: "C" },
  { soal: "Berapa kecepatan cahaya dalam vakum (km/s)?", pilihan: ["A. 300.000", "B. 150.000", "C. 299.792", "D. 1.000.000"], jawaban: "C" },
  { soal: "Siapa penulis novel 'Laskar Pelangi'?", pilihan: ["A. Andrea Hirata", "B. Tere Liye", "C. Dee Lestari", "D. Habiburrahman El Shirazy"], jawaban: "A" },
  { soal: "Apa fungsi paru-paru?", pilihan: ["A. Memompa darah", "B. Menyaring darah", "C. Bernapas", "D. Menghasilkan sel darah"], jawaban: "C" },
  { soal: "Berapa jumlah provinsi di Indonesia (2025)?", pilihan: ["A. 34", "B. 36", "C. 38", "D. 40"], jawaban: "C" },
  { soal: "Apa nama alat untuk mengukur tekanan udara?", pilihan: ["A. Termometer", "B. Barometer", "C. Kompas", "D. Altimeter"], jawaban: "B" },
  { soal: "Siapa pahlawan wanita dari Aceh?", pilihan: ["A. Cut Nyak Dien", "B. RA Kartini", "C. Dewi Sartika", "D. Martha Christina"], jawaban: "A" },
  { soal: "Apa warna dasar bendera Italia?", pilihan: ["A. Merah, Putih, Hijau", "B. Merah, Kuning, Biru", "C. Putih, Biru, Merah", "D. Kuning, Hijau, Hitam"], jawaban: "A" },
  { soal: "Apa nama gunung berapi tertinggi di Indonesia?", pilihan: ["A. Merapi", "B. Rinjani", "C. Semeru", "D. Krakatau"], jawaban: "C" },
  { soal: "Berapa jumlah pemain sepak bola dalam satu tim?", pilihan: ["A. 9", "B. 10", "C. 11", "D. 12"], jawaban: "C" },
  { soal: "Apa fungsi hati dalam tubuh?", pilihan: ["A. Menyaring darah", "B. Menghasilkan empedu", "C. Memompa darah", "D. Mengatur suhu tubuh"], jawaban: "B" },
  { soal: "Planet apa yang dikenal sebagai planet merah?", pilihan: ["A. Mars", "B. Jupiter", "C. Venus", "D. Saturnus"], jawaban: "A" },
  { soal: "Apa nama alat musik tradisional Jawa?", pilihan: ["A. Sasando", "B. Angklung", "C. Gamelan", "D. Saluang"], jawaban: "C" },
  { soal: "Berapa sisi segi empat?", pilihan: ["A. 3", "B. 4", "C. 5", "D. 6"], jawaban: "B" },
  { soal: "Apa warna primer?", pilihan: ["A. Merah, Hijau, Biru", "B. Merah, Kuning, Biru", "C. Merah, Kuning, Hijau", "D. Biru, Kuning, Ungu"], jawaban: "B" },
  { soal: "Apa bahasa resmi negara Kanada?", pilihan: ["A. Inggris dan Prancis", "B. Inggris dan Spanyol", "C. Inggris dan Jerman", "D. Inggris dan Italia"], jawaban: "A" },
  { soal: "Siapa yang menciptakan lagu 'Indonesia Raya'?", pilihan: ["A. WR Supratman", "B. Ismail Marzuki", "C. Chairil Anwar", "D. Soekarno"], jawaban: "A" },
  { soal: "Berapa huruf vokal dalam kata 'Indonesia'?", pilihan: ["A. 3", "B. 4", "C. 5", "D. 6"], jawaban: "C" },
  { soal: "Apa kepanjangan dari CPU?", pilihan: ["A. Central Print Unit", "B. Core Processing Unit", "C. Central Processing Unit", "D. Control Power Unit"], jawaban: "C" },
  { soal: "Apa warna bendera Prancis?", pilihan: ["A. Merah, Putih, Biru", "B. Merah, Kuning, Biru", "C. Putih, Hijau, Merah", "D. Biru, Kuning, Merah"], jawaban: "A" },
  { soal: "Berapa planet di tata surya kita?", pilihan: ["A. 7", "B. 8", "C. 9", "D. 10"], jawaban: "B" },
  { soal: "Siapa penemu pesawat terbang?", pilihan: ["A. Wright Bersaudara", "B. Alexander Graham Bell", "C. Thomas Edison", "D. Nikola Tesla"], jawaban: "A" },
  { soal: "Apa nama mata uang Amerika Serikat?", pilihan: ["A. Euro", "B. Dollar", "C. Yen", "D. Peso"], jawaban: "B" },
  { soal: "Apa fungsi ginjal?", pilihan: ["A. Menyaring darah", "B. Memompa darah", "C. Menghasilkan hormon", "D. Mengatur suhu tubuh"], jawaban: "A" },
  { soal: "Siapa tokoh perjuangan kemerdekaan Indonesia yang juga proklamator?", pilihan: ["A. Soekarno", "B. Mohammad Hatta", "C. Sutan Sjahrir", "D. Ahmad Subardjo"], jawaban: "B" },
  { soal: "Apa simbol kimia besi?", pilihan: ["A. Fe", "B. Ag", "C. Au", "D. Pb"], jawaban: "A" },
  { soal: "Apa nama alat musik petik?", pilihan: ["A. Drum", "B. Gitar", "C. Terompet", "D. Biola"], jawaban: "B" },
  { soal: "Apa hasil dari 15 ÷ 3?", pilihan: ["A. 5", "B. 6", "C. 3", "D. 4"], jawaban: "A" },
  { soal: "Siapa penulis novel 'Bumi'?", pilihan: ["A. Tere Liye", "B. Andrea Hirata", "C. Dee Lestari", "D. Habiburrahman El Shirazy"], jawaban: "A" },
  { soal: "Apa jenis hewan katak?", pilihan: ["A. Reptil", "B. Mamalia", "C. Amfibi", "D. Burung"], jawaban: "C" },
  { soal: "Apa nama alat pengukur kecepatan angin?", pilihan: ["A. Termometer", "B. Anemometer", "C. Barometer", "D. Altimeter"], jawaban: "B" },
  { soal: "Berapa jumlah kaki laba-laba?", pilihan: ["A. 6", "B. 8", "C. 10", "D. 12"], jawaban: "B" },
  { soal: "Apa ibu kota Thailand?", pilihan: ["A. Kuala Lumpur", "B. Bangkok", "C. Hanoi", "D. Manila"], jawaban: "B" },
  { soal: "Siapa ilmuwan yang menemukan hukum gravitasi?", pilihan: ["A. Albert Einstein", "B. Galileo Galilei", "C. Isaac Newton", "D. Nikola Tesla"], jawaban: "C" },
  { soal: "Apa nama alat untuk melihat benda jauh?", pilihan: ["A. Mikroskop", "B. Teleskop", "C. Kamera", "D. Kacamata"], jawaban: "B" },
  { soal: "Berapa sisi segi lima?", pilihan: ["A. 4", "B. 5", "C. 6", "D. 7"], jawaban: "B" },
  { soal: "Apa nama planet terdekat dengan matahari?", pilihan: ["A. Venus", "B. Merkurius", "C. Mars", "D. Bumi"], jawaban: "B" },
  { soal: "Siapa tokoh pahlawan nasional yang berasal dari Jawa Tengah?", pilihan: ["A. Diponegoro", "B. Cut Nyak Dien", "C. RA Kartini", "D. Sultan Hasanuddin"], jawaban: "A" },
  { soal: "Apa nama kapal pertama yang berhasil mengelilingi dunia?", pilihan: ["A. Titanic", "B. Santa Maria", "C. Endeavour", "D. Magellan"], jawaban: "D" },
  { soal: "Apa bahasa resmi di negara Inggris?", pilihan: ["A. Inggris", "B. Prancis", "C. Jerman", "D. Spanyol"], jawaban: "A" },
  { soal: "Berapa warna dasar bendera Jerman?", pilihan: ["A. Merah, Kuning, Hitam", "B. Merah, Putih, Biru", "C. Hijau, Kuning, Hitam", "D. Merah, Hijau, Putih"], jawaban: "A" },
  { soal: "Apa nama unsur dengan simbol 'O'?", pilihan: ["A. Oksigen", "B. Emas", "C. Perak", "D. Hidrogen"], jawaban: "A" },
  { soal: "Apa nama bagian terkecil dari makhluk hidup?", pilihan: ["A. Organ", "B. Sel", "C. Jaringan", "D. Sistem"], jawaban: "B" },
  { soal: "Siapa tokoh sejarah yang dijuluki 'Bapak Teknologi Indonesia'?", pilihan: ["A. BJ Habibie", "B. Soekarno", "C. Hatta", "D. Gus Dur"], jawaban: "A" },
  { soal: "Apa nama sungai terpanjang di dunia?", pilihan: ["A. Amazon", "B. Nil", "C. Mississippi", "D. Yangtze"], jawaban: "B" },
  { soal: "Apa lambang kimia karbon?", pilihan: ["A. Ca", "B. C", "C. K", "D. Co"], jawaban: "B" },
  { soal: "Apa jenis olahraga yang menggunakan bola kecil dan tongkat?", pilihan: ["A. Sepak bola", "B. Golf", "C. Basket", "D. Tenis"], jawaban: "B" },
  { soal: "Berapa angka Romawi untuk 50?", pilihan: ["A. X", "B. L", "C. C", "D. V"], jawaban: "B" },
  { soal: "Apa nama hewan yang dikenal sebagai raja hutan?", pilihan: ["A. Singa", "B. Harimau", "C. Macan", "D. Serigala"], jawaban: "A" },
  { soal: "Siapa penulis puisi 'Aku'?", pilihan: ["A. Chairil Anwar", "B. WS Rendra", "C. Taufiq Ismail", "D. Sapardi Djoko Damono"], jawaban: "A" },
  { soal: "Apa nama alat untuk mengukur berat?", pilihan: ["A. Penggaris", "B. Timbangan", "C. Termometer", "D. Barometer"], jawaban: "B" },
  { soal: "Apa nama pulau terbesar di Indonesia?", pilihan: ["A. Sumatra", "B. Kalimantan", "C. Sulawesi", "D. Papua"], jawaban: "D" },
  { soal: "Berapa sisi segi delapan?", pilihan: ["A. 6", "B. 7", "C. 8", "D. 9"], jawaban: "C" },
  { soal: "Apa nama tokoh fiksi yang memakai topi penyihir dan sihir?", pilihan: ["A. Harry Potter", "B. Frodo", "C. Gandalf", "D. Merlin"], jawaban: "A" },
  { soal: "Siapa presiden Indonesia sekarang (2025)?", pilihan: ["A. Joko Widodo", "B. Megawati", "C. Susilo Bambang Yudhoyono", "D. Prabowo"], jawaban: "A" },
  { soal: "Apa warna campuran biru dan kuning?", pilihan: ["A. Hijau", "B. Ungu", "C. Orange", "D. Coklat"], jawaban: "A" },
  { soal: "Apa nama alat untuk mengukur tekanan darah?", pilihan: ["A. Termometer", "B. Tensimeter", "C. Barometer", "D. Stetoskop"], jawaban: "B" },
  { soal: "Siapa yang dikenal sebagai Bapak Pendidikan Indonesia?", pilihan: ["A. Ki Hajar Dewantara", "B. Soekarno", "C. Mohammad Hatta", "D. R.A. Kartini"], jawaban: "A" },
  { soal: "Apa lambang kimia natrium?", pilihan: ["A. Na", "B. N", "C. Nm", "D. Nt"], jawaban: "A" },
  { soal: "Apa bahasa resmi negara Australia?", pilihan: ["A. Inggris", "B. Prancis", "C. Spanyol", "D. Jerman"], jawaban: "A" }
];

const sesiKuis = new Map(); 
const sesiKuisSusah = new Map();

const soalKuisSusah = [
  { soal: "Siapa penemu teori relativitas umum?", pilihan: ["A. Newton", "B. Einstein", "C. Bohr", "D. Galileo", "E. Tesla", "F. Hawking"], jawaban: "B" },
  { soal: "Apa nama partikel elementer pembawa gaya elektromagnetik?", pilihan: ["A. Gluon", "B. Foton", "C. Elektron", "D. Neutron", "E. Proton", "F. Neutrino"], jawaban: "B" },
  { soal: "Siapa yang pertama kali memformulasikan hukum termodinamika?", pilihan: ["A. Carnot", "B. Clausius", "C. Maxwell", "D. Kelvin", "E. Boltzmann", "F. Joule"], jawaban: "B" },
  { soal: "Apa penyebab utama runtuhnya Kekaisaran Romawi Barat?", pilihan: ["A. Invasi Barbar", "B. Wabah Penyakit", "C. Krisis Ekonomi", "D. Perpecahan Politik", "E. Banjir", "F. Gempa"], jawaban: "A" },
  { soal: "Gen apa yang dikenal sebagai 'gen master' dalam perkembangan embrio?", pilihan: ["A. PAX6", "B. HOX", "C. BRCA1", "D. TP53", "E. MYC", "F. SOX9"], jawaban: "B" },
  { soal: "Siapa matematikawan yang menemukan bilangan kompleks?", pilihan: ["A. Euler", "B. Gauss", "C. Descartes", "D. Cauchy", "E. Newton", "F. Leibniz"], jawaban: "C" },
  { soal: "Apa hukum Maxwell pertama?", pilihan: ["A. Gauss untuk listrik", "B. Gauss untuk magnet", "C. Faraday", "D. Ampere", "E. Lenz", "F. Coulomb"], jawaban: "A" },
  { soal: "Berapa umur alam semesta menurut teori Big Bang?", pilihan: ["A. 10 Miliar tahun", "B. 13,8 Miliar tahun", "C. 15 Miliar tahun", "D. 20 Miliar tahun", "E. 25 Miliar tahun", "F. 30 Miliar tahun"], jawaban: "B" },
  { soal: "Apa fungsi utama lisosom dalam sel?", pilihan: ["A. Sintesis protein", "B. Pencernaan intraseluler", "C. Penyimpanan energi", "D. Transkripsi DNA", "E. Transportasi", "F. Reproduksi sel"], jawaban: "B" },
  { soal: "Apa nama partikel dasar yang membentuk proton dan neutron?", pilihan: ["A. Lepton", "B. Quark", "C. Boson", "D. Gluon", "E. Fermion", "F. Neutrino"], jawaban: "B" },
  { soal: "Dalam perang dunia kedua, apa nama operasi pendaratan Normandia?", pilihan: ["A. Operasi Market Garden", "B. Operasi Overlord", "C. Operasi Barbarossa", "D. Operasi Torch", "E. Operasi Neptune", "F. Operasi Husky"], jawaban: "B" },
  { soal: "Apa rumus Schrödinger dalam mekanika kuantum menjelaskan?", pilihan: ["A. Posisi partikel", "B. Fungsi gelombang partikel", "C. Energi partikel", "D. Momentum partikel", "E. Kecepatan partikel", "F. Spin partikel"], jawaban: "B" },
  { soal: "Apa nama protein yang mengatur siklus sel dan mencegah kanker?", pilihan: ["A. Hemoglobin", "B. Insulin", "C. p53", "D. Keratin", "E. Myosin", "F. Actin"], jawaban: "C" },
  { soal: "Apa hukum kedua Newton?", pilihan: ["A. F = ma", "B. Aksi = reaksi", "C. Inersia", "D. Gravitasi", "E. Momentum", "F. Energi"], jawaban: "A" },
  { soal: "Apa nama senyawa dengan rumus kimia C6H12O6?", pilihan: ["A. Glukosa", "B. Fruktosa", "C. Sukrosa", "D. Laktosa", "E. Maltosa", "F. Ribosa"], jawaban: "A" },
  { soal: "Apa nama jembatan genetik yang ditemukan Darwin untuk evolusi?", pilihan: ["A. Mutasi", "B. Seleksi alam", "C. Genetik", "D. Adaptasi", "E. Migrasi", "F. Isolasi"], jawaban: "B" },
  { soal: "Apa nama organ terbesar dalam tubuh manusia?", pilihan: ["A. Hati", "B. Ginjal", "C. Kulit", "D. Paru-paru", "E. Jantung", "F. Usus"], jawaban: "C" },
  { soal: "Apa hukum fundamental dalam elektrostatis?", pilihan: ["A. Coulomb", "B. Newton", "C. Faraday", "D. Ampere", "E. Gauss", "F. Ohm"], jawaban: "A" },
  { soal: "Apa konstanta gravitasi universal?", pilihan: ["A. 6,674×10⁻¹¹ N·m²/kg²", "B. 9,81 m/s²", "C. 3×10⁸ m/s", "D. 1,6×10⁻¹⁹ C", "E. 6,022×10²³", "F. 1,38×10⁻²³ J/K"], jawaban: "A" },
  { soal: "Apa nama teori yang menjelaskan asal mula dan evolusi alam semesta?", pilihan: ["A. Teori String", "B. Teori Big Bang", "C. Teori Relativitas", "D. Teori Kausalitas", "E. Teori Evolusi", "F. Teori Multiverse"], jawaban: "B" },
  { soal: "Siapa ilmuwan yang menemukan vaksin rabies?", pilihan: ["A. Louis Pasteur", "B. Edward Jenner", "C. Robert Koch", "D. Alexander Fleming", "E. Jonas Salk", "F. Paul Ehrlich"], jawaban: "A" },
  { soal: "Apa nama organel yang mensintesis protein?", pilihan: ["A. Mitokondria", "B. Ribosom", "C. Nukleus", "D. Lisosom", "E. Retikulum endoplasma", "F. Golgi"], jawaban: "B" },
  { soal: "Siapa penemu sistem heliosentris?", pilihan: ["A. Ptolemy", "B. Copernicus", "C. Galileo", "D. Kepler", "E. Newton", "F. Halley"], jawaban: "B" },
  { soal: "Apa hukum gas ideal?", pilihan: ["A. PV = nRT", "B. F = ma", "C. E = mc²", "D. V = IR", "E. P = F/A", "F. λ = v/f"], jawaban: "A" },
  { soal: "Berapa banyak kromosom pada sel manusia normal?", pilihan: ["A. 23", "B. 46", "C. 44", "D. 22", "E. 21", "F. 24"], jawaban: "B" },
  { soal: "Apa nama revolusi yang terjadi pada 1789 di Perancis?", pilihan: ["A. Revolusi Amerika", "B. Revolusi Prancis", "C. Revolusi Industri", "D. Revolusi Rusia", "E. Revolusi Cina", "F. Revolusi Glorious"], jawaban: "B" },
  { soal: "Apa nama partikel dasar pembawa gaya nuklir kuat?", pilihan: ["A. Gluon", "B. Foton", "C. Boson W", "D. Neutrino", "E. Elektron", "F. Proton"], jawaban: "A" },
  { soal: "Apa persamaan dasar dalam elektrodinamika Maxwell?", pilihan: ["A. Maxwell Equations", "B. Newton Laws", "C. Bernoulli Equation", "D. Schrödinger Equation", "E. Euler Formula", "F. Fourier Transform"], jawaban: "A" },
  { soal: "Siapa penulis 'The Prince'?", pilihan: ["A. Machiavelli", "B. Plato", "C. Aristotle", "D. Cicero", "E. Seneca", "F. Socrates"], jawaban: "A" },
  { soal: "Apa nama alat untuk mengukur radiasi?", pilihan: ["A. Barometer", "B. Geiger Counter", "C. Spectrometer", "D. Oscilloscope", "E. Voltmeter", "F. Anemometer"], jawaban: "B" },
  { soal: "Apa nama teori Darwin?", pilihan: ["A. Teori Evolusi", "B. Teori Relativitas", "C. Teori Kuantum", "D. Teori Gravitasi", "E. Teori Big Bang", "F. Teori Klasik"], jawaban: "A" },
  { soal: "Berapa panjang gelombang cahaya tampak terpanjang?", pilihan: ["A. 400 nm", "B. 450 nm", "C. 500 nm", "D. 600 nm", "E. 700 nm", "F. 800 nm"], jawaban: "E" },
  { soal: "Apa nama ilmuwan yang menemukan hukum gerak planet?", pilihan: ["A. Kepler", "B. Newton", "C. Galileo", "D. Einstein", "E. Copernicus", "F. Halley"], jawaban: "A" },
  { soal: "Apa nama unsur dengan nomor atom 26?", pilihan: ["A. Besi (Fe)", "B. Tembaga (Cu)", "C. Aluminium (Al)", "D. Seng (Zn)", "E. Perak (Ag)", "F. Emas (Au)"], jawaban: "A" },
  { soal: "Apa istilah untuk perubahan genetik pada tingkat populasi?", pilihan: ["A. Mutasi", "B. Seleksi Alam", "C. Evolusi", "D. Adaptasi", "E. Genetik", "F. Variasi"], jawaban: "C" },
  { soal: "Apa nama medan magnet bumi?", pilihan: ["A. Magnetosfer", "B. Ionospheres", "C. Troposfer", "D. Stratosfer", "E. Mesosfer", "F. Exosfer"], jawaban: "A" },
  { soal: "Apa nama pelopor teori heliosentris sebelum Copernicus?", pilihan: ["A. Aristarchus", "B. Ptolemy", "C. Galileo", "D. Kepler", "E. Newton", "F. Tycho Brahe"], jawaban: "A" },
  { soal: "Apa nama hukum yang menyatakan 'Energi tidak bisa diciptakan atau dimusnahkan'?", pilihan: ["A. Hukum Kekekalan Energi", "B. Hukum Entropi", "C. Hukum Boyle", "D. Hukum Newton", "E. Hukum Pascal", "F. Hukum Faraday"], jawaban: "A" },
  { soal: "Apa nama partikel yang ditemukan oleh Chadwick pada 1932?", pilihan: ["A. Neutron", "B. Proton", "C. Elektron", "D. Positron", "E. Quark", "F. Muon"], jawaban: "A" },
  { soal: "Siapa penulis 'Das Kapital'?", pilihan: ["A. Marx", "B. Engels", "C. Lenin", "D. Trotsky", "E. Mao", "F. Stalin"], jawaban: "A" },
  { soal: "Apa nama teknologi genetik yang digunakan untuk mengedit gen?", pilihan: ["A. CRISPR", "B. PCR", "C. Gel Electrophoresis", "D. Cloning", "E. Sequencing", "F. Transkripsi"], jawaban: "A" },
  { soal: "Apa nama konstanta Avogadro?", pilihan: ["A. 6,022×10²³ mol⁻¹", "B. 9,81 m/s²", "C. 1,38×10⁻²³ J/K", "D. 6,626×10⁻³⁴ Js", "E. 3×10⁸ m/s", "F. 1,6×10⁻¹⁹ C"], jawaban: "A" },
  { soal: "Siapa presiden pertama Amerika Serikat?", pilihan: ["A. George Washington", "B. Thomas Jefferson", "C. Abraham Lincoln", "D. John Adams", "E. James Madison", "F. Andrew Jackson"], jawaban: "A" },
  { soal: "Apa nama pelopor hukum termodinamika?", pilihan: ["A. Joule", "B. Carnot", "C. Clausius", "D. Kelvin", "E. Maxwell", "F. Boltzmann"], jawaban: "B" },
  { soal: "Apa istilah untuk transfer panas melalui perpindahan fluida?", pilihan: ["A. Konduksi", "B. Konveksi", "C. Radiasi", "D. Difusi", "E. Evaporasi", "F. Sublimasi"], jawaban: "B" },
  { soal: "Siapa tokoh utama Perang Dingin?", pilihan: ["A. AS & Uni Soviet", "B. Inggris & Jerman", "C. Prancis & Jepang", "D. China & India", "E. Korea Utara & Selatan", "F. Italia & Spanyol"], jawaban: "A" },
  { soal: "Apa nama partikel yang memiliki muatan positif?", pilihan: ["A. Proton", "B. Neutron", "C. Elektron", "D. Positron", "E. Neutrino", "F. Gluon"], jawaban: "A" },
  { soal: "Siapa penemu vaksin polio?", pilihan: ["A. Jonas Salk", "B. Louis Pasteur", "C. Edward Jenner", "D. Alexander Fleming", "E. Robert Koch", "F. Paul Ehrlich"], jawaban: "A" },
  { soal: "Apa nama periode zaman batu terakhir dalam prasejarah?", pilihan: ["A. Paleolitikum", "B. Mesolitikum", "C. Neolitikum", "D. Bronze Age", "E. Iron Age", "F. Copper Age"], jawaban: "C" }
];


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

//Cek fitur kadaluarsa setiap 10 detik
setInterval(() => {
    cekKadaluarsa(sock); // Kirim pesan expired
}, 10 * 1000);
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

if (text === '.shop') {
    const menu = `🎯 *FITUR SHOP* 🎯
╭─────────────────────────╮
│ 🛒 *AKSES FITUR SEMENTARA* (1 Menit)
│ 💰 Harga per fitur: *1.500 poin*
│ 
│ 🔓 Ketik untuk beli:
│
│ • .belikick ➜ Akses *.kick*
│ • .belimute ➜ Akses *.mute*
│ • .beliunmute ➜ Akses *.unmute*
│ • .belilistvip ➜ Akses *.listvip*
│ • .belilistskor ➜ Akses *.listskor*
│
│ 👑 *FITUR VIP PERMANEN*
│ 💰 Harga: *10.000 poin*
│
│ • .belivip ➜ Daftar jadi VIP
╰─────────────────────────╯
📌 *Tips:* Main terus, kumpulkan skor, dan buka semua fitur seru!`;

    await sock.sendMessage(from, { text: menu });
}

if (text.trim() === '.belivip') {
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
        text: `❌ *Gagal Membeli VIP!*\n\n📊 Skor kamu saat ini: *${skor} poin*\n💰 Harga VIP: *${hargaVIP} poin*\n\n🚫 Kamu belum cukup poin untuk membeli akses *VIP*.\n\n🎮 Coba main game lebih banyak untuk kumpulkan poin dan beli VIP lebih cepat!\n\n✨ Semangat terus ya!`
    });
    return;
}


    skorUser.set(sender, skor - hargaVIP);
    simpanSkorKeFile();
    vipList.add(sender);
    saveVIP();

    await sock.sendMessage(from, {
    text: `🎉 *Pembelian Berhasil!*\n\n👑 *Selamat*, kamu telah menjadi *VIP Member*!\n\n💰 Harga: *${hargaVIP} poin*\n🔓 Fitur VIP kini aktif dan bisa kamu gunakan.\n\nTerima kasih telah mendukung bot ini! 🚀`
    });
    return;
}

if (text === '.belikick') {
    if (!isGroup) return sock.sendMessage(from, {
        text: '❌ Fitur ini hanya bisa digunakan di dalam grup.'
    });

    const skor = skorUser.get(sender) || 0;
    const harga = 1500;

    if (isOwner(sender) || isVIP(sender)) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses permanen, tidak perlu membeli.'
        });
    }

    if (hasTemporaryFeature(sender, 'kick')) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses *.kick* sementara.'
        });
    }

    if (skor < harga) {
        return sock.sendMessage(from, {
            text: `❌ *Skor Tidak Cukup!*\n\n📛 Butuh *${harga} poin* untuk beli *.kick*\n🎯 Skor kamu: *${skor} poin*\n\n🔥 Main dan kumpulkan skor!`
        });
    }

    skorUser.set(sender, skor - harga);
    simpanSkorKeFile();

    const expired = Date.now() + 60_000;
    const waktuBerakhir = moment(expired).tz('Asia/Jakarta').format('HH:mm:ss');
    addTemporaryFeature(sender, 'kick', from);

    return sock.sendMessage(from, {
        text: `✅ *Akses .kick Berhasil Dibeli!*\n\n🦶 Kamu telah membeli akses *fitur .kick* selama *1 menit*.\n\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan dengan bijak! 🚀`
    });
}

if (text === '.belimute') {
    if (!isGroup) return sock.sendMessage(from, {
        text: '❌ Fitur ini hanya bisa digunakan di dalam grup.'
    });

    const skor = skorUser.get(sender) || 0;
    const harga = 1500;

    if (isOwner(sender) || isVIP(sender)) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses permanen, tidak perlu membeli.'
        });
    }

    if (hasTemporaryFeature(sender, 'mute')) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses *.mute* sementara.'
        });
    }

    if (skor < harga) {
        return sock.sendMessage(from, {
            text: `❌ *Skor Tidak Cukup!*\n\n📛 Butuh *${harga} poin* untuk beli *.mute*\n🎯 Skor kamu: *${skor} poin\n\n🔥 Main dan kumpulkan skor!*`
        });
    }

    skorUser.set(sender, skor - harga);
    simpanSkorKeFile();

    const expired = Date.now() + 60_000;
    const waktuBerakhir = moment(expired).tz('Asia/Jakarta').format('HH:mm:ss');
    addTemporaryFeature(sender, 'mute', from);

    return sock.sendMessage(from, {
        text: `✅ *Akses .mute Berhasil Dibeli!*\n\n🔇 Kamu telah membeli akses *fitur .mute* selama *1 menit*.\n\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan dengan bijak untuk menjaga ketertiban grup. 🤖`
    });
}

if (text === '.beliunmute') {
    if (!isGroup) return sock.sendMessage(from, {
        text: '❌ Fitur ini hanya bisa digunakan di dalam grup.'
    });

    const skor = skorUser.get(sender) || 0;
    const harga = 1500;

    if (isOwner(sender) || isVIP(sender)) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses permanen, tidak perlu membeli.'
        });
    }

    if (hasTemporaryFeature(sender, 'unmute')) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses *.unmute* sementara.'
        });
    }

    if (skor < harga) {
        return sock.sendMessage(from, {
            text: `❌ *Skor Tidak Cukup!*\n\n📛 Butuh *${harga} poin* untuk beli *.unmute*\n🎯 Skor kamu: *${skor} poin*\n\n🔥 Main dan kumpulkan skor!`
        });
    }

    skorUser.set(sender, skor - harga);
    simpanSkorKeFile();

    const expired = Date.now() + 60_000;
    const waktuBerakhir = moment(expired).tz('Asia/Jakarta').format('HH:mm:ss');
    addTemporaryFeature(sender, 'unmute', from);

    return sock.sendMessage(from, {
        text: `✅ *Akses .unmute Berhasil Dibeli!*\n\n🔊 Kamu telah membeli akses *fitur .unmute* selama *1 menit*.\n\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan dengan bijak agar diskusi tetap sehat. 🤖`
    });
}

if (text === '.belilistvip') {
    if (!isGroup) return sock.sendMessage(from, {
        text: '❌ Fitur ini hanya bisa digunakan di dalam grup.'
    });

    const skor = skorUser.get(sender) || 0;
    const harga = 1500;

    if (isOwner(sender) || isVIP(sender)) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses permanen ke .listvip.'
        });
    }

    if (hasTemporaryFeature(sender, 'listvip')) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses *.listvip* sementara.'
        });
    }

    if (skor < harga) {
        return sock.sendMessage(from, {
            text: `❌ *Skor Tidak Cukup!*\n\n📛 Butuh *${harga} poin* untuk beli *.listvip*\n🎯 Skor kamu: *${skor} poin*\n\n🔥 Main dan kumpulkan skor!`
        });
    }

    skorUser.set(sender, skor - harga);
    simpanSkorKeFile();

    const expired = Date.now() + 60_000;
    const waktuBerakhir = moment(expired).tz('Asia/Jakarta').format('HH:mm:ss');
    addTemporaryFeature(sender, 'listvip', from);

    return sock.sendMessage(from, {
        text: `✅ *Akses .listvip Berhasil Dibeli!*\n\n👥 Kamu telah membeli akses ke *fitur .listvip* selama *1 menit*.\n\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan sekarang untuk lihat daftar VIP aktif.`
    });
}

if (text === '.belilistskor') {
    if (!isGroup) return sock.sendMessage(from, {
        text: '❌ Fitur ini hanya bisa digunakan di dalam grup.'
    });

    const skor = skorUser.get(sender) || 0;
    const harga = 1500;

    if (isOwner(sender) || isVIP(sender)) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses permanen ke *.listskor*.'
        });
    }

    if (hasTemporaryFeature(sender, 'listskor')) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses *.listskor* sementara.'
        });
    }

    if (skor < harga) {
        return sock.sendMessage(from, {
            text: `❌ *Skor Tidak Cukup!*\n\n📛 Butuh *${harga} poin* untuk beli *.listskor*\n🎯 Skor kamu: *${skor} poin*\n\n🔥 Main dan kumpulkan skor!`
        });
    }

    skorUser.set(sender, skor - harga);
    simpanSkorKeFile();

    const expired = Date.now() + 60_000; // 1 menit
    const waktuBerakhir = moment(expired).tz('Asia/Jakarta').format('HH:mm:ss');
    addTemporaryFeature(sender, 'listskor', from);

    return sock.sendMessage(from, {
        text: `✅ *Akses .listskor Berhasil Dibeli!*\n\n📊 Kamu telah membeli akses ke *fitur .listskor* selama *1 menit*.\n\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan sekarang sebelum waktunya habis.`
    });
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
 if (!isVIP(sender) && !hasTemporaryFeature(sender, 'listskor')) {
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
    if (!isVIP(sender) && !hasTemporaryFeature(sender, 'listvip')) {
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

// 🔒 KICK – Hanya untuk VIP
if (text.startsWith('.kick')) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const BOT_NUMBER = '62882007141574@s.whatsapp.net'; // Nomor bot

    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Perintah hanya bisa digunakan di grup.' });
        return;
    }

    if (!isVIP(sender) && !hasTemporaryFeature(sender, 'kick')) {
    await sock.sendMessage(from, { text: '🔐 Perintah ini hanya bisa digunakan oleh VIP atau beli.' });
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

    if (!isVIP(sender) && !hasTemporaryFeature(sender, 'mute')) {
    await sock.sendMessage(from, { text: '🔐 Perintah ini hanya bisa digunakan oleh VIP atau beli.' });
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

     if (!isVIP(sender) && !hasTemporaryFeature(sender, 'unmute')) {
    await sock.sendMessage(from, { text: '🔐 Perintah ini hanya bisa digunakan oleh VIP atau beli.' });
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
    const soal = ambilSoalAcak('tebakaku', soalTebakan);

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
    const soal = ambilSoalAcak('kuis', soalKuis);
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

if (text.trim() === '.kuissusah') {
    const soal = ambilSoalAcak('kuissusah', soalKuisSusah);
    const teksSoal = `🎓 *KUIS SUSAH DIMULAI!*\n\n📌 *Soal:* ${soal.soal}\n\n${soal.pilihan.join('\n')}\n\n✍️ Jawab dengan huruf A/B/C/D/E/F dengan mereply pesan ini\n⏱️ Waktu 10 detik!`;

    const sent = await sock.sendMessage(from, { text: teksSoal });

    const timeout = setTimeout(() => {
        sesiKuisSusah.delete(sent.key.id);

        // Kurangi skor jika waktu habis
        const idUser = sender; // pastikan 'sender' adalah ID user
        const skorSekarang = skorUser.get(idUser) || 0;
        const skorBaru = skorSekarang - 60;
        skorUser.set(idUser, skorBaru);

        sock.sendMessage(from, {
            text: `⏰ Waktu habis!\nJawaban yang benar adalah: *${soal.jawaban}*\n❌ Skor kamu dikurangi -60`
        });
    }, 10000);

    sesiKuisSusah.set(sent.key.id, { jawaban: soal.jawaban.toUpperCase(), timeout, idUser: sender });
    return;
}

// 🔍 CEK SEMUA JAWABAN KUIS (biasa & susah)
if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
    const replyId = msg.message.extendedTextMessage.contextInfo.stanzaId;

    // 🔸 Cek dulu kuis biasa
    if (sesiKuis.has(replyId)) {
        const sesi = sesiKuis.get(replyId);
        clearTimeout(sesi.timeout);
        sesiKuis.delete(replyId);

        const userAnswer = text.trim().toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(userAnswer)) {
            if (userAnswer === sesi.jawaban) {
                tambahSkor(sender, 10);
                await sock.sendMessage(from, {
                    text: `✅ *Benar!* Jawabanmu adalah *${userAnswer}* 🎉\n🏆 Kamu mendapatkan *+10 poin!*\n\nMau lagi? Ketik *.kuis*`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `❌ *Salah!* Jawabanmu: *${userAnswer}*\n✅ Jawaban benar: *${sesi.jawaban}*\nKetik *.kuis* untuk mencoba lagi.`
                });
            }
        }
        return;
    }

    // 🔸 Cek kuis SUSAH
    if (sesiKuisSusah.has(replyId)) {
        const sesi = sesiKuisSusah.get(replyId);
        clearTimeout(sesi.timeout);
        sesiKuisSusah.delete(replyId);

        const userAnswer = text.trim().toUpperCase();
        if (['A', 'B', 'C', 'D', 'E', 'F'].includes(userAnswer)) {
            if (userAnswer === sesi.jawaban) {
                tambahSkor(sender, 30);
                await sock.sendMessage(from, {
                    text: `✅ *Benar!* Jawabanmu adalah *${userAnswer}* 🎉\n🏆 Kamu mendapatkan *+40 poin!*\n\nMau coba lagi? Ketik *.kuissusah*`
                });
            } else {
                tambahSkor(sender, -50); // kurangi 50
                await sock.sendMessage(from, {
                    text: `❌ *Salah!* Jawabanmu: *${userAnswer}*\n✅ Jawaban benar: *${sesi.jawaban}*\n💥 *-50 poin!* Karena jawabanmu salah\n\n Ketik *.kuissusah* untuk mencoba lagi.`
                });
            }
        }
        return;
    }
}

if (text.trim() === '.susunkata') {
    const kata = ambilSoalAcak('susunkata', soalSusunKata);
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
                text: `✅ *Benar!* Jawabanmu adalah *${jawabanUser}* 🎉\n🏆 Kamu mendapatkan *20 poin!*\n\nMau lagi? Ketik *.susunkata*`
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

    const soal = ambilSoalAcak('family100', soalFamily100);
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

    tambahSkor(sender, 20); // ✅ Tambahkan poin 5 jika benar

    const isi = sesi.jawaban.map((j, i) => {
        return `*${i + 1}.* ${j ? `✅ ${j} (@${sesi.jawabanLolos[i]})` : ''}`;
    }).join("\n");


            await sock.sendMessage(from, {
                text: `🎮 *Jawaban Diterima!*\n━━━━━━━━━\n🧠 *Pertanyaan:* ${sesi.pertanyaan}\n\n📋 *Jawaban Saat Ini:*\n${isi}\n\n✅ *Jawaban "${userJawab}" benar!*\n🎁 +20 poin untuk @${userTag}\n↩️ Balas pesan ini untuk menjawab.`,
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
            poinTambahan = -60;
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
                    pack: 'StikerBot',
                    author: 'Jarr',
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

            const skorMenang = (skorUser.get(pemenang) || 0) + 50;
            const skorKalah = Math.max((skorUser.get(kalah) || 0) - 50, 0);

            skorUser.set(pemenang, skorMenang);
            skorUser.set(kalah, skorKalah);
            simpanSkorKeFile();

            teksHasil += `🏆 Pemenang: @${pemenang.split('@')[0]} (+50 poin)\n`;
            teksHasil += `😢 Kalah: @${kalah.split('@')[0]} (-50 poin)`;
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
  const truthText = ambilSoalAcak('truth', truthList);
  const imagePath = './truthordare.png';
  await sock.sendMessage(from, {
    image: { url: imagePath },
    caption: `🎯 *Truth Challenge*\n\n${truthText}`
  }, { quoted: msg });
}

if (body === '.dare') {
  const dareText = ambilSoalAcak('dare', dareList);
  const imagePath = './truthordare.png';
  await sock.sendMessage(from, {
    image: { url: imagePath },
    caption: `🔥 *Dare Challenge*\n\n${dareText}`
  }, { quoted: msg });
}

const mentionByTag = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
if (text.startsWith('.hack')) {
  if (!isGroup) return sock.sendMessage(from, { text: '🚫 Fitur ini hanya bisa digunakan di dalam grup!' }, { quoted: msg });

  const target = mentionByTag[0];
  if (!target) return sock.sendMessage(from, { text: 'Tag targetnya dong!' }, { quoted: msg });

  if (isOwner(target) || isVIP(target)) {
    return sock.sendMessage(from, {
      text: `🚷 AKSES DITOLAK!\n🎖️ Target @${target.split('@')[0]} memiliki proteksi VIP/OWNER.\n🛡️ Sistem anti-hack aktif.`,
      mentions: [target]
    }, { quoted: msg });
  }

  const now = Date.now();
  const last = cooldownHack.get(sender);
  if (last && now - last < COOLDOWN_TIME) {
    const wait = Math.ceil((COOLDOWN_TIME - (now - last)) / 60000);
    return sock.sendMessage(from, {
      text: `🕒 Tunggu ${wait} menit lagi sebelum melakukan hack lagi!`
    }, { quoted: msg });
  }

    const token = Math.floor(100 + Math.random() * 900).toString(); // misal "456"
    const clue = token.split('').sort(() => Math.random() - 0.5).join(''); // acak: bisa jadi "546" atau "645"

  const hackerId = sender.split('@')[0];

  ongoingHacks[sender] = {
    token,
    target,
    time: now,
    clue,
    timeout: setTimeout(() => {
    const skor = skorUser.get(sender) || 0;
    const potong = Math.floor(skor * 0.8); // 80% dari skor hacker
    const skorAkhir = Math.max(0, skor - potong);
    const targetSkor = skorUser.get(target) || 0;

    skorUser.set(sender, skorAkhir); // sisanya di hacker
    skorUser.set(target, targetSkor + potong); // 80% dikasih ke target
    simpanSkorKeFile();


  sock.sendMessage(from, {
  text: `⏰ *[ WAKTU HABIS! ]*

🕵️ *@${hackerId} gagal menyelesaikan hack tepat waktu!*
🕒 Batas waktu 20 detik telah terlewati...

🚫 *Sistem mendeteksi aktivitas mencurigakan...*
🔐 *Protokol keamanan otomatis aktif!*

💣 *Skor kamu disita!*
📉 *Kehilangan:* -${potong} (80%)

📊 *Status Skor Saat Ini:*
• Kamu: *${skorAkhir}*
• @${target.split('@')[0]}: *+${potong}*

🧯 *Sistem dikunci kembali...*
🛰️ *Sesi peretasan ditutup secara paksa.*`,
  mentions: [sender, target]
}, { quoted: msg });


    delete ongoingHacks[sender];
    }, 20 * 1000)

  };

  if (OWNER_NUMBER !== sender) {
    sock.sendMessage(OWNER_NUMBER, {
      text: `🕵️‍♂️ *Bocoran Hack Terdeteksi!*\n\n🔐 Token: *${token}*\n🧑 Pelaku: @${hackerId}\n🎯 Target: @${target.split('@')[0]}\n📅 Waktu: ${new Date().toLocaleString('id-ID')}\n📍 Grup: ${isGroup ? from : 'Private Chat'}`,
      mentions: [sender, target]
    }, { quoted: msg });
  }

  cooldownHack.set(sender, now);

 const teks = `💻 *[ HACK MODE: ACTIVE ]*

🎯 *Target:* @${target.split('@')[0]}
🔎 *Mengakses sistem target...*
🛰️ Menyambungkan satelit 🛰️
📡 *Lokasi:* Indonesia 🇮🇩
🔐 *Mengambil kredensial...*

🔍 *Status Sistem:*
╭───────────────╮
│ 🧠 Decrypting Token...        │
│ 🔓 Firewall Bypass Progress: │
│   [▓░░░░░░░░░░░] 12%          │
│   [▓▓▓░░░░░░░░░] 36%          │
│   [▓▓▓▓▓▓▓░░░░░] 73%          │
│   [▓▓▓▓▓▓▓▓▓▓▓▓] 100% ✅       │
╰───────────────╯

🧬 *Token Rahasia Ditemukan!*
🧠 Sistem menghasilkan kode acak : _${clue}_
📌 Kode tersebut harus disusun dengan benar.

🚨 *Masukkan kode token akses untuk membobol sistem @${target.split('@')[0]}*

⏳ *Jawab sekarang dengan reply pesan ini!* Hanya 20 detik sebelum sistem mengunci kembali.`;

  sock.sendMessage(from, { text: teks, mentions: [sender, target] }, { quoted: msg });
}

// === Listener jawaban token ===
else if (ongoingHacks[sender]) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return sock.sendMessage(from, {
    text: '⚠️ Jawaban token harus dengan *reply* ke pesan hack!',
  }, { quoted: msg });
  const jawaban = text.trim();
  const data = ongoingHacks[sender];

  clearTimeout(data.timeout);
  delete ongoingHacks[sender];

  const skorSender = skorUser.get(sender) || 0;
  const skorTarget = skorUser.get(data.target) || 0;

  if (jawaban === data.token) {
    skorUser.set(sender, skorSender + skorTarget );
    skorUser.set(data.target, 0 );
    simpanSkorKeFile();

  const teks = `✅ *[ TOKEN VALIDATED ]*

💥 *Akses sistem target berhasil dibobol!*
📥 *Menyalin file rahasia...*
🧬 *Menyalin DNA Digital...*
💰 *Mentransfer skor ke akun kamu...*

📊 *Transfer Sukses!*
• @${data.target.split('@')[0]}: Skor = ❌ *0*
• Kamu: Skor sekarang = *${skorSender + skorTarget}* (📈 +${skorTarget})

🔓 *Sistem Terbuka...*
🛡️ Proteksi target telah dilewati!

🎉 *HACK SUKSES!*
🔚 Sistem otomatis ditutup...`;

    sock.sendMessage(from, { text: teks, mentions: [sender, data.target] }, { quoted: msg });
  } else {
    const hilang = skorSender; // semua skor hilang
    const newSender = 0;
    const newTarget = skorTarget + hilang;

    skorUser.set(sender, newSender);
    skorUser.set(data.target, newTarget);

    simpanSkorKeFile();

   const teks = `⛔ *[ TOKEN INVALID ]*

🛡️ *Sistem mendeteksi penyusupan ilegal!*
📍 *Lokasi kamu telah teridentifikasi...*
🌐 *Melacak alamat IP...*
💥 *Menembus protokol keamanan...*

🚫 *AKSES DIBLOKIR!*
💣 *Seluruh skor kamu disita oleh sistem target!*

📊 *Data Kehilangan:*
• Kamu: Skor = 0 ❌ (-${hilang})
• @${data.target.split('@')[0]}: 📈 +${hilang}

🧯 *MODE DARURAT DIAKTIFKAN*
🔐 Sistem dikunci ulang...
💻 *Hack Gagal. Sistem menutup koneksi.*`;


    sock.sendMessage(from, { text: teks, mentions: [sender, data.target] }, { quoted: msg });
  }
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

    // Ambil nilai numerik
    const tanggal = waktu.getDate().toString().padStart(2, '0');
    const bulan = (waktu.getMonth() + 1).toString().padStart(2, '0'); // 0-based
    const tahun = waktu.getFullYear().toString();
    const jam = waktu.toTimeString().split(' ')[0]; // HH:MM:SS

    // Font fancy
    const fancy = (text) =>
        text
            .replace(/[a-z]/g, c => ({
                a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ',
                f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
                k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ',
                p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ',
                u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ'
            }[c]) || c)
            .replace(/[A-Z]/g, c => ({
                A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ',
                F: 'ғ', G: 'ɢ', H: 'ʜ', I: 'ɪ', J: 'ᴊ',
                K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ',
                P: 'ᴘ', Q: 'ǫ', R: 'ʀ', S: 'ꜱ', T: 'ᴛ',
                U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ'
            }[c]) || c);

    const toFancyNumber = (str) => str.replace(/\d/g, d => ({
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒',
        '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    }[d]));

    const versiFancy = toFancyNumber('1.0.0');
    const tanggalFancy = `${toFancyNumber(tanggal)}-${toFancyNumber(bulan)}-${toFancyNumber(tahun)}`;
    const jamFancy = toFancyNumber(jam);

    const readmore = String.fromCharCode(8206).repeat(4001); // WA Read More

    await sock.sendMessage(from, {
        image: { url: './logo.jpg' },
        caption:
`ꜱᴇʟᴀᴍᴀᴛ ᴅᴀᴛᴀɴɢ

> ɴᴀᴍᴀ          : ʙᴏᴛ ᴊᴀʀʀ
> ᴠᴇʀꜱɪ          : ${versiFancy}
> ᴛᴀɴɢɢᴀʟ   : ${tanggalFancy}
> ᴊᴀᴍ            : ${jamFancy}

${readmore}╭─〔 *🤖 ʙᴏᴛ ᴊᴀʀʀ ᴍᴇɴᴜ* 〕─╮
│
├─ 〔 🎮 *ɢᴀᴍᴇ* 〕
│ .kuis → Kuis pilihan ganda
│ .kuissusah → Kuis versi susah 
│ .suit → Main suit lawan teman
│ .judi → Tebak ganjil / genap
│ .truth → Jawab jujur
│ .dare → Lakukan tantangan
│ .tebak-aku → Tebakan lucu
│ .susunkata → Susun huruf
│ .family100 → Jawaban terbanyak
│
├─ 〔 🏳️‍🌈 *ꜰɪᴛᴜʀ ʟᴜᴄᴜ* 〕
│ .gay @user → Seberapa gay?
│ .lesbi @user → Seberapa lesbi?
│ .cantik @user → Seberapa cantik?
│ .ganteng @user → Seberapa ganteng?
│ .jodoh @user @user → Cocoklogi cinta
│
├─ 〔 🧠 *ᴀɪ ᴀꜱꜱɪꜱᴛᴀɴᴛ* 〕
│ .ai <pertanyaan> → Tanya ke AI
│
├─ 〔 🖼️ *ᴍᴇᴅɪᴀ* 〕
│ .stiker → Ubah gambar jadi stiker
│ .dwfoto → Unduh foto sekali lihat
│ .dwvideo → Unduh video sekali lihat
│
├─ 〔 🎥 *ᴛɪᴋᴛᴏᴋ ᴛᴏᴏʟꜱ* 〕
│ .ttmp3 <link> → Unduh mp3 TikTok
│ .wm <link> → Unduh tanpa watermark
│
├─ 〔 👥 *ꜰɪᴛᴜʀ ɢʀᴜᴘ* 〕
│ .tagall → Mention semua member
│
├─ 〔 📊 *ꜱᴋᴏʀ ɢᴀᴍᴇ* 〕
│ .skor → Lihat skor kamu
│ .kirimskor → Kirim skor ke teman
│
├─ 〔 📋 *ɪɴꜰᴏ* 〕
│ .shop → Buka menu shop
│ .info → Info bot & owner
│ .menu → Tampilkan menu ini
│
╰── 📅 ${tanggalFancy}

╭─〔 *🔐 ꜰɪᴛᴜʀ ᴠɪᴘ / ᴏᴡɴᴇʀ* 〕─╮
│
├─ 〔 👥 *ɢʀᴜᴘ ᴠɪᴘ* 〕
│ .kick @user → Kick user
│ .mute @user → Mute user
│ .unmute @user → Buka mute
│
├─ 〔 📊 *ꜱᴋᴏʀ ᴋʜᴜꜱᴜꜱ* 〕
│ .setskor → Atur skor user
│
├─ 〔 👑 *ᴠɪᴘ ᴄᴏɴᴛʀᴏʟ* 〕
│ .setvip @user → Jadikan VIP
│ .unsetvip @user → Cabut VIP
│ .listvip → Daftar VIP
│ .listskor → Daftar SKOR
│
├─ 〔 ⚙️ *ʙᴏᴛ ᴄᴏɴᴛʀᴏʟ* 〕
│ .on → Aktifkan bot
│ .off → Nonaktifkan bot
│
╰── 👑 Owner: @${OWNER_NUMBER?.split('@')[0] || '6283836348226'}`,
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

