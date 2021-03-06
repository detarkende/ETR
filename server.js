const express = require('express');
const db = require('./db_functions');
const app = express();
const session = require('express-session');
const e = require('express');



app.set('view-engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(session({
    name: 'sid',
    secret: 'Adatbazis Alapu Rendszerek 2021',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 3600000, // 1 hour
        sameSite: true
    }
}));


// MIDDLEWARES
const redirectToLogin = (req, res, next) => {
    if (!req.session.userID) {
        res.redirect('/');
    }
    next();
}
const redirectToDashboard = (req, res, next) => {
    if (req.session.userID) {
        res.redirect('/dashboard');
    }
    next();
}


// INDEX.EJS
app.get('/', (req, res) => {
    res.render('index.ejs')
})

// LOGIN
app.get('/login', redirectToDashboard, (req, res) => {
    res.render('login.ejs', { type: req.query.type, error: undefined });
})
app.post('/login', async (req, res) => {
    let { id, password, type } = req.body;
    let user;
    try {
        user = await db.login(id, password, type);
        req.session.userID = user[0];
        req.session.usersName = user[1];
        req.session.userType = user[2];
        res.redirect('/dashboard');
    }
    catch (err) {
        res.render('login.ejs', { type: req.body.type, error: err });
    }
})

// REGISTER
app.get('/register', redirectToDashboard, (req, res) => {
    res.render('register.ejs', {type: req.query.type});
})
app.post('/register', async (req, res) => {
    let result = await db.register(req.body.name, req.body.password, req.body.type);
    res.redirect('/new-account?id=' + result);
    if (result !== false) {
    }
})

// NEW-ACCOUNT
app.get('/new-account', (req, res) => {
    res.render('new-account.ejs', { id: req.query.id })
});

// DASHBOARD
app.get('/dashboard', redirectToLogin, (req, res) => {
    res.render('dashboard.ejs', {usertype: req.session.userType});
})

// LOGOUT
app.get('/logout', redirectToLogin, (req, res) => {
    req.session.destroy();
    res.redirect('/');
})



//           ░█████╗░██████╗░██╗
//           ██╔══██╗██╔══██╗██║
//           ███████║██████╔╝██║
//           ██╔══██║██╔═══╝░██║
//           ██║░░██║██║░░░░░██║
//           ╚═╝░░╚═╝╚═╝░░░░░╚═╝

// OKTATO - KURZUSOK
app.post('/api/ujKurzus', async (req, res) => {
    if (req.session.userType == 'oktato') {
        try {
            db.ujKurzus(req.session.userID, req.body.kurzusNev);
            res.redirect('/dashboard');
            return;
        }
        catch (e) {
            console.error(e);
            res.status(500);
            return;
        }
    }
})
app.get('/api/osszesKurzusom', async (req, res) => {
    if (req.session.userType == 'oktato') {
        let rows = await db.osszesKurzusom(req.session.userID);
        res.json({ rows: rows });
    }
    else {
        res.status(400);
    }
});
app.post('/api/deleteKurzus', async (req, res) => {
    if (req.session.userType == 'oktato') {
        try {
            await db.deleteKurzus(req.session.userID, req.body.kurzusid);
            res.redirect('/dashboard');
        }
        catch {
            res.status(400);
        }
    }
    else {
        res.status(400);
    }
})

// OKTATO - HIREK
app.post('/api/ujHir', async (req, res) => {
    if (req.session.userType == 'oktato' || req.session.userType == 'admin') {
        try {
            await db.ujHir(req.session.userID, req.body.cim, req.body.szovegtorzs, new Date().toISOString(), req.session.userType);
            res.redirect('/dashboard');
        }
        catch {
            res.redirect('/dashboard');
        }
    }
});

// OKTATO - VIZSGAK
app.post('/api/ujVizsga', async (req, res) => {
    if (req.session.userType == 'oktato') {
        await db.ujVizsga(req.session.userID, req.body.kurzusID, req.body.kezdesiIdo, req.body.vizsgaHossza, req.body.ferohelyekSzama);
        res.redirect('/dashboard');
    }
    else {
        res.status(400);
    }
})
app.get('/api/osszesVizsgam', async (req, res) => {
    if (req.session.userType == 'oktato') {
        let rows = await db.osszesVizsgam(req.session.userID);
        res.json({ rows: rows });
    }
    else {
        res.status(400);
    }
});

// HALLGATO - KURZUSOK
app.get('/api/felvehetoKurzusok', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        let rows = await db.felvehetoKurzusok(req.session.userID);
        res.json({ rows: rows });
    }
    else {
        res.status(400);
    }
});
app.get('/api/felvettKurzusaim', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        let rows = await db.felvettKurzusaim(req.session.userID);
        res.json({ rows: rows });
    }
    else {
        res.status(400);
    }
});
app.post('/api/kurzusJelentkezes', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        await db.kurzusJelentkezes(req.session.userID, req.body.kurzusID);
        res.redirect('/dashboard');
    }
    else {
        res.status(400);
    }
});
app.post('/api/kurzusLeadas', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        await db.kurzusLeadas(req.session.userID, req.body.kurzusID);
        res.redirect('/dashboard');
    }
    else {
        res.status(400);
    }
})

// HALLGATO - HIREK
app.get('/api/hirek', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        let hirek = await db.getHirek();
        res.json(hirek);
    }
    else {
        res.status(400);
    }
});

// HALLGATO - VIZSGAK
app.get('/api/felvehetoVizsgak', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        let rows = await db.felvehetoVizsgak(req.session.userID);
        res.json({ rows: rows });
    }
    else {
        res.status(400);
    }
});
app.get('/api/felvettVizsgaim', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        let rows = await db.felvettVizsgaim(req.session.userID);
        res.json({ rows: rows });
    }
    else {
        res.status(400);
    }
});
app.post('/api/vizsgaJelentkezes', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        try {
            await db.vizsgaJelentkezes(req.session.userID, req.body.vizsgaID);
            res.redirect('/dashboard');
        } catch (error) {
            console.error(error);
        }
    }
    else {
        res.status(400);
    }
});
app.post('/api/vizsgaLeadas', async (req, res) => {
    if (req.session.userType == 'hallgato') {
        await db.vizsgaLeadas(req.session.userID, req.body.vizsgaID);
        res.redirect('/dashboard');
    }
    else {
        res.status(400);
    }
})


app.listen(3000);