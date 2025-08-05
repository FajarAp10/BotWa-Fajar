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
const sharp = require('sharp');
const mime = require('mime-types');
const { PDFDocument } = require('pdf-lib');
const pdfSessions = new Map(); 

const pdfLimit = new Map(); 
const MAX_PDF = 3;
const PDF_COOLDOWN = 60 * 60 * 1000; 
const pdfAksesSementara = new Map(); 


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const ongoingHacks = {};
const cooldownHack = new Map();
const COOLDOWN_TIME = 10 * 60 * 1000; 

const bratLimit = new Map(); 
const MAX_BRAT = 3;
const BRAT_COOLDOWN = 60 * 60 * 1000; 
const bratAksesSementara = new Map(); 


  const OWNER_NUMBER = '6283836348226@s.whatsapp.net'
  const PROXY_NUMBER = '6291100802986027@s.whatsapp.net'; 
  const BOT_NUMBER = '62882007141574@s.whatsapp.net';

  const ALIAS_OWNER = {
  '6291100802986027@s.whatsapp.net': OWNER_NUMBER,
  '91100802986027@s.whatsapp.net': OWNER_NUMBER
};

function normalizeJid(jid) {
    if (!jid || typeof jid !== 'string') return '';

    if (ALIAS_OWNER[jid]) return ALIAS_OWNER[jid];

    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) return jid;

    const noDomain = jid.split('@')[0];
    const reconstructed = noDomain + '@s.whatsapp.net';
    if (ALIAS_OWNER[reconstructed]) return ALIAS_OWNER[reconstructed];

    const numMatch = jid.match(/^\d{7,}$/);
    if (!numMatch) return jid;

    let number = numMatch[0];
    if (!number.startsWith('62')) number = '62' + number.replace(/^0+/, '');

    return number + '@s.whatsapp.net';
}

const vipPath = './vip.json';
let vipList = {};
try {
    vipList = JSON.parse(fs.readFileSync(vipPath));
} catch {
    vipList = {};
}

function isVIP(jid, groupId) {
    const realJid = normalizeJid(jid);
    if (realJid === OWNER_NUMBER) return true;
    if (!vipList[groupId]) return false;
    return vipList[groupId].includes(realJid);
}



function isOwner(jid) {
    const normalized = normalizeJid(jid);
    return normalized === OWNER_NUMBER || normalized === PROXY_NUMBER;
}


function addVIP(jid, groupId) {
    const realJid = normalizeJid(jid);
    if (!vipList[groupId]) vipList[groupId] = [];
    if (!vipList[groupId].includes(realJid)) {
        vipList[groupId].push(realJid);
        saveVIP();
    }
}

function saveVIP() {
    fs.writeFileSync(vipPath, JSON.stringify(vipList, null, 2));
}


const fiturSementaraPath = './fiturSementara.json';
let fiturSementara = {};


try {
    fiturSementara = JSON.parse(fs.readFileSync(fiturSementaraPath));
} catch (e) {
    fiturSementara = {};
}


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


let mutedUsers = {};
try {
    const data = fs.readFileSync('./muted.json');
    mutedUsers = JSON.parse(data);
} catch (e) {
    console.log('Gagal membaca file muted.json:', e);
}

function simpanMuted() {
    fs.writeFileSync('./muted.json', JSON.stringify(mutedUsers, null, 2));
}

function isMuted(userId, groupId) {
    return mutedUsers[groupId]?.includes(userId);
}

function muteUser(userId, groupId) {
    if (!mutedUsers[groupId]) mutedUsers[groupId] = [];
    if (!mutedUsers[groupId].includes(userId)) mutedUsers[groupId].push(userId);
    simpanMuted();
}

