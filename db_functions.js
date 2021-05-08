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
    try {
        password = await bcrypt.hash(pw, 10);
        let result = await tempConn.execute(`INSERT INTO ${table} (NAME, PWHASH) VALUES (:name, :pw)`, [name, password]);
        console.log(result);
        let id = await tempConn.execute(`SELECT MAX(${table}ID) FROM ${table}`);
        return await id.rows[0][0];
    } catch (e) {
        console.error(e);
    }
    finally {
        await tempConn.close();
    }
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
    await tempConn.close();
    if (await bcrypt.compare(password, user.rows[0][1])) {
        return [ user.rows[0][0], user.rows[0][2], table.toLowerCase() ];
    }
    else {
        throw 'Helytelen jelszo.';
        return;
    }
}

async function getHirek() {
    let tempConn = await conn();
    let rows = await tempConn.execute(`
        SELECT OKTATO.NAME, HIR.CIM, HIR.SZOVEGTORZS, HIR.KULDESIDOPONT
        FROM HIR LEFT JOIN OKTATO
        ON OKTATO.OKTATOID = HIR.KOZZETEVOID
        ORDER BY HIR.KULDESIDOPONT DESC
    `);
    return rows;
    tempConn.close();
}

async function ujHir(userID, cim, szovegtorzs, date, userType) {
    let tempConn = await conn();
    let adminE = (userType == 'admin' ? 1 : 0);
    try {
        await tempConn.execute(`
            INSERT INTO Hir(KozzetevoID, cim, szovegtorzs, kuldesIdopont, adminE)
            VALUES(:userID, :cim, :szovegtorzs, TO_DATE(:datetime,'YYYY-MM-DD"T"HH24:MI:SS."000Z"'), :adminE)
        `, [userID, cim, szovegtorzs, date, adminE]);
    } catch (error) {
        console.error(error);
    }
    await tempConn.close();
    return;
}

// KURZUSOK
async function ujKurzus(id, nev) {
    let tempConn = await conn();
    try {
        
        await tempConn.execute(`INSERT INTO KURZUS (OKTATOID, KURZUSNEV) VALUES(:id, :nev)`, [id, nev]);
    } catch (e) {
        console.error(e);
    }
    finally {
        await tempConn.close();
    }
    return;
}

async function osszesKurzusom(id) {
    let tempConn = await conn();
    let user = await tempConn.execute(`SELECT * FROM KURZUS WHERE OKTATOID = :id`, [id]);
    await tempConn.close();
    return user.rows;
}

async function deleteKurzus(userID, kurzusID) {
    let tempConn = conn();
    let result = await (await tempConn).execute(`SELECT (OKTATOID) FROM KURZUS WHERE KURZUSID = :kurzusID`, [kurzusID]);
    console.log(result);
    if (result.rows[0][0] != userID) {
        throw "Unauthorized";
    }
    try {
        await (await tempConn).execute(`DELETE FROM KURZUS WHERE KURZUSID = :kurzusid`, [kurzusID]);
    } catch (error) {
        console.log(error)
    }
    await tempConn.close();
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
    await tempConn.close();
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
    await tempConn.close();
}

async function felvehetoKurzusok(hallgatoID) {
    let tempConn = await conn();
    let kurzusok = await tempConn.execute(`
        SELECT KURZUS.KURZUSID, KURZUS.KURZUSNEV 
        FROM KURZUS
        WHERE KURZUSID NOT IN 
        (SELECT KURZUSFELVETEL.KURZUSID FROM KURZUSFELVETEL WHERE KURZUSFELVETEL.HALLGATOID = :hallgatoid)
    `, [hallgatoID]);
    await tempConn.close();
    return kurzusok.rows;
}

async function felvettKurzusaim(hallgatoID) {
    let tempConn = await conn();
    let kurzusok = await tempConn.execute(`
        SELECT KURZUS.KURZUSID, KURZUS.KURZUSNEV 
        FROM KURZUS
        WHERE KURZUSID IN
        (SELECT KURZUSFELVETEL.KURZUSID FROM KURZUSFELVETEL WHERE KURZUSFELVETEL.HALLGATOID = :hallgatoid)
    `, [hallgatoID]);
    await tempConn.close();
    return kurzusok.rows;
}

async function kurzusJelentkezes(hallgatoID, kurzusID) {
    let tempConn = await conn();
    try {
        await tempConn.execute(`INSERT INTO KURZUSFELVETEL (HALLGATOID, KURZUSID) VALUES (:hallgatoID, :kurzusID)`, [hallgatoID, kurzusID]);
    } catch (error) {
        console.error(error)
    }
    await tempConn.close();
    return;
}

