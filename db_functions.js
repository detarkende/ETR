const oracledb = require('oracledb');
const bcrypt = require('bcrypt');

oracledb.autoCommit = true;

if (process.platform === "win32") {
    oracledb.initOracleClient({libDir: 'C:\oracle\instantclient_19_10'});
}

async function conn() {
    var connection = await oracledb.getConnection({
        user: "ADMIN",
        password: "!m98#VdM5PRtGuh",
        connectString: "adatbalapu2021_high"
    });
    return await connection;
}





/**
 * 
 * @param {String} name Name of registered user
 * @param {String} pw Password in plain text
 * @param {String} table OKTATO || HALLGATO
 */
async function register(name, pw, table) {
    if (['HALLGATO', 'OKTATO'].includes(table) != true) {
        console.log('itt a baj', table);
        return false;
    }
    let tempConn = await conn();
    password = await bcrypt.hash(pw, 10);
    //console.log(password);
    let result = await tempConn.execute(`INSERT INTO ${table} (NAME, PWHASH) VALUES (:name, :pw)`, [name, password]);
    console.log(result);
    let id = await tempConn.execute(`SELECT MAX(${table}ID) FROM ${table}`);
    return await id.rows[0][0];
}







/**
 * 
 * @param {Number | String} id User ID 
 * @param {String} password the entered Password String
 * @param {String} table OKTATO | HALLGATO
 * @returns User array: [ userID, Name ]
 * @throws Exception with description
 */
async function login(id, password, table) {
    if (['HALLGATO', 'OKTATO'].includes(table) != true) {
        console.log('itt a baj', table);
        return false;
    }
    let tempConn = await conn();
    let user = await tempConn.execute(`SELECT * FROM ${table} WHERE ${table}ID = :id`, [id]);
    if (user.rows == []) {
        throw 'Az azonosito helytelen, vagy nincs regisztralva';
        return;
    }
    if (await bcrypt.compare(password, user.rows[0][1])) {
        return [ user.rows[0][0], user.rows[0][2], table.toLowerCase() ];
    }
    else {
        throw 'Helytelen jelszo.';
        return;
    }
}


// KURZUSOK
async function ujKurzus(id, nev) {
    let tempConn = await conn();
    await tempConn.execute(`INSERT INTO KURZUS (OKTATOID, KURZUSNEV) VALUES(:id, :nev)`, [id, nev]);
    return;
}

async function osszesKurzusom(id) {
    let tempConn = await conn();
    let user = await tempConn.execute(`SELECT * FROM KURZUS WHERE OKTATOID = :id`, [id]);
    return user.rows;
}

async function deleteKurzus(userID, kurzusID) {
    let tempConn = conn();
    let result = await (await tempConn).execute(`SELECT (OKTATOID) FROM KURZUS WHERE KURZUSID = :kurzusID`, [kurzusID]);
    console.log(result);
    if (result.rows[0][0] != userID) {
        throw "Unauthorized";
    }
    console.log('elotte')
    try {
        await (await tempConn).execute(`DELETE FROM KURZUS WHERE KURZUSID = :kurzusid`, [kurzusID]);
    } catch (error) {
        console.log(error)
    }
    console.log('utana');
    return;
}


// VIZSGAK
async function ujVizsga(oktatoID, kurzusID, kezdes, hossz, ferohelyek) {
    let kezsesIdopontja = new Date(Date.parse(kezdes)).toISOString();
    let vegzesIdopontja = new Date(Date.parse(kezdes) + (hossz * 60000)).toISOString();
    let tempConn = await conn();
    let result = await tempConn.execute(`SELECT (OKTATOID) FROM KURZUS WHERE KURZUSID = :kurzusid`, [kurzusID]);
    if (result.rows[0][0] != oktatoID) {
        console.warn(result.rows)
        throw "Unauthorized";
    }
    try {
        await tempConn.execute(`
        INSERT INTO Vizsgaalkalom(KurzusID, kezdesIdopont, vegzesIdopont, ferohelyekSzama)
    VALUES(:kurzusid, TO_DATE(:kezdes,'YYYY-MM-DD"T"HH24:MI:SS."000Z"'), TO_DATE(:vegzes,'YYYY-MM-DD"T"HH24:MI:SS."000Z"'), :ferohelyek)`,
            [kurzusID, kezsesIdopontja, vegzesIdopontja, ferohelyek]);
        return;
    }
    catch (err) {
        console.log(err);
    }
    return;
}

async function osszesVizsgam(id) {
    let tempConn = await conn();
    try {
        let vizsgak = await tempConn.execute(`SELECT VIZSGAALKALOM.VIZSGAALKALOMID, KURZUS.KURZUSNEV, VIZSGAALKALOM.KEZDESIDOPONT, VIZSGAALKALOM.VEGZESIDOPONT, VIZSGAALKALOM.FEROHELYEKSZAMA 
        FROM VIZSGAALKALOM, KURZUS 
        WHERE VIZSGAALKALOM.KURZUSID = KURZUS.KURZUSID AND KURZUS.OKTATOID = :oktatoid`, [id]);
        return vizsgak.rows;
    } catch (error) {
        console.log(error);
    }
}