function unmuteUser(userId, groupId) {
    if (mutedUsers[groupId]) {
        mutedUsers[groupId] = mutedUsers[groupId].filter(id => id !== userId);
        simpanMuted();
    }
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
let skorUser = {}; 

function simpanSkorKeFile() {
    fs.writeFileSync(skorPath, JSON.stringify(skorUser, null, 2));
}


try {
    skorUser = JSON.parse(fs.readFileSync(skorPath));
} catch {
    console.log('📁 skor.json belum ada, akan dibuat otomatis.');
    skorUser = {};
}

function getGroupSkor(jid, roomId) {
    const realJid = normalizeJid(jid);
    if (!skorUser[roomId]) return 0;
    return skorUser[roomId][realJid] || 0;
}


function addGroupSkor(jid, roomId, poin) {
    const realJid = normalizeJid(jid);
    if (!skorUser[roomId]) skorUser[roomId] = {};
    if (!skorUser[roomId][realJid]) skorUser[roomId][realJid] = 0;
    skorUser[roomId][realJid] += poin;
    simpanSkorKeFile();
}

const antiSpamPath = './antispam.json';

let antiSpamStatus = {}; 

try {
    antiSpamStatus = JSON.parse(fs.readFileSync(antiSpamPath));
} catch {
    antiSpamStatus = {};
}

function simpanAntiSpam() {
    fs.writeFileSync(antiSpamPath, JSON.stringify(antiSpamStatus, null, 2));
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
const ongoingHacksSistem = {};

const soalKuisSusah = [
  { soal: "Apa satuan SI untuk fluks magnetik?", pilihan: ["A. Gauss", "B. Tesla", "C. Weber", "D. Henry", "E. Farad", "F. Ohm"], jawaban: "C" },
  { soal: "Siapa yang mengembangkan persamaan gelombang elektromagnetik?", pilihan: ["A. Newton", "B. Faraday", "C. Ampere", "D. Maxwell", "E. Tesla", "F. Hertz"], jawaban: "D" },
  { soal: "Apa nama teknik dalam AI untuk evaluasi nilai status permainan?", pilihan: ["A. Alpha-beta pruning", "B. Minimax", "C. Monte Carlo Tree Search", "D. Decision Tree", "E. KNN", "F. Q-Learning"], jawaban: "C" },
  { soal: "Unsur paling reaktif dalam tabel periodik adalah?", pilihan: ["A. Fluorin", "B. Klorin", "C. Litium", "D. Natrium", "E. Cesium", "F. Rubidium"], jawaban: "E" },
  { soal: "Siapa yang menyusun 5 postulat geometri Euclidean?", pilihan: ["A. Euclid", "B. Archimedes", "C. Pythagoras", "D. Thales", "E. Euler", "F. Gauss"], jawaban: "A" },
  { soal: "Apa teori tentang 'lubang cacing' berasal dari solusi persamaan Einstein?", pilihan: ["A. Schwarzschild", "B. Kerr", "C. Reissner-Nordström", "D. Einstein-Rosen Bridge", "E. Minkowski", "F. Penrose Diagram"], jawaban: "D" },
  { soal: "Apa nama model partikel dalam teori standar?", pilihan: ["A. Model Proton", "B. Model Atom Bohr", "C. Model Quark", "D. Model Kuantum", "E. Model String", "F. Model Standard"], jawaban: "F" },
  { soal: "Apa nama teori yang memperkirakan energi nol pada suhu absolut?", pilihan: ["A. Termodinamika I", "B. Termodinamika II", "C. Termodinamika III", "D. Entropi", "E. Kalorimetri", "F. Transfer Panas"], jawaban: "C" },
  { soal: "Apa nama proses pembentukan energi di matahari?", pilihan: ["A. Fisi", "B. Reaksi kimia", "C. Fusi nuklir", "D. Ionisasi", "E. Radiasi termal", "F. Fotosintesis"], jawaban: "C" },
  { soal: "Siapa penemu dasar-dasar kalkulus diferensial?", pilihan: ["A. Newton", "B. Leibniz", "C. Pascal", "D. Descartes", "E. Fermat", "F. Lagrange"], jawaban: "B" },
  { soal: "Apa fungsi utama mitokondria?", pilihan: ["A. Respirasi sel", "B. Sintesis protein", "C. Transport ion", "D. Produksi enzim", "E. Detoksifikasi", "F. Pembelahan sel"], jawaban: "A" },
  { soal: "Apa nama sistem bintang terdekat dari bumi selain Matahari?", pilihan: ["A. Sirius", "B. Vega", "C. Proxima Centauri", "D. Betelgeuse", "E. Rigel", "F. Aldebaran"], jawaban: "C" },
  { soal: "Hewan apa yang berevolusi paling awal di darat?", pilihan: ["A. Ikan", "B. Amfibi", "C. Reptil", "D. Mamalia", "E. Burung", "F. Serangga"], jawaban: "F" },
  { soal: "Apa nama konstanta Planck?", pilihan: ["A. 6.626×10⁻³⁴ Js", "B. 1.602×10⁻¹⁹ C", "C. 9.81 m/s²", "D. 3.0×10⁸ m/s", "E. 1.38×10⁻²³ J/K", "F. 6.022×10²³ mol⁻¹"], jawaban: "A" },
  { soal: "Siapa ilmuwan yang merumuskan prinsip ketidakpastian?", pilihan: ["A. Schrödinger", "B. Dirac", "C. Heisenberg", "D. Einstein", "E. Bohr", "F. Feynman"], jawaban: "C" },
  { soal: "Apa satuan untuk medan listrik dalam SI?", pilihan: ["A. V/m", "B. A/m", "C. N/C", "D. J/s", "E. F/m", "F. T"], jawaban: "C" },
  { soal: "Benda langit terbesar dalam tata surya?", pilihan: ["A. Jupiter", "B. Matahari", "C. Saturnus", "D. Bumi", "E. Neptunus", "F. Bulan"], jawaban: "B" },
  { soal: "Dalam biologi, proses transkripsi terjadi di mana?", pilihan: ["A. Ribosom", "B. Mitokondria", "C. Sitoplasma", "D. Nukleus", "E. Lisosom", "F. Golgi"], jawaban: "D" },
  { soal: "Apa nama kode genetik awal untuk sintesis protein?", pilihan: ["A. AUG", "B. UGA", "C. UAG", "D. UAA", "E. ATG", "F. GCG"], jawaban: "A" },
  { soal: "Apa nama perangkat lunak pertama untuk spreadsheet?", pilihan: ["A. Excel", "B. VisiCalc", "C. Lotus 1-2-3", "D. Numbers", "E. SuperCalc", "F. Quattro Pro"], jawaban: "B" },
  { soal: "Apa nama algoritma penyortiran tercepat rata-rata?", pilihan: ["A. Bubble Sort", "B. Merge Sort", "C. Quick Sort", "D. Heap Sort", "E. Insertion Sort", "F. Selection Sort"], jawaban: "C" },
  { soal: "Apa hasil dari integral tak tentu ∫ e^x dx?", pilihan: ["A. e^x + C", "B. x·e^x + C", "C. ln|x| + C", "D. 1/x + C", "E. x²/2 + C", "F. tan⁻¹(x) + C"], jawaban: "A" },
  { soal: "Siapa penemu transistor?", pilihan: ["A. Bardeen, Brattain, Shockley", "B. Feynman", "C. Tesla", "D. Edison", "E. Marconi", "F. Fleming"], jawaban: "A" },
  { soal: "Apa nama himpunan bilangan yang mencakup bilangan rasional dan irasional?", pilihan: ["A. Bilangan bulat", "B. Bilangan asli", "C. Bilangan real", "D. Bilangan kompleks", "E. Bilangan cacah", "F. Bilangan imajiner"], jawaban: "C" },
  { soal: "Apa hasil limit dari lim x→0 (sin x)/x?", pilihan: ["A. 0", "B. 1", "C. ∞", "D. Tidak ada", "E. x", "F. -1"], jawaban: "B" },
  { soal: "Teorema mana yang menyatakan bahwa fungsi kontinu pada interval tertutup mencapai nilai maksimum dan minimum?", pilihan: ["A. Teorema Rolle", "B. Teorema Nilai Rata-rata", "C. Teorema Bolzano", "D. Teorema Nilai Ekstrem", "E. Teorema L'Hopital", "F. Teorema Taylor"], jawaban: "D" },
  { soal: "Apa turunan dari fungsi f(x) = ln(x² + 1)?", pilihan: ["A. 2x/(x² + 1)", "B. 1/(x² + 1)", "C. x² + 1", "D. 2x ln(x)", "E. x/(x² + 1)", "F. 2/(x² + 1)"], jawaban: "A" },
  { soal: "Integral dari 1/(1 + x²) dx adalah?", pilihan: ["A. ln|x| + C", "B. tan⁻¹(x) + C", "C. e^x + C", "D. sin⁻¹(x) + C", "E. x² + C", "F. ln(1 + x²) + C"], jawaban: "B" },
  { soal: "Jika matriks A berordo 3x3 memiliki determinan 0, maka A bersifat?", pilihan: ["A. Invertibel", "B. Tidak memiliki determinan", "C. Singular", "D. Orthogonal", "E. Diagonal", "F. Simetris"], jawaban: "C" },
  { soal: "Apa nilai dari ∑(k=1 to n) k²?", pilihan: ["A. n(n+1)/2", "B. n(n+1)(2n+1)/6", "C. n³", "D. (n²+n)/2", "E. (n³+n)/3", "F. (n²+2n+1)/2"], jawaban: "B" },
  { soal: "Ruang vektor berdimensi tak hingga sering digunakan dalam?", pilihan: ["A. Geometri analitik", "B. Statistika", "C. Teori bilangan", "D. Analisis fungsional", "E. Trigonometri", "F. Topologi"], jawaban: "D" },
  { soal: "Apa solusi dari persamaan diferensial dy/dx = y?", pilihan: ["A. e^x + C", "B. ln(x) + C", "C. y = Ce^x", "D. x² + C", "E. C/x", "F. y = ln(x)"], jawaban: "C" },
  { soal: "Fungsi mana yang bukan fungsi bijektif?", pilihan: ["A. f(x) = x³", "B. f(x) = x", "C. f(x) = sin(x)", "D. f(x) = e^x", "E. f(x) = tan⁻¹(x)", "F. f(x) = ln(x)"], jawaban: "C" },
  { soal: "Apa nilai dari det([[1, 2], [3, 4]])?", pilihan: ["A. 2", "B. -2", "C. 10", "D. 5", "E. -5", "F. 0"], jawaban: "B" },
  { soal: "Pernyataan 'Setiap bilangan genap > 2 adalah hasil penjumlahan dua bilangan prima' dikenal sebagai?", pilihan: ["A. Hipotesis Riemann", "B. Teorema Fermat", "C. Konjektur Goldbach", "D. Teorema Euclid", "E. Teorema Wilson", "F. Konjektur Collatz"], jawaban: "C" },
  { soal: "Apa syarat agar fungsi f(x) terdiferensial di x = a?", pilihan: ["A. f kontinu di x = a", "B. f′(a) ada", "C. f terbatas", "D. f′(x) kontinu di sekitar a", "E. f′(a) = 0", "F. f tidak berubah di x = a"], jawaban: "A" },
  { soal: "Apa hasil integral ∫ x e^x dx?", pilihan: ["A. e^x(x - 1) + C", "B. e^x(x + 1) + C", "C. x² e^x + C", "D. ln|x|e^x + C", "E. x e^x - ∫ e^x dx", "F. e^(x²) + C"], jawaban: "B" },
  { soal: "Apa nama kurva yang terbentuk dari titik yang berjarak sama dari fokus dan garis directrix?", pilihan: ["A. Lingkaran", "B. Elips", "C. Parabola", "D. Hiperbola", "E. Spiral", "F. Kurva Euler"], jawaban: "C" },
  { soal: "Berapakah nilai dari log₄(64)?", pilihan: ["A. 3", "B. 4", "C. 5", "D. 6", "E. 2.5", "F. 2"], jawaban: "A" },
  { soal: "Apa nama metode iteratif untuk mencari akar fungsi?", pilihan: ["A. Metode Simpson", "B. Metode Runge-Kutta", "C. Metode Newton-Raphson", "D. Metode Euler", "E. Metode Trapesium", "F. Metode Lagrange"], jawaban: "C" },
  { soal: "Jika f(x) = x³ - 3x + 1, berapa jumlah titik stasionernya?", pilihan: ["A. 0", "B. 1", "C. 2", "D. 3", "E. 4", "F. Tak Hingga"], jawaban: "C" },
  { soal: "Apa nama operator dalam aljabar linear untuk rotasi vektor di R²?", pilihan: ["A. Matriks Identitas", "B. Matriks Simetris", "C. Matriks Rotasi", "D. Matriks Singular", "E. Matriks Diagonal", "F. Matriks Proyeksi"], jawaban: "C" },
  { soal: "Apa nama teorema yang menyatakan bahwa tidak ada solusi umum untuk polinomial derajat 5 atau lebih?", pilihan: ["A. Teorema Abel-Ruffini", "B. Teorema Gauss", "C. Teorema Fundamental Aljabar", "D. Teorema Lagrange", "E. Teorema Galois", "F. Teorema Fermat"], jawaban: "A" },
  { soal: "Berapakah nilai dari ∑(n=1 to ∞) 1/n²?", pilihan: ["A. π", "B. π²/6", "C. ∞", "D. 1", "E. e", "F. ln(2)"], jawaban: "B" },
  { soal: "Jika z adalah bilangan kompleks, maka z·z̄ = ?", pilihan: ["A. 1", "B. 0", "C. |z|²", "D. -z", "E. z̄", "F. Im(z)"], jawaban: "C" },
  { soal: "Apa nama distribusi probabilitas diskret dengan parameter n dan p?", pilihan: ["A. Normal", "B. Poisson", "C. Binomial", "D. Geometrik", "E. Eksponensial", "F. Beta"], jawaban: "C" },
  { soal: "Apa hasil dari ∫ cos²x dx?", pilihan: ["A. (x + sin2x)/2 + C", "B. sinx + C", "C. cosx + C", "D. x/2 + C", "E. x + cos2x + C", "F. (x - sin2x)/2 + C"], jawaban: "A" },
  { soal: "Persamaan garis singgung lingkaran x² + y² = r² di titik (a,b) adalah?", pilihan: ["A. ax + by = r²", "B. x² + y² = ab", "C. ax + by = ab", "D. x + y = r", "E. ax - by = r", "F. a² + b² = r²"], jawaban: "A" },
  { soal: "Apa nilai dari d/dx (arctan(x))?", pilihan: ["A. 1/(1 + x²)", "B. x/(1 + x²)", "C. 1/√(1 - x²)", "D. x²", "E. e^x", "F. ln(x)"], jawaban: "A" },
  { soal: "Jika A adalah matriks orthogonal, maka AᵀA =", pilihan: ["A. Matriks nol", "B. Matriks identitas", "C. Matriks diagonal", "D. Matriks singular", "E. Matriks rotasi", "F. Matriks transpos"], jawaban: "B" },
  { soal: "Dalam kombinatorik, C(n, r) = ?", pilihan: ["A. n! / (r!(n−r)!)", "B. n! / r!", "C. n × r", "D. (n + r)! / n!", "E. (n−r)! / r!", "F. r! / (n−r)!"], jawaban: "A" },
  { soal: "Apa nama rumus untuk jumlah deret aritmetika?", pilihan: ["A. n/2(a + l)", "B. a·rⁿ", "C. a + (n−1)d", "D. n(a + d)", "E. a + n·d", "F. l·n"], jawaban: "A" },
  { soal: "Apa nama software yang pertama kali menampilkan GUI?", pilihan: ["A. Windows", "B. macOS", "C. Xerox Alto", "D. Linux", "E. Ubuntu", "F. MS-DOS"], jawaban: "C" },
  { soal: "Apa metode untuk mengamati mikroorganisme tanpa pewarnaan?", pilihan: ["A. Mikroskop cahaya", "B. Pewarna Gram", "C. Fase kontras", "D. Elektron transmisi", "E. Fluoresen", "F. SEM"], jawaban: "C" },
  { soal: "Apa nama operasi militer AS di Irak tahun 2003?", pilihan: ["A. Desert Storm", "B. Rolling Thunder", "C. Enduring Freedom", "D. Iraqi Freedom", "E. Anaconda", "F. Neptune Spear"], jawaban: "D" },
  { soal: "Apa teori yang menjelaskan asal semesta paralel?", pilihan: ["A. Relativitas Umum", "B. Big Bang", "C. Multiverse", "D. String", "E. Kuantum", "F. Inflasi"], jawaban: "C" },
  { soal: "Apa nama planet dengan rotasi paling cepat?", pilihan: ["A. Mars", "B. Bumi", "C. Jupiter", "D. Uranus", "E. Saturnus", "F. Venus"], jawaban: "C" },
  { soal: "Nama senyawa dengan rumus H₂SO₄?", pilihan: ["A. Asam nitrat", "B. Asam klorida", "C. Asam sulfat", "D. Asam asetat", "E. Asam fosfat", "F. Asam karbonat"], jawaban: "C" },
  { soal: "Kapan Perang Dunia I dimulai?", pilihan: ["A. 1912", "B. 1914", "C. 1916", "D. 1918", "E. 1920", "F. 1930"], jawaban: "B" },
  { soal: "Apa nama proses perubahan padat ke gas langsung?", pilihan: ["A. Konveksi", "B. Kondensasi", "C. Sublimasi", "D. Deposisi", "E. Evaporasi", "F. Koagulasi"], jawaban: "C" },
  { soal: "Siapa penulis karya *The Republic*?", pilihan: ["A. Aristoteles", "B. Socrates", "C. Plato", "D. Cicero", "E. Seneca", "F. Thales"], jawaban: "C" },
  { soal: "Apa simbol kimia untuk emas?", pilihan: ["A. Au", "B. Ag", "C. Fe", "D. Cu", "E. Sn", "F. Hg"], jawaban: "A" },
  { soal: "Siapa penemu hukum inersia?", pilihan: ["A. Galileo", "B. Newton", "C. Kepler", "D. Descartes", "E. Copernicus", "F. Hooke"], jawaban: "A" },
  { soal: "Berapa jumlah gigi orang dewasa normal?", pilihan: ["A. 30", "B. 32", "C. 28", "D. 36", "E. 34", "F. 26"], jawaban: "B" },
  { soal: "Siapa pelukis *Guernica*?", pilihan: ["A. Da Vinci", "B. Michelangelo", "C. Picasso", "D. Rembrandt", "E. Van Gogh", "F. Matisse"], jawaban: "C" },
  { soal: "Apa nama sistem penyandian genetik?", pilihan: ["A. Triplet", "B. Codon", "C. Nukleotida", "D. RNA", "E. DNA", "F. Ribosom"], jawaban: "B" },
  { soal: "Dimana letak pusat gravitasi pada benda simetris?", pilihan: ["A. Di atas", "B. Di bawah", "C. Di tengah", "D. Di sisi", "E. Di ujung", "F. Tidak ada"], jawaban: "C" },
  { soal: "Apa alat ukur tekanan udara?", pilihan: ["A. Anemometer", "B. Barometer", "C. Termometer", "D. Altimeter", "E. Hygrometer", "F. Dinamometer"], jawaban: "B" },
  { soal: "Apa hukum Boyle menyatakan?", pilihan: ["A. Tekanan berbanding terbalik dengan volume", "B. Volume tetap", "C. Tekanan tetap", "D. Suhu tetap", "E. Massa tetap", "F. Energi tetap"], jawaban: "A" },
  { soal: "Apa nama kode enkripsi publik paling populer saat ini?", pilihan: ["A. AES", "B. DES", "C. RSA", "D. SHA", "E. MD5", "F. ECC"], jawaban: "C" },
  { soal: "Berapa derajat sudut segitiga sama sisi?", pilihan: ["A. 30°", "B. 45°", "C. 60°", "D. 90°", "E. 120°", "F. 180°"], jawaban: "C" },
  { soal: "Satuan daya listrik adalah?", pilihan: ["A. Watt", "B. Volt", "C. Ampere", "D. Joule", "E. Ohm", "F. Henry"], jawaban: "A" },
  { soal: "Apa simbol kimia untuk timah?", pilihan: ["A. Sn", "B. Sb", "C. S", "D. Si", "E. Sr", "F. Sc"], jawaban: "A" },
  { soal: "Apa hukum Newton kedua?", pilihan: ["A. F = ma", "B. Aksi = reaksi", "C. Inersia", "D. Gravitasi", "E. Gaya sentripetal", "F. Momentum"], jawaban: "A" }
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
const sesiJudi = new Map(); // key: sender, value: { msgId }


const userCooldownMap = new Map(); // Map<JID, timestamp>


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

    const from = msg.key.remoteJid; // ID room: grup atau pribadi
    const isGroup = from.endsWith('@g.us');

    // Cari ID pengirim sebenarnya
    let rawSender = null;

    if (isGroup) {
        rawSender = msg.key.participant || msg.participant;
    } else {
        rawSender = msg.key.remoteJid; // chat pribadi
    }

    // Kalau masih null (jarang), ambil dari contextInfo
    if (!rawSender && msg.message?.extendedTextMessage?.contextInfo?.participant) {
        rawSender = msg.message.extendedTextMessage.contextInfo.participant;
    }

    const sender = normalizeJid(rawSender); // ID pengirim sebenarnya
    const isRealOwner = sender === OWNER_NUMBER;


        const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption || '';

        const imageContent = (
            msg.message?.imageMessage ||
            msg.message?.documentMessage?.mimetype?.includes("image") && msg.message.documentMessage ||
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
        );
  

        const msgType = Object.keys(msg.message)[0];
        const body = text.toLowerCase(); // ⬅ WAJIB ADA!
        console.log(`📩 Pesan dari ${from}: ${text}`);

            
        if (isGroup && !grupAktif.has(from)) {
            grupAktif.set(from, true); // Otomatis aktif saat grup baru
            simpanGrupAktif();
        }

        if (isGroup && !grupAktif.get(from) && text.trim() !== '.on') {
            return; // Masih bisa .off manual
        }
const sessionKey = isGroup ? `${from}:${sender}` : sender;
const currentPdfSession = pdfSessions.get(sessionKey);

if (currentPdfSession) {
    // Kalau pengguna mengirim nama file PDF
    if (
        text.trim().length > 0 &&
        !['.pdfgo','.pdf'].includes(body.trim()) &&
        !msg.message?.imageMessage
    ) {
        currentPdfSession.fileName = text.trim();
        await sock.sendMessage(from, {
            text: `📁 Nama file disimpan sebagai: *${text.trim()}.pdf*\n🛠️ Ketik *.pdfgo* untuk menyelesaikannya.`,
            quoted: msg
        });
        return;
    }

    // Kalau kirim teks lain selain itu
    if (
        !msg.message?.imageMessage &&
        !['.pdfgo','.pdf'].includes(body.trim())
    ) {
        return;
    }
}



if (msg.message?.imageMessage) {
    const imageSenderKey = isGroup ? `${from}:${sender}` : sender;
    const session = pdfSessions.get(imageSenderKey);

    if (session) {
        try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
                reuploadRequest: sock.updateMediaMessage
            });

            session.buffers.push(buffer);
        } catch (e) {
            console.log('❌ Gagal unduh gambar:', e);
        }
    }
}



        // 🗨️ Respon pertama kali
        if (!userHistory.has(from)) {
            userHistory.add(from);
            await sock.sendMessage(from, {
                text: "Halo saya adalah bot AI WhatsApp yang dibuat oleh Fajar, Gunakan *.menu* untuk melihat list tools yang tersedia."
            });
        }

        

