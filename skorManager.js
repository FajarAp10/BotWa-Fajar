const fs = require('fs');
const skorFile = './skor.json';

function loadSkor() {
    if (!fs.existsSync(skorFile)) return {};
    return JSON.parse(fs.readFileSync(skorFile));
}

function saveSkor(data) {
    fs.writeFileSync(skorFile, JSON.stringify(data, null, 2));
}

function ambilSkor(user) {
    const data = loadSkor();
    return data[user] || 0;
}

function tambahSkor(user, poin) {
    const data = loadSkor();
    data[user] = (data[user] || 0) + poin;
    saveSkor(data);
}

module.exports = {
    loadSkor,
    saveSkor,
    ambilSkor,
    tambahSkor
};
