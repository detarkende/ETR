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
        return [ user.rows[0][0], user.rows[0][2] ];
    }
    else {
        throw 'Helytelen jelszo.';
        return;
    }
}



exports.register = register;
exports.login = login;