function tambahSkor(jid, groupId, poin) {
  const realJid = normalizeJid(jid);
 
  if (!skorUser[groupId]) skorUser[groupId] = {};
  if (!skorUser[groupId][realJid]) skorUser[groupId][realJid] = 0;
  skorUser[groupId][realJid] += poin;
  simpanSkorKeFile();
}



if (isMuted(sender, from)) {
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
│ • .belipdf ➜ Akses *.pdf*
│ • .belibrat ➜ Akses *.brat*
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
    const skor = getGroupSkor(sender, from);
    const hargaVIP = 10000;

    if (isVIP(sender, from)) {
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

    addGroupSkor(sender, from, -hargaVIP);
    simpanSkorKeFile();
    addVIP(sender, from); // ✅ pakai from
    saveVIP();

    await sock.sendMessage(from, {
        text: `🎉 *Pembelian Berhasil!*\n\n👑 *Selamat*, kamu telah menjadi *VIP Member*!\n\n💰 Harga: *${hargaVIP} poin*\n🔓 Fitur VIP kini aktif dan bisa kamu gunakan.\n\nTerima kasih telah mendukung bot ini! 🚀`
    });
    return;
}

if (text === '.belipdf') {
    const harga = 2500;
    const durasiMs = 5 * 60 * 1000; // 5 menit
    const skor = getGroupSkor(sender, from);

    if (isOwner(sender) || isVIP(sender, from)) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses permanen ke fitur *.pdf*.'
        });
    }

    const now = Date.now();
    const expired = pdfAksesSementara.get(sender);

    if (expired && now < expired) {
        const sisaMenit = Math.ceil((expired - now) / 60000);
        return sock.sendMessage(from, {
            text: `✅ Kamu masih punya akses sementara ke *.pdf* selama *${sisaMenit} menit* lagi.`
        });
    }

    if (skor < harga) {
        return sock.sendMessage(from, {
            text: `❌ *Skor Tidak Cukup!*\n\n📛 Butuh *${harga} poin* untuk beli akses *.pdf*\n🎯 Skor kamu: *${skor} poin*\n\n🔥 Main dan kumpulkan skor!`
        });
    }

    addGroupSkor(sender, from, -harga);
    simpanSkorKeFile();

    const waktuBerakhir = moment(now + durasiMs).tz('Asia/Jakarta').format('HH:mm:ss');
    pdfAksesSementara.set(sender, now + durasiMs);

    return sock.sendMessage(from, {
        text: `✅ *Akses Sementara Berhasil Dibeli!*\n\n📌 Akses *.pdf* aktif selama *5 menit*\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan selama waktu berlaku! 🚀`
    });
}