async function kurzusLeadas(hallgatoID, kurzusID) {
    let tempConn = await conn();
    try {
        await tempConn.execute(`DELETE FROM KURZUSFELVETEL WHERE HALLGATOID = :hallgatoID AND KURZUSID = :kurzusID`, [hallgatoID, kurzusID]);
    } catch (e) {
        console.error(e);
    }
}

// VIZSGAIM
async function felvehetoVizsgak(hallgatoID) {
    let tempConn = await conn();
    let vizsgak = await tempConn.execute(`
        SELECT * FROM VIZSGAALKALOM
        WHERE VIZSGAALKALOMID NOT IN
        
        (SELECT VIZSGAALKALOMID FROM VIZSGAFELVETEL  --EZ MINDAZON VIZSGAK AMIKET MAR FELVETTUNK
        WHERE HALLGATOID = :hallgatoID)
        
        AND VIZSGAALKALOMID IN
        (SELECT VIZSGAALKALOMID FROM VIZSGAALKALOM   --AZOK A VIZSGAALKALMAK, AMIK AZ ALTALUNK FELVETT KURZUSOKHOZ TARTOZNAK
        WHERE VIZSGAALKALOM.KURZUSID IN
        (SELECT KURZUSID FROM KURZUSFELVETEL WHERE KURZUSFELVETEL.HALLGATOID = :hallgatoID)) --AZOK A KURZUSID-K, AMIK FEL VANNAK VEVE
    `, [hallgatoID]);
    await tempConn.close();
    return vizsgak.rows;
}

async function felvettVizsgaim(hallgatoID) {
    let tempConn = await conn();
    let vizsgak = await tempConn.execute(`
        SELECT VIZSGAALKALOM.VIZSGAALKALOMID, KURZUS.KURZUSNEV, VIZSGAALKALOM.KEZDESIDOPONT, VIZSGAALKALOM.VEGZESIDOPONT, VIZSGAALKALOM.FEROHELYEKSZAMA 
        FROM VIZSGAFELVETEL
        LEFT JOIN VIZSGAALKALOM
        ON VIZSGAALKALOM.VIZSGAALKALOMID = VIZSGAFELVETEL.VIZSGAALKALOMID
        LEFT JOIN KURZUS
        ON KURZUS.KURZUSID = VIZSGAALKALOM.KURZUSID
        WHERE VIZSGAFELVETEL.HALLGATOID = :hallgatoID
    `, [hallgatoID]);
    await tempConn.close();
    return vizsgak.rows;
}

async function vizsgaJelentkezes(hallgatoID, vizsgaID) { // TRIGGER: HA VAN MAR FELVETT VIZSGAJA, NE ENGEDJE
    let tempConn = await conn();
    await tempConn.execute(`INSERT INTO VIZSGAFELVETEL (HALLGATOID, VIZSGAALKALOMID) VALUES (:hallgatoID, :vizsgaID)`, [hallgatoID, vizsgaID]);
    await tempConn.close();
    return;
}
async function vizsgaLeadas(hallgatoID, vizsgaID) { // TRIGGER: HA 24 ORAN BELUL VAN VIZSGAJA, NE ENGEDJE
    let tempConn = await conn();
    try {
        await tempConn.execute(`DELETE FROM VIZSGAFELVETEL WHERE HALLGATOID = :hallgatoID AND VIZSGAALKALOMID = :vizsgaID `, [hallgatoID, vizsgaID]);
    } catch (e) {
        console.error(e);
    }
}


exports.register = register;
exports.login = login;
exports.getHirek = getHirek;
exports.ujHir = ujHir;

exports.ujKurzus = ujKurzus;
exports.osszesKurzusom = osszesKurzusom;
exports.deleteKurzus = deleteKurzus;

exports.ujVizsga = ujVizsga;
exports.osszesVizsgam = osszesVizsgam;

exports.felvehetoKurzusok = felvehetoKurzusok;
exports.felvettKurzusaim = felvettKurzusaim;
exports.kurzusJelentkezes = kurzusJelentkezes;
exports.kurzusLeadas = kurzusLeadas;

exports.felvehetoVizsgak = felvehetoVizsgak;
exports.felvettVizsgaim = felvettVizsgaim;
exports.vizsgaJelentkezes = vizsgaJelentkezes;
exports.vizsgaLeadas = vizsgaLeadas;