async function felvehetoKurzusok(hallgatoID) {
    let tempConn = await conn();
    let kurzusok = await tempConn.execute(`
        SELECT KURZUS.KURZUSID, KURZUS.KURZUSNEV FROM
        KURZUS FULL OUTER JOIN KURZUSFELVETEL
        ON KURZUS.KURZUSID = KURZUSFELVETEL.KURZUSID
        WHERE KURZUSFELVETEL.HALLGATOID != :hallgatoID OR KURZUSFELVETEL.KURZUSID IS NULL
    `, [hallgatoID]);
    return kurzusok.rows;
}

async function felvettKurzusaim(hallgatoID) {
    let tempConn = await conn();
    let kurzusok = await tempConn.execute(`
        SELECT KURZUS.KURZUSID, KURZUS.KURZUSNEV FROM
        KURZUS LEFT JOIN KURZUSFELVETEL
        ON KURZUS.KURZUSID = KURZUSFELVETEL.KURZUSID
        WHERE KURZUSFELVETEL.HALLGATOID = :hallgatoID
    `, [hallgatoID]);
    return kurzusok.rows;
}

async function kurzusJelentkezes(hallgatoID, kurzusID) {
    let tempConn = await conn();
    await tempConn.execute(`INSERT INTO KURZUSFELVETEL (HALLGATOID, KURZUSID) VALUES (:hallgatoID, :kurzusID)`, [hallgatoID, kurzusID]);
    return;
}

// VIZSGAIM
async function felvehetoVizsgak(hallgatoID) {
    let tempConn = await conn();
    let vizsgak = await tempConn.execute(`
        SELECT VIZSGAALKALOM.VIZSGAALKALOMID, KURZUS.KURZUSNEV, VIZSGAALKALOM.KEZDESIDOPONT, VIZSGAALKALOM.VEGZESIDOPONT, VIZSGAALKALOM.FEROHELYEKSZAMA FROM
        VIZSGAALKALOM FULL OUTER JOIN VIZSGAFELVETEL
        ON VIZSGAFELVETEL.VIZSGAALKALOMID = VIZSGAFELVETEL.VIZSGAALKALOMID
        LEFT JOIN KURZUS
        ON KURZUS.KURZUSID = VIZSGAALKALOM.KURZUSID
        WHERE VIZSGAFELVETEL.HALLGATOID != :hallgatoID OR VIZSGAFELVETEL.VIZSGAALKALOMID IS NULL
    `, [hallgatoID]);
    return vizsgak.rows;
}

async function felvettVizsgaim(hallgatoID) {
    let tempConn = await conn();
    let vizsgak = await tempConn.execute(`
        SELECT VIZSGAALKALOM.VIZSGAALKALOMID, KURZUS.KURZUSNEV, VIZSGAALKALOM.KEZDESIDOPONT, VIZSGAALKALOM.VEGZESIDOPONT, VIZSGAALKALOM.FEROHELYEKSZAMA FROM
        VIZSGAALKALOM LEFT JOIN VIZSGAFELVETEL
        ON VIZSGAFELVETEL.VIZSGAALKALOMID = VIZSGAFELVETEL.VIZSGAALKALOMID
        LEFT JOIN KURZUS
        ON KURZUS.KURZUSID = VIZSGAALKALOM.KURZUSID
        WHERE VIZSGAFELVETEL.HALLGATOID = :hallgatoID
    `, [hallgatoID]);
    return vizsgak.rows;
}

async function vizsgaJelentkezes(hallgatoID, vizsgaID) {
    let tempConn = await conn();
    await tempConn.execute(`INSERT INTO VIZSGAFELVETEL (HALLGATOID, VIZSGAALKALOMID) VALUES (:hallgatoID, :vizsgaID)`, [hallgatoID, vizsgaID]);
    return;
}


exports.register = register;
exports.login = login;

exports.ujKurzus = ujKurzus;
exports.osszesKurzusom = osszesKurzusom;
exports.deleteKurzus = deleteKurzus;

exports.ujVizsga = ujVizsga;
exports.osszesVizsgam = osszesVizsgam;

exports.felvehetoKurzusok = felvehetoKurzusok;
exports.felvettKurzusaim = felvettKurzusaim;
exports.kurzusJelentkezes = kurzusJelentkezes;

exports.felvehetoVizsgak = felvehetoVizsgak;
exports.felvettVizsgaim = felvettVizsgaim;
exports.vizsgaJelentkezes = vizsgaJelentkezes;