if (text === '.belibrat') {
    const harga = 2500;
    const durasiMs = 5 * 60 * 1000; // 30 menit
    const skor = getGroupSkor(sender, from);

    if (isOwner(sender) || isVIP(sender)) {
        return sock.sendMessage(from, {
            text: '✅ Kamu sudah punya akses permanen ke fitur *.brat*.'
        });
    }

    const now = Date.now();
    const expired = bratAksesSementara.get(sender);

    if (expired && now < expired) {
        const sisaMenit = Math.ceil((expired - now) / 60000);
        return sock.sendMessage(from, {
            text: `✅ Kamu masih punya akses sementara ke *.brat* selama *${sisaMenit} menit* lagi.`
        });
    }

    if (skor < harga) {
        return sock.sendMessage(from, {
            text: `❌ *Skor Tidak Cukup!*\n\n📛 Butuh *${harga} poin* untuk beli akses *.brat*\n🎯 Skor kamu: *${skor} poin*\n\n🔥 Main dan kumpulkan skor!`
        });
    }

    addGroupSkor(sender, from, -harga);
    simpanSkorKeFile();

    const waktuBerakhir = moment(now + durasiMs).tz('Asia/Jakarta').format('HH:mm:ss');
    bratAksesSementara.set(sender, now + durasiMs);

    return sock.sendMessage(from, {
        text: `✅ *Akses Sementara Berhasil Dibeli!*\n\n📌 Akses *.brat* aktif selama *5 menit*\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan selama waktu berlaku! 🚀`
    });
}


if (text === '.belikick') {
    if (!isGroup) return sock.sendMessage(from, {
        text: '❌ Fitur ini hanya bisa digunakan di dalam grup.'
    });

   const skor = getGroupSkor(sender, from);
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

    if (!skorUser[from]) skorUser[from] = {};
skorUser[from][sender] = skor - harga;

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

    const skor = getGroupSkor(sender, from);

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

    if (!skorUser[from]) skorUser[from] = {};
skorUser[from][sender] = skor - harga;

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

   const skor = getGroupSkor(sender, from);

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

    if (!skorUser[from]) skorUser[from] = {};
skorUser[from][sender] = skor - harga;

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

    const skor = getGroupSkor(sender, from);

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

    if (!skorUser[from]) skorUser[from] = {};
skorUser[from][sender] = skor - harga;

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

    const skor = getGroupSkor(sender, from);

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

    if (!skorUser[from]) skorUser[from] = {};
skorUser[from][sender] = skor - harga;

    simpanSkorKeFile();

    const expired = Date.now() + 60_000; // 1 menit
    const waktuBerakhir = moment(expired).tz('Asia/Jakarta').format('HH:mm:ss');
    addTemporaryFeature(sender, 'listskor', from);

    return sock.sendMessage(from, {
        text: `✅ *Akses .listskor Berhasil Dibeli!*\n\n📊 Kamu telah membeli akses ke *fitur .listskor* selama *1 menit*.\n\n💰 Harga: *${harga} poin*\n🕒 Berlaku sampai: *${waktuBerakhir} WIB*\n\nGunakan sekarang sebelum waktunya habis.`
    });
}

if (text.trim() === '.skor') {
    const roomKey = from;
    const realJid = normalizeJid(sender); // pastikan ini sama literalnya dengan yang disimpan

    const poin = skorUser[roomKey]?.[realJid] || 0;

    await sock.sendMessage(from, {
        text: `📊 *SKOR KAMU*\n───────────────\n📱 Nomor: @${realJid.split('@')[0]}\n🏆 Skor: *${poin} poin*`,
        mentions: [sender]
    });

    return;
}


if (text.startsWith('.allskor')) {
  if (!isGroup) {
    await sock.sendMessage(from, { text: '❌ Perintah ini hanya untuk grup.' }, { quoted: msg });
    return;
  }

  if (!isOwner(sender) && !isVIP(sender, from)) {
    await sock.sendMessage(from, { text: '🔐 Perintah ini hanya untuk Owner atau VIP.' }, { quoted: msg });
    return;
  }

  const args = text.trim().split(/\s+/);
  const jumlah = parseInt(args[1]);

  if (!jumlah || isNaN(jumlah) || jumlah <= 0) {
    await sock.sendMessage(from, {
      text: '❗ Gunakan format: *.allskor <jumlah>*'
    }, { quoted: msg });
    return;
  }

  const metadata = await sock.groupMetadata(from);
  const groupMembers = metadata.participants.map(p => p.id);
  const pengirim = sender;

  if (!skorUser[from]) skorUser[from] = {};

  const diberikanKe = [];

  for (const id of groupMembers) {
    if (id === BOT_NUMBER) continue; // lewati bot
    if (!skorUser[from][id]) skorUser[from][id] = 0;
    skorUser[from][id] += jumlah;
    diberikanKe.push(id);
  }

  simpanSkorKeFile();

  // Kirim hasil
  let teks = `🎁 *SKOR TELAH DIKIRIM KE SEMUA MEMBER*\n━━━━━━━━━━━━━━━━━━\n`;
  teks += `📤 Pengirim: @${pengirim.split('@')[0]}\n📦 Jumlah: *+${jumlah}* ke setiap member\n👥 Total Penerima: *${diberikanKe.length} orang*\n\n📋 *Daftar:*\n`;

  const preview = diberikanKe.slice(0, 10);
  preview.forEach((id, i) => {
    teks += `• ${i + 1}. @${id.split('@')[0]}\n`;
  });

  if (diberikanKe.length > 10) {
    teks += `\n...dan ${diberikanKe.length - 10} lainnya`;
  }

  await sock.sendMessage(from, {
    text: teks,
    mentions: [pengirim, ...diberikanKe]
  }, { quoted: msg });
}


if (body.startsWith('.listskor')) {
  if (!isVIP(sender, from) && !hasTemporaryFeature(sender, 'listskor')) {
    await sock.sendMessage(from, {
      text: '❌ Perintah hanya bisa digunakan *Owner* dan *VIP*.'
    }, { quoted: msg });
    return;
  }

  if (!isGroup) {
    await sock.sendMessage(from, {
      text: '❌ Perintah ini hanya bisa digunakan di dalam grup.'
    }, { quoted: msg });
    return;
  }

  const groupMetadata = await sock.groupMetadata(from);
  const groupMembers = groupMetadata.participants.map(p => p.id);

  const skorGrup = skorUser[from] || {};
  const skorKeys = Object.keys(skorGrup).filter(jid => groupMembers.includes(jid));

  if (skorKeys.length === 0) {
    await sock.sendMessage(from, {
      text: '📊 Belum ada data skor.'
    }, { quoted: msg });
    return;
  }

  const sorted = skorKeys.sort((a, b) => (skorGrup[b] || 0) - (skorGrup[a] || 0));

  let teks = `╔══ 📊 *DAFTAR SKOR* 📊 ══╗\n`;

  if (groupMembers.includes(OWNER_NUMBER)) {
    const skorOwner = skorGrup[OWNER_NUMBER] || 0;
    teks += `║ 👑 Owner : @${OWNER_NUMBER.split('@')[0]} → *${skorOwner} poin*\n`;
  }

  let count = 1;
  for (const jid of sorted) {
    if (jid === OWNER_NUMBER) continue;
    const skor = skorGrup[jid] || 0;
    teks += `║ ${count++}. @${jid.split('@')[0]} → *${skor} poin*\n`;
  }

  teks += `╚═════════════════════╝`;

  await sock.sendMessage(from, {
    text: teks,
    mentions: [OWNER_NUMBER, ...sorted.filter(jid => jid !== OWNER_NUMBER)]
  }, { quoted: msg });
}


// .listvip
if (body.startsWith('.listvip')) {
  if (!isVIP(sender, from) && !hasTemporaryFeature(sender, 'listvip')) {
    await sock.sendMessage(from, {
      text: '❌ Perintah hanya bisa digunakan *Owner* dan *VIP*.'
    }, { quoted: msg });
    return;
  }

  if (!isGroup) {
    await sock.sendMessage(from, {
      text: '❌ Perintah hanya bisa digunakan di grup.'
    }, { quoted: msg });
    return;
  }

  const metadata = await sock.groupMetadata(from);
  const groupMembers = metadata.participants.map(p => p.id);

  const allVIP = (vipList[from] || []).filter(jid => groupMembers.includes(jid));
  const vipLain = allVIP.filter(jid => jid !== OWNER_NUMBER);

  let teks = `╔══ 🎖️ *DAFTAR VIP* 🎖️ ══╗\n`;

  if (groupMembers.includes(OWNER_NUMBER)) {
    teks += `║ 👑 Owner : @${OWNER_NUMBER.split('@')[0]}\n`;
  }

  if (vipLain.length === 0) {
    teks += `║\n║ Belum ada VIP di grup ini.\n`;
  } else {
    vipLain.forEach((jid, i) => {
      teks += `║ ${i + 1}. @${jid.split('@')[0]}\n`;
    });
  }

  teks += `╚═══════════════════╝`;
    const mentions = [...allVIP];
    if (!mentions.includes(OWNER_NUMBER) && groupMembers.includes(OWNER_NUMBER)) {
    mentions.push(OWNER_NUMBER);
    }

    await sock.sendMessage(from, {
    text: teks,
    mentions
    }, { quoted: msg });

}


// .setvip
if (body.startsWith('.setvip') && isGroup) {
  if (!isVIP(sender, from)) {
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

  const target = normalizeJid(mentioned[0]);

  if ((vipList[from] || []).includes(target)) {
    return sock.sendMessage(from, {
      text: `⚠️ @${target.split('@')[0]} sudah VIP.`,
      mentions: [target]
    }, { quoted: msg });
  }

  if (!vipList[from]) vipList[from] = [];
  vipList[from].push(target);
  saveVIP();

  return sock.sendMessage(from, {
    text: `✅ @${target.split('@')[0]} sekarang adalah *VIP*!`,
    mentions: [target]
  }, { quoted: msg });
}

// .unsetvip
if (body.startsWith('.unsetvip') && isGroup) {
  if (!isVIP(sender, from)) {
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

  const target = normalizeJid(mentioned[0]);

  if (target === OWNER_NUMBER) {
    return sock.sendMessage(from, {
      text: `🚫 Owner tidak bisa dihapus dari VIP!`
    }, { quoted: msg });
  }

  if (!vipList[from] || !vipList[from].includes(target)) {
    return sock.sendMessage(from, {
      text: `⚠️ @${target.split('@')[0]} bukan VIP.`,
      mentions: [target]
    }, { quoted: msg });
  }

  vipList[from] = vipList[from].filter(jid => jid !== target);
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

        if (!isVIP(sender, from) && sender !== OWNER_NUMBER) {
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

    const groupId = msg.key.remoteJid; // atau `from` kalau sudah kamu buat
if (!skorUser[groupId]) skorUser[groupId] = {};
skorUser[groupId][targetJid] = angka;
simpanSkorKeFile();

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

    if (!isVIP(sender, from) && !hasTemporaryFeature(sender, 'mute')) {
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

    if ([OWNER_NUMBER, BOT_NUMBER].includes(mentionedJid)) {
        await sock.sendMessage(from, {
            text: '❌ Tidak bisa mute Owner atau Bot.'
        });
        return;
    }

    // ✅ Panggil fungsi yang kamu buat
    muteUser(mentionedJid, from);

    await sock.sendMessage(from, {
        text: `🔇 @${mentionedJid.split('@')[0]} telah dimute.`,
        mentions: [mentionedJid]
    });

    console.log('📁 File muted.json sekarang:', JSON.stringify(mutedUsers, null, 2));
}

if (text.startsWith('.unmute')) {
    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: '❌ Perintah hanya bisa digunakan di grup.' });
        return;
    }

    if (!isVIP(sender, from) && !hasTemporaryFeature(sender, 'unmute')) {
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

    if (isMuted(mentionedJid, from)) {
        unmuteUser(mentionedJid, from);
        await sock.sendMessage(from, {
            text: `✅ @${mentionedJid.split('@')[0]} telah di-unmute dari grup ini.`,
            mentions: [mentionedJid]
        });
    } else {
        await sock.sendMessage(from, { text: '⚠️ User ini tidak sedang dimute di grup ini.' });
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
            tambahSkor(sender, from, 15);
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
    const idUser = normalizeJid(sender);
    if (!skorUser[from]) skorUser[from] = {};
    const skorSekarang = skorUser[from][idUser] || 0;
    const skorBaru = skorSekarang - 60;
    skorUser[from][idUser] = skorBaru;
    simpanSkorKeFile();
    
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
                tambahSkor(sender, from, 10);
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
                tambahSkor(sender, from, 30);
                await sock.sendMessage(from, {
                    text: `✅ *Benar!* Jawabanmu adalah *${userAnswer}* 🎉\n🏆 Kamu mendapatkan *+40 poin!*\n\nMau coba lagi? Ketik *.kuissusah*`
                });
            } else {
                tambahSkor(sender, from, -50); // kurangi 50
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
             tambahSkor(sender, from, 20);
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

    tambahSkor(sender, from, 20); // ✅ Tambahkan poin 5 jika benar

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
    const skor = getGroupSkor(sender, from);


    if (skor < 30) {
        await sock.sendMessage(from, {
            text: `🚫 *Skor kamu terlalu rendah!*\n━━━━━━━━━━━━━━━\n📉 Skor saat ini: *${skor} poin*\n🔒 Minimal skor untuk ikut judi adalah *30 poin*\n\n💡 Ayo main kuis atau tebak-tebakan dulu untuk kumpulkan skor!`,
            mentions: [sender]
        });
        return;
    }

    const kirim = await sock.sendMessage(from, {
        text: `🎰 *GAME JUDI GANJIL / GENAP*\n━━━━━━━━━━━━━━━━━━\n🧠 *Cara Main:*\nPilih salah satu:\n\n🔴 *Ganjil*\n🔵 *Genap*\n\n📥 *Balas pesan ini* untuk bermain\n\n🎁 Hadiah:\n• Benar ➜ +50 poin\n• Salah ➜ -55 poin\n━━━━━━━━━━━━━━━━━━\n💰 Skor kamu saat ini: *${skor} poin*\n🎲 Ayo uji keberuntunganmu!`,
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
        const poinSebelum = (skorUser[from] && skorUser[from][sender]) || 0;
        let poinTambahan = 0;

        if (benar) {
            poinTambahan = 50;
        } else {
            poinTambahan = -55;
        }

        tambahSkor(sender, from, poinTambahan);
       const poinSesudah = (skorUser[from] && skorUser[from][sender]) || 0;


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

// 🧊 STIKER DENGAN RASIO GAMBAR ASLI + WATERMARK
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
      
        await sock.sendMessage(from, {
            react: {
                text: '⏳',
                key: msg.key
            }
        });

        console.log("📥 Mengunduh media...");
        const mediaBuffer = await downloadMediaMessage(messageForMedia, "buffer", {}, { logger: console });

        const sharp = require('sharp');
        const { Sticker } = require('wa-sticker-formatter');

        const { width, height } = await sharp(mediaBuffer).metadata();
        const size = Math.max(width, height);

        const resizedBuffer = await sharp(mediaBuffer)
            .resize({
                width: size,
                height: size,
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp({ lossless: true })
            .toBuffer();

        const sticker = new Sticker(resizedBuffer, {
            type: 'FULL',
            pack: 'StikerBot',
            author: 'JarrAI',
            quality: 100
        });

        await sock.sendMessage(from, await sticker.toMessage(), { quoted: msg });
        await sock.sendMessage(from, {
        react: {
            text: '✅',
            key: msg.key
        }
    });


        console.log(`✅ Stiker berhasil dikirim ke ${from}`);
    } catch (err) {
        console.error("❌ Gagal membuat stiker:", err);
        await sock.sendMessage(from, { text: "❌ Gagal membuat stiker. Pastikan gambar tidak rusak dan coba lagi." });
    }

    return;
}

if (text.toLowerCase().startsWith('.teks')) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const stickerQuoted = quotedMsg?.stickerMessage;

    if (!stickerQuoted) {
        await sock.sendMessage(from, {
            text: '❌ Fitur ini hanya untuk *reply stiker*.\nContoh: *.teks Halo semua*',
        }, { quoted: msg });
        return;
    }

    const userText = text.replace('.teks', '').trim();
    if (!userText) {
        await sock.sendMessage(from, {
            text: '❌ Kamu harus menuliskan teks.\nContoh: *.teks Halo semua*',
        }, { quoted: msg });
        return;
    }

        // Kirim reaction jam pasir
    await sock.sendMessage(from, {
        react: {
            text: '⏳',
            key: msg.key
        }
    });


    try {
        const mediaBuffer = await downloadMediaMessage(
            { message: { stickerMessage: stickerQuoted } },
            'buffer',
            {},
            { logger: console }
        );

        const image = sharp(mediaBuffer);
        const { width, height } = await image.metadata();

        const words = userText.trim().split(/\s+/);
        const totalWords = words.length;
        const idealLineCount = Math.ceil(Math.sqrt(totalWords)); // Ex: 4 kata → 2 baris

        const wordsPerLine = Math.ceil(totalWords / idealLineCount);
        const lines = [];

        for (let i = 0; i < totalWords; i += wordsPerLine) {
            lines.push(words.slice(i, i + wordsPerLine).join(' '));
        }


        const lineCount = lines.length;
        const fontSize = Math.floor(height / (7 + lineCount)); // lebih kecil dan proporsional
        const lineSpacing = Math.floor(fontSize * 1.1);
        const verticalOffset = 30; // makin besar, makin ke bawah
        const startY = height - (lineSpacing * lineCount) + verticalOffset;


        let svgText = `
<svg width="${width}" height="${height}">
  <style>
    .teks {
      font-size: ${fontSize}px;
      font-family: Arial, sans-serif;
      font-weight: bold;
      fill: white;
      stroke: black;
      stroke-width: 8px;
      paint-order: stroke;
    }
  </style>
`;

        lines.forEach((line, index) => {
            const y = startY + index * lineSpacing;
            svgText += `<text x="50%" y="${y}" text-anchor="middle" class="teks">${line}</text>\n`;
        });

        svgText += `</svg>`;

        const bufferWithText = await sharp(mediaBuffer)
            .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
            .webp()
            .toBuffer();

        const sticker = new Sticker(bufferWithText, {
            type: 'FULL',
            pack: 'StikerBot',
            author: 'JarrAI',
            quality: 100
        });

        await sock.sendMessage(from, await sticker.toMessage(), { quoted: msg });
        await sock.sendMessage(from, {
        react: {
            text: '✅',
            key: msg.key
        }
    });


    } catch (err) {
        console.error('❌ Gagal menambahkan teks ke stiker:', err);
        await sock.sendMessage(from, {
            text: '❌ Gagal memproses stiker. Pastikan stikernya valid dan coba lagi.'
        }, { quoted: msg });
    }

    return;
}


if (text.toLowerCase().startsWith('.brat')) {
    const userText = text.replace('.brat', '').trim();
    if (!userText) {
        await sock.sendMessage(from, {
            text: '❌ Contoh: *.brat kamu kemana*'
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

    const isBypass = isOwner(sender) || isVIP(sender, from);
    const now = Date.now();
    const aksesBrat = bratAksesSementara.get(sender);
    const isTemporaryActive = aksesBrat && now < aksesBrat;

    // VIP dan Owner bebas limit
if (!(isOwner(sender) || isVIP(sender, from) || isTemporaryActive)) {
    const record = bratLimit.get(sender);
    if (record) {
        if (now - record.time < BRAT_COOLDOWN) {
            if (record.count >= MAX_BRAT) {
                const sisa = Math.ceil((BRAT_COOLDOWN - (now - record.time)) / 60000);
                await sock.sendMessage(from, {
                   text: `🚫 *Limit Tercapai*\n\nKamu hanya bisa memakai *.brat* 3x per jam.\n⏳ Tunggu *${sisa} menit* lagi atau beli akses *.belibrat* 30 menit.\n\n💡 *Tips:* Beli akses *VIP* agar bisa memakai *.brat* tanpa batas waktu.`,

                    mentions: [sender]
                }, { quoted: msg });
                return;
            } else record.count++;
        } else {
            bratLimit.set(sender, { count: 1, time: now });
        }
    } else {
        bratLimit.set(sender, { count: 1, time: now });
    }
}


    try {
        const width = 512;
        const height = 512;
        const maxLineWidth = 470;
        let fontSize = 130;

        const words = userText.split(/\s+/);
        const estimateWordWidth = (word, size) => word.length * size * 0.6;

        function generateLines(size) {
            const result = [[]];
            let currentLineWidth = 0;
            for (let word of words) {
                const wordWidth = estimateWordWidth(word, size);
                if (currentLineWidth + wordWidth > maxLineWidth && result[result.length - 1].length > 0) {
                    result.push([word]);
                    currentLineWidth = wordWidth;
                } else {
                    result[result.length - 1].push(word);
                    currentLineWidth += wordWidth + 25 + Math.random() * 15;
                }
            }
            return result;
        }

        function isOverflow(lines, size) {
            const lineHeight = size + 20;
            if (lines.length * lineHeight > 480) return true;
            for (const line of lines) {
                let lineWidth = 0;
                for (const word of line) {
                    lineWidth += estimateWordWidth(word, size) + 25 + Math.random() * 15;
                }
                if (lineWidth > maxLineWidth) return true;
            }
            return false;
        }

        let lines = [];
        let tryFont = fontSize;

        while (tryFont >= 60) {
            const candidateLines = generateLines(tryFont);
            if (!isOverflow(candidateLines, tryFont)) {
                lines = candidateLines;
                fontSize = tryFont;
                break;
            }
            if (candidateLines.length <= 2 && words.length >= 6) tryFont -= 2;
            else tryFont -= 4;
        }

        if (lines.length === 0) {
            fontSize = 60;
            lines = generateLines(fontSize);
        }

        const lineHeight = fontSize + 20;
        const totalHeight = lines.length * lineHeight;
        const verticalBias = Math.floor((height - totalHeight) / 2 + fontSize * 0.40 + lines.length * 5);
        let y = verticalBias + 8; // buffer biar huruf gak nempel atas

        let svgText = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <style>
    .brat {
      font-family: Arial, Helvetica, sans-serif;
      fill: black;
      font-size: ${fontSize}px;
    }
  </style>\n`;

        for (const line of lines) {
            let x = 30;
            for (let word of line) {
                const yOffset = y + Math.floor(Math.random() * 6 - 3);
                svgText += `<text x="${x}" y="${yOffset}" class="brat">${word}</text>\n`;
                const wordWidth = estimateWordWidth(word, fontSize);
                x += wordWidth + 25 + Math.random() * 10;
            }
            y += lineHeight + Math.floor(Math.random() * 10);
        }

        svgText += `</svg>`;

        const buffer = await sharp({
            create: {
                width,
                height,
                channels: 4,
                background: 'white'
            }
        })
        .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
        .webp()
        .toBuffer();

        const sticker = new Sticker(buffer, {
            type: 'FULL',
            pack: 'brat-anomali',
            author: 'JarrAI',
            quality: 100
        });

        await sock.sendMessage(from, await sticker.toMessage(), { quoted: msg });
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

    } catch (err) {
        console.error(err);
        await sock.sendMessage(from, {
            text: '❌ Gagal membuat stiker brat.'
        }, { quoted: msg });
    }
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
    
    if (!skorUser[from]) skorUser[from] = {};
    if (!skorUser[from][pengirim]) skorUser[from][pengirim] = 0;
    if (!skorUser[from][target]) skorUser[from][target] = 0;

    if (skorUser[from][pengirim] < jumlah) {
        await sock.sendMessage(from, {
            text: `Skormu tidak cukup!\n💰 Skor kamu: *${skorUser[from][pengirim]}*`
        });
        return;
    }

skorUser[from][pengirim] -= jumlah;
skorUser[from][target] += jumlah;
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
    const realJid = normalizeJid(sender);
    const isRealOwner = realJid === OWNER_NUMBER || msg.key.fromMe;

    if (!isRealOwner) {
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
        text: `🔴 *Bot Dimatikan*\n\n📅 Tanggal: ${waktu}\n\n👑 Owner: @${OWNER_NUMBER.split('@')[0]}`,
        mentions: [OWNER_NUMBER]
    });

    return;
}


if (text.trim() === '.on') {
    
    const isRealOwner = isOwner(sender) || msg.key.fromMe;
    console.log("sender JID:", sender);
console.log("normalized:", normalizeJid(sender));
console.log("isOwner:", isOwner(sender));

    
    if (!isRealOwner) {
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
        text: `✅ *Bot Aktif*\n\n🟢 Status: *ON*\n📅 Tanggal: ${waktu}\n\n👑 Owner: @${OWNER_NUMBER.split('@')[0]}`,
        mentions: [OWNER_NUMBER]
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

if (text.startsWith('.hacksistem')) {
  if (!isGroup) return sock.sendMessage(from, { text: '🚫 Fitur ini hanya untuk grup!' }, { quoted: msg });

  if (isVIP(sender)) return sock.sendMessage(from, {
    text: `🛡️ Kamu sudah terdaftar sebagai *VIP*\nTidak perlu membobol sistem lagi.`,
  }, { quoted: msg });

  const now = Date.now();
  const last = cooldownHack.get(sender); // pakai cooldownHack Map YANG SUDAH ADA
  if (last && now - last < COOLDOWN_TIME) {
    const wait = Math.ceil((COOLDOWN_TIME - (now - last)) / 60000);
    return sock.sendMessage(from, {
      text: `🕒 *[ COOLDOWN AKTIF ]*\n\n🚫 Tunggu *${wait} menit* lagi sebelum mencoba hack sistem kembali.`,
    }, { quoted: msg });
  }

  cooldownHack.set(sender, now); // pasang cooldown setelah lewat cek

  const hackerId = sender;
  const token = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join('');
  const clue = token.split('').sort(() => Math.random() - 0.5).join('');

  ongoingHacksSistem[hackerId] = {
    token,
    clue,
    timeout: setTimeout(() => {
      delete ongoingHacksSistem[hackerId];
      muteUser(hackerId, from);
      if (!skorUser[from]) skorUser[from] = {};
      skorUser[from][hackerId] = 0;
      simpanSkorKeFile();

     sock.sendMessage(from, {
  text: `💀 *[ CONNECTION TERMINATED - TIMEOUT EXCEEDED ]*

⏳ *Waktu habis!* Tidak ada respons dalam *20 detik kritis*...
⚠️ *Sistem mendeteksi ini sebagai ancaman.*

━━━━━━━━━━━━━━━━━━━━
🔐 *Status Sistem:*
• 🔇 *AUTO-MUTE → AKTIF*
• 📉 *SKOR DIHAPUS → 100% RESET*
• 🚫 *AKSES DIBLOKIR PERMANEN*
━━━━━━━━━━━━━━━━━━━━

🧬 *Identitas digitalmu telah dihapus dari semua node utama...*
🛰️ *Jaringan satelit memutuskan koneksi secara paksa...*

📛 *User Flagged as: UNAUTHORIZED ENTITY*
📂 *Log disimpan untuk audit keamanan pusat...*

🔚 *Misi dinyatakan gagal. Coba lagi jika mampu melawan sistem ini.*`,
  mentions: [hackerId]
}, { quoted: msg });


    }, 20_000)
  };

  const teks = `💻 *[ HACKING INTERFACE INITIALIZED... ]*

🔍 Menyusup ke sistem *VIP CORE SECURITY*
🛰️ Mengakses jaringan satelit privat...
🔒 Proteksi aktif → *VIP FIREWALL*

🧬 Token ditemukan → *~${clue}~*
🔓 Sistem menunggu validasi akses...

*🧠 Tugas:* Susun token asli dan reply:
> *Format* : 12345

━━━━━━━━━━━━━━━━━━━━
🔄 [▓░░░░░░░░░░░] 12%
🔄 [▓▓▓░░░░░░░░░] 35%
🔄 [▓▓▓▓▓▓░░░░░░] 40%
🔄 [▓▓▓▓▓▓▓▓▓▓▓▓] 100%
━━━━━━━━━━━━━━━━━━━━

📌 *Wajib reply ke pesan ini!*
🕒 Batas waktu: *20 detik!*`;

  sock.sendMessage(from, { text: teks, mentions: [hackerId] }, { quoted: msg });

  // 🔒 Bocoran dikirim ke owner:
  if (OWNER_NUMBER && OWNER_NUMBER !== hackerId) {
    sock.sendMessage(OWNER_NUMBER, {
      text: `🕵️‍♂️ *[ LOG: Percobaan Hack VIP ]*\n\n🔐 Token Asli: *${token}*\n🧑 Pelaku: @${hackerId.split('@')[0]}\n📍 Grup: ${from}`,
      mentions: [hackerId]
    });
  }
}

// === Handler untuk reply jawaban token
else if (ongoingHacksSistem[sender]) {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return sock.sendMessage(from, {
    text: '⚠️ *Wajib reply ke pesan sistem!*',
  }, { quoted: msg });

  const jawaban = text.replace(/[^0-9]/g, '').trim();
  const data = ongoingHacksSistem[sender];
  clearTimeout(data.timeout);
  delete ongoingHacksSistem[sender];

  if (jawaban === data.token) {
    addVIP(sender, from);
    saveVIP();

   sock.sendMessage(from, {
  text: `🟢 *[ SYSTEM BREACHED SUCCESSFULLY ]*

💾 *Token Validated*: ✅ *${data.token}*
🔓 *Firewall Status*: ✅ *Bypassed*
📁 *Secure Access Granted...*

━━━━━━━━━━━━━━━━━━━━
🎖️ *[ VIP CORE UNLOCKED! ]*
🛰️ Kamu telah berhasil hack akses VIP.
👤 ID: @${sender.split('@')[0]}
🔐 Status: *AUTHORIZED ACCESS*

📡 Sistem: *Selamat datang, Agen Baru...*
━━━━━━━━━━━━━━━━━━━━

💡 *Akses istimewa telah dibuka.*`,
  mentions: [sender]
}, { quoted: msg });

  } else {
   muteUser(sender, from);
    if (!skorUser[from]) skorUser[from] = {};
    skorUser[from][sender] = 0;
    simpanSkorKeFile();
sock.sendMessage(from, {
  text: `🔴 *[ INTRUSION DETECTED - ACCESS DENIED ]*

🧠 *Token Validasi*: ❌ *Mismatch Detected!*
🚨 *Akses ilegal telah teridentifikasi...*
🔐 *Sistem keamanan diaktifkan secara otomatis...*

━━━━━━━━━━━━━━━━━━━━
💥 *KONEKSI DIPUTUS PAKSA*
🔇 Status: *MUTE - User Terblokir*
📉 Semua skor: *Dihapus permanen*
📛 ID: @${sender.split('@')[0]} → *DITANDAI SEBAGAI PENYUSUP*
━━━━━━━━━━━━━━━━━━━━

🛰️ *Firewall Aktifkan Mode Agresif*
🔍 *Melacak pola serangan...*
🗂️ *Merekam percobaan akses ke log pusat...*

📌 *Pesan terakhir sistem:*
_"Jangan coba-coba meretas sistem yang tidak kamu pahami."_`,
  mentions: [sender]
}, { quoted: msg });

  }
}


else if (text.startsWith('.hack')) {
  if (!isGroup) return sock.sendMessage(from, { text: '🚫 Fitur ini hanya bisa digunakan di dalam grup!' }, { quoted: msg });

  const target = mentionByTag[0];
  if (!target) return sock.sendMessage(from, { text: 'Tag target *@user* untuk hack' }, { quoted: msg });

  if (isOwner(target) || isVIP(target)) {
    return sock.sendMessage(from, {
     text: `🚷 *[ AKSES DITOLAK! ]*

🛡️ *Sistem Keamanan Aktif!*
🎖️ Target: @${target.split('@')[0]} terdaftar sebagai *VIP / OWNER*

🔒 *Proteksi tingkat tinggi terdeteksi...*
📡 *Firewall menghalangi akses masuk...*
💥 *Upaya peretasan dihentikan secara otomatis!*

❗ *HACK GAGAL. Sistem diamankan kembali.*`,

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
    const skor = getGroupSkor(sender, from);
    const potong = Math.floor(skor * 0.8); // 80% dari skor hacker
    const skorAkhir = Math.max(0, skor - potong);
    const targetSkor = (skorUser[from] && skorUser[from][target]) || 0;

    skorUser[from][sender] = skorAkhir;
   if (!skorUser[from]) skorUser[from] = {};
if (!skorUser[from][target]) skorUser[from][target] = 0;
skorUser[from][target] += potong;
simpanSkorKeFile();


 sock.sendMessage(from, {
  text: `💀 *[ OPERATION FAILED - TIMEOUT EXCEEDED ]*

🕵️ *@${hackerId}* gagal menyelesaikan misi hack tepat waktu!
🕒 *20 detik kritis telah berlalu tanpa respons...*

━━━━━━━━━━━━━━━━━━━━
⚠️ *ALERT: Sistem keamanan aktif!*
🔐 *Firewall otomatis menolak koneksi.*
💣 *Skor kamu disita sistem target!*
━━━━━━━━━━━━━━━━━━━━

📊 *DATA KERUGIAN:*
• Kamu: 📉 *-${potong}* → *${skorAkhir}*
• Target @${target.split('@')[0]}: 📈 *+${potong}*

🧯 *Sesi peretasan ditutup dan dikunci ulang.*
🛰️ *Koneksi satelit diputus paksa...*
📛 *Agen diberi status: INEFFECTIVE OPERATIVE*

🔚 *Coba lagi jika kamu cukup tangguh...*`,
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
const teks = `🧠 *[ HACKING PROTOCOL ENGAGED ]*
━━━━━━━━━━━━━━━━━━━━━━━

🎯 *TARGET IDENTIFIED:* @${target.split('@')[0]}
🌐 *Geo-IP:* Indonesia (Node-7B)
🔐 *Initializing Firewall Override...*

📡 *ESTABLISHING UPLINK...*
[▓░░░░░░░░░░] 17% 
[▓▓▓▓░░░░░░░] 42% 
[▓▓▓▓▓▓░░░░░] 67% 
[▓▓▓▓▓▓▓▓▓▓▓] 100% ✅

🧬 *ENCRYPTED TOKEN FOUND:  ~${clue}~* 
🔓 Sistem menunggu validasi akses...
━━━━━━━━━━━━━━━━━━━━━━━
📌 *DECRYPTION REQUIRED!*
> Susun ulang token asli.
> Format: *125*

⏳ *20 DETIK SEBELUM SISTEM LOCKDOWN!*
━━━━━━━━━━━━━━━━━━━━━━━`;

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
if (!skorUser[from]) skorUser[from] = {}; // pastikan grup ada

const skorSender = skorUser[from][sender] || 0;
const skorTarget = skorUser[from][data.target] || 0;

if (jawaban === data.token) {
  skorUser[from][sender] = skorSender + skorTarget;
  skorUser[from][data.target] = 0;
  simpanSkorKeFile();

 const teks = `✅ *[ ACCESS GRANTED - HACK SUCCESSFUL ]*

🧠 *Token Divalidasi*: 🟢 Cocok!
🔓 *Firewall Ditembus • Sistem Terbuka*

📥 *Mengambil data sistem target...*
🧬 *Menyalin DNA digital dan kredensial...*
💰 *Mentransfer seluruh skor ke identitas kamu...*

📊 *TRANSFER BERHASIL!*
┌────── STATUS ──────┐
│ 🎯 Target  : @${data.target.split('@')[0]} = ❌ *0* 
│ 🧑‍💻 Kamu    : *${skorSender + skorTarget}* (📈 +${skorTarget})
└────────────────────┘

🛰️ *Sistem mengkonfirmasi otoritas baru...*
🧿 Identitasmu kini sebagai *MASTER OVERRIDE*

🎉 *EKSEKUSI HACK SELESAI.*
🔚 *Koneksi diamankan ulang.*`;

sock.sendMessage(from, { text: teks, mentions: [sender, data.target] }, { quoted: msg });

  } else {
   const hilang = skorSender; // semua skor hacker hilang
const newSender = 0;
const newTarget = skorTarget + hilang;

if (!skorUser[from]) skorUser[from] = {}; // pastikan grup ada

skorUser[from][sender] = newSender;
skorUser[from][data.target] = newTarget;

simpanSkorKeFile();

 const teks = `⛔ *[ BREACH FAILED - TOKEN INVALID ]*

💣 *INTRUSION BLOCKED BY TARGET SYSTEM!*
🛡️ Validasi token GAGAL → Sistem melawan balik...

📡 *Sinyal digital kamu berhasil dilacak...*
📍 *Posisi dikunci, IP device terekam sistem target!*
🔐 *Proteksi aktif → SCORE COUNTERMEASURE DEPLOYED*

💸 *Skor kamu DIHAPUS secara paksa!*
🎯 *Target berhasil menyita seluruh datamu...*

📊 *SKOR DITRANSFER OTOMATIS:*
╭───────────────╮
│ ❌ Kamu   : 0 (-${hilang})
│ 📥 Target : @${data.target.split('@')[0]} 📈 +${hilang}
╰───────────────╯

💀 *STATUS: IDENTITAS TERBLOKIR*
🛰️ Koneksi terputus oleh sistem target.
💻 *MISSION FAILED. You're blacklisted.*`;

sock.sendMessage(from, { text: teks, mentions: [sender, data.target] }, { quoted: msg });

  }
}


if (text === '.pdf') {
    const sessionKey = isGroup ? `${from}:${sender}` : sender;

    const isBypass = isOwner(sender) || isVIP(sender, from);
    const now = Date.now();
    const aksesSementara = pdfAksesSementara.get(sender);
    const isTemporaryActive = aksesSementara && now < aksesSementara;

    // Kalau bukan VIP/Owner/Sementara -> Cek limit
    if (!isBypass && !isTemporaryActive) {
        const record = pdfLimit.get(sender);
        if (record) {
            if (now - record.time < PDF_COOLDOWN) {
                if (record.count >= MAX_PDF) {
                    const sisa = Math.ceil((PDF_COOLDOWN - (now - record.time)) / 60000);
                    await sock.sendMessage(from, {
                        text: `🚫 *Limit Tercapai*\n\nKamu hanya bisa memakai *.pdf* ${MAX_PDF}x per jam.\n⏳ Tunggu *${sisa} menit* lagi atau beli akses *.belipdf* 5 menit.\n\n💡 *Tips:* Beli akses *VIP* agar bisa memakai *.pdf* tanpa batas waktu.`,
                        mentions: [sender]
                    }, { quoted: msg });
                    return;
                } else {
                    record.count++;
                }
            } else {
                pdfLimit.set(sender, { count: 1, time: now });
            }
        } else {
            pdfLimit.set(sender, { count: 1, time: now });
        }
    }

    if (pdfSessions.has(sessionKey)) {
        await sock.sendMessage(from, {
            text: '📥 *Mode PDF sedang aktif.',
            quoted: msg
        });
        return;
    }

    pdfSessions.set(sessionKey, {
    buffers: [],
    fileName: null,
    isPrivate: !isGroup
});


    await sock.sendMessage(from, {
        text: '📥 *Mode PDF Aktif!*\n\nSilakan kirim foto yang ingin dijadikan PDF.\n\nSetelah mengirim foto bisa *mengetik nama file PDF* (contoh: `Tugas IPA`).\n\n✅ Jika sudah selesai, ketik *.pdfgo* untuk membuat dan mengunduh PDF nya.',
        quoted: msg
    });
    return;
}

if (text === '.pdfgo') {
    const sessionKey = isGroup ? `${from}:${sender}` : sender;
    const session = pdfSessions.get(sessionKey);

    if (!session) {
        await sock.sendMessage(from, {
            text: '❌ Belum ada sesi aktif. Ketik *.pdf* dulu untuk mulai kumpulkan gambar.',
            quoted: msg
        });
        return;
    }

    if (session.buffers.length === 0) {
        pdfSessions.delete(sessionKey);
        await sock.sendMessage(from, {
            text: '❌ Tidak ada gambar yang dikumpulkan. Mode PDF dibatalkan.',
            quoted: msg
        });
        return;
    }

    try {
        const pdfDoc = await PDFDocument.create();

        for (const buffer of session.buffers) {
            const image = await pdfDoc.embedJpg(buffer).catch(() => pdfDoc.embedPng(buffer));
            const { width, height } = image.scale(1);
            const page = pdfDoc.addPage([width, height]);
            page.drawImage(image, { x: 0, y: 0, width, height });
        }

        const pdfBytes = await pdfDoc.save();
        pdfSessions.delete(sessionKey);

        await sock.sendMessage(from, {
            document: Buffer.from(pdfBytes),
            mimetype: 'application/pdf',
            fileName: (session.fileName || 'file').replace(/[\\/:*?"<>|]/g, '') + '.pdf'
        }, { quoted: msg });

        await sock.sendMessage(from, {
        react: {
            text: '✅',
            key: msg.key
        }
    });


    } catch (err) {
        pdfSessions.delete(sessionKey);
        console.error('❌ Gagal buat PDF:', err);
        await sock.sendMessage(from, {
            text: '❌ Terjadi kesalahan saat membuat PDF.',
            quoted: msg
        });
    }

    return;
}



if (text.trim() === '.info') {
    const teks = `╭───〔 📡 *INFORMASI JARR BOT* 〕───╮
│ 🤖 *Nama Bot* : JARR AI BOT
│ 👑 *Owner*    : Fajar Aditya Pratama
│ 🧠 *Model AI* : GPT-3.5-turbo (OpenAI)
│ 🛠️ *Bahasa*   : Node.js + Baileys API
│ 🧬 *Fitur*    : AI, Game, Media Tools
│ 🌐 *Versi*    : 1.0.0 Beta
│ ⏱️ *Aktif*    : 24 Jam Nonstop
│
├──〔 🚀 *Fitur Unggulan* 〕
│ • Chat AI Asisten (OpenAI)
│ • Kuis & Game Tebakan Interaktif
│ • Downloader TikTok & YouTube
│ • Unduh media sekali lihat (foto/video)
│ • Generator Stiker WA
│ • Kontrol Grup: Tagall, Mute, Kick, VIP
│
├──〔 🔗 *Info Tambahan* 〕
│ 📞 *Kontak Owner* : wa.me/6283836348226
│ 💾 *Library*      : Baileys MD
│ 🔒 *VIP Support*  : Ya 
│ 🛡️ *Proteksi*     : Anti abuse + auto mute
╰────────────────────────────╯`;

    await sock.sendMessage(from, { text: teks }, { quoted: msg });
    return;
}

if (text.trim() === '.menu') {
    const waktu = new Date();

    // Ambil nilai numerik
    const tanggal = waktu.getDate().toString().padStart(2, '0');
    const bulan = (waktu.getMonth() + 1).toString().padStart(2, '0'); // 0-based
    const tahun = waktu.getFullYear().toString();
  

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
   

    const readmore = String.fromCharCode(8206).repeat(4001); // WA Read More

    await sock.sendMessage(from, {
        image: { url: './logo.jpg' },
        caption:
`ꜱᴇʟᴀᴍᴀᴛ ᴅᴀᴛᴀɴɢ

> ɴᴀᴍᴀ          : ʙᴏᴛ ᴊᴀʀʀ
> ᴀᴜᴛᴏʀ        : ꜰᴀᴊᴀʀ
> ᴠᴇʀꜱɪ          : ${versiFancy}
> ᴛᴀɴɢɢᴀʟ    : ${tanggalFancy}

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
│ .ai <pertanyaan → Tanya ke AI
│
├─ 〔 🖼️ *ᴍᴇᴅɪᴀ* 〕
│ .pdf → Ubah gambar jadi pdf
│ .stiker → Ubah gambar jadi stiker
│ .teks → Beri teks di stiker
│ .brat → Membuat stiker kata
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
├─ 〔 🧰 *ᴛᴏᴏʟꜱ ɪʟᴇɢᴀʟ* 〕
│ .hack @user → Retas skor orang
│ .hacksistem→ Retas akses VIP
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
│ .allskor → Kirim skor ke semua
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


startBot().catch(err => console.error('❌ Error saat menjalankan bot:', err));

