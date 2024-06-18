// IMPORT LIBRARIES AND INITIALIZE GLOBAL VARIABLES & CONSTANTS
const bodyParser = require('body-parser')
    //const fs = require('fs')
const express = require('express')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const schedule = require('node-schedule')
const { google } = require('googleapis')
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')
dotenv.config({})

const dbCom = require('./utils/dbCom')
const download = require('./utils/download')
const googleCom = require('./utils/googleCom')
const logger = require('./utils/logger')
const mail = require('./utils/mail')
const newScraper = require('./utils/newScraper')

const PORT = process.env.PORT || 9001

// MAIN FUNCTION CALL

;
(async() => {
    try {
        const text = await main();
    } catch (e) {
        logger.log(e)
    }
})()

// FUNCTION DECLARATION
async function main() {
    // @ts-ignore
    process.stdout.write('\033c')
    const app = express()
        //const httpsServer = https.createServer(credentials, app)
    app.set('view engine', 'ejs')
    app.set('views', 'views')
    app.use(express.static('public'))
    app.use(express.static(__dirname + '/public'))
    app.use(bodyParser.urlencoded({
        extended: false
    }))
    app.use(bodyParser.json())
    app.use(cookieParser())
    app.set('trust proxy', true)
    app.use(session({
        secret: 'secret-key',
        resave: false,
        saveUninitialized: false,
        //cookie: {
        //secure: true
        //}
    }))

    // GET REQUESTS

    app.get('/login', (req, res) => {
        logger.log(`GET /login`, req.ip)
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1 && req.session.user.UserID !== undefined) {
            dbCom.getActiveUserInfo(req.session.user.UserID).then(el => {
                if (el.status == 200) {
                    res.redirect('/')
                } else {
                    req.session.loggedIn = 0
                    res.cookie('footy-loggedin', 0, {
                        httpOnly: true,
                        maxAge: 365 * 24 * 60 * 60 * 1000
                    })
                    req.session.destroy()
                    res.render('login')
                }
            })
        } else {
            req.session.loggedIn = 0
            res.cookie('footy-loggedin', 0, {
                httpOnly: true,
                maxAge: 365 * 24 * 60 * 60 * 1000
            })
            req.session.destroy()
            res.render('login')
        }
    })

    app.get('/home', (req, res) => {
        logger.log(`GET /home`, req.ip)
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1 && req.session.user.UserID !== undefined) {
            dbCom.getActiveUserInfo(req.session.user.UserID).then(el => {
                if (el.status == 200) { // LOGGED IN
                    const ejsdata = {
                        render_btns: "false"
                    }
                    res.status(200).render('home', { ejsdata })
                } else { // LOGGED OUT
                    const ejsdata = {
                        render_btns: "true"
                    }
                    res.status(200).render('home', { ejsdata })
                }
            })
        } else { // FIRST TIMER
            const ejsdata = {
                render_btns: "true"
            }
            res.status(200).render('home', { ejsdata })
        }
    })

    app.get('/forgot_password', async(req, res) => {
        logger.log(`GET /forgot_password`, req.ip)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1 && req.session.user.UserID !== undefined) {
            res.redirect('/')
        } else {
            res.render('forgot_password')
        }

    })

    app.get('/', (req, res) => {
        logger.log(`GET /`, req.ip)
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1 && req.session.user.UserID !== undefined) {
            dbCom.getActiveUserInfo(req.session.user.UserID).then(el => {
                if (el.status == 200) { // LOGGED IN
                    const ejsdata = {
                        dashname: req.session.user.UserName
                    }
                    res.render('dashboard', { ejsdata })
                } else { // LOGGED OUT
                    req.session.loggedIn = 0
                    res.cookie('footy-loggedin', 0, {
                        httpOnly: true,
                        maxAge: 365 * 24 * 60 * 60 * 1000
                    })
                    req.session.destroy()
                    res.redirect('/home')
                }
            })
        } else { // FIRST TIMER
            req.session.loggedIn = 0
            res.cookie('footy-loggedin', 0, {
                httpOnly: true,
                maxAge: 365 * 24 * 60 * 60 * 1000
            })
            req.session.destroy()
            res.redirect('/home')
        }
    })

    app.get('/get-userinfo', (req, res) => {
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1) {
            dbCom.getActiveUserInfo(req.session.user.UserID).then(el => {
                res.status(200).send(el.data)
            })
        } else {
            res.status(491).send('No user is logged in')
        }
    })

    app.get('/get-premium', (req, res) => {
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1) {
            dbCom.getPremiumStatus(req.session.user.UserID).then(el1 => {
                res.status(el1.status).send(el1.data)
            })

        } else {
            res.status(494).send('No user is logged in')
        }
    })

    app.get('/reset-password/:token', async(req, res) => {
        logger.log(`GET /forgot_password`, req.ip)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1 && req.session.user.UserID !== undefined) {
            res.redirect('/')
        } else {
            const ejsdata = {
                token: req.params.token
            }
            res.status(200).render('reset_password', { ejsdata })
        }

    })

    app.get('/get-userinfo-calendars', (req, res) => {
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1) {
            dbCom.getCalendarUserInfo(req.session.user.UserID).then(el1 => {
                if (el1.status == 200) {
                    res.status(el1.status).send(el1.data)
                } else {
                    res.status(el1.status).send(el1.msg)
                }
            })

        } else {
            res.status(491).send('No user is logged in')
        }
    })

    app.post('/has-live-calendar', (req, res) => {
        googleCom.hasLiveGoogleCalendar(req.session.user, req.body.descString).then(el1 => {
            if (el1.hasCalendar) {
                res.status(200).send(true)
            } else {
                res.status(200).send(false)
            }
        })
    })

    app.post('/push-events', (req, res) => {

        dbCom.getActiveUserInfo(req.session.user.UserID).then(el1 => {
            var userdata = el1.data
            newScraper.newDbLoad(req.body.team, req.body.sportID).then(el2 => {
                var flashdbres = el2
                googleCom.insertGoogleEvents(userdata, req.body.team, req.body.sportID, req.body.selected_color, flashdbres).then(el3 => {
                    var insertResult = el3
                    res.status(insertResult.status).send(insertResult.msg)
                })
            })
        })
    })

    app.post('/remove-events', (req, res) => {
        googleCom.removeGoogleCalendar(req.session.user, req.body.descString).then(el1 => {
            res.status(el1.status).send(el1.msg)
        })

    })

    app.post('/forgot-pw', (req, res) => {
        dbCom.emailLookup(req.body.email).then(el1 => {
            if (el1.isValid) {
                dbCom.forgotPw(req.body.email).then(el2 => {
                    res.status(el2.status).send(el2.msg)
                })
            } else {
                res.status(200).send('If this address is valid, an email containing the link has been sent to it.')
            }
        })
    })

    app.get('/register', (req, res) => {
        logger.log(`GET /register`, req.ip)
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1) {
            res.redirect('/')
        } else {
            res.render('register')
        }
    })

    app.post('/activate-code', (req, res) => {
        handleCookies(req)
        if (req.session.loggedIn === undefined || req.session.loggedIn == 0) {
            res.redirect('/')
        } else {
            dbCom.activateCode(req.session.user.UserID, req.body.code).then(query => {
                res.status(query.status).send(query.msg)
            })

        }
    })

    app.get('/patch_notes', (req, res) => {
        logger.log(`GET /patch_notes`, req.ip)
        res.render('patch_notes')
    })

    app.get('/privacy_policy', (req, res) => {
        logger.log(`GET /privacy_policy`, req.ip)
        res.render('privacy_policy')
    })

    app.get('/terms', (req, res) => {
        logger.log(`GET /terms`, req.ip)
        res.render('terms')
    })

    app.get('/donate', (req, res) => {
        res.render('donate')
    })

    app.get('/premium', (req, res) => {
        if (!req.session.loggedIn) {
            res.redirect('/login')
        } else {
            res.render('premium')
        }
    })

    app.get('/premium_status', (req, res) => {
        if (!req.session.loggedIn) {
            res.redirect('/login')
        } else {
            res.render('premium_status')
        }
    })

    app.get('/feedback', (req, res) => {
        logger.log(`GET /feedback`, req.ip)
        handleCookies(req)
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1 && req.session.user.UserID !== undefined) {
            dbCom.getActiveUserInfo(req.session.user.UserID).then(el => {
                if (el.status == 200) { // LOGGED IN
                    const ejsdata = {
                        formname: req.session.user.email
                    }
                    res.render('feedback', { ejsdata })
                } else { // LOGGED OUT
                    req.session.loggedIn = 0
                    res.cookie('footy-loggedin', 0, {
                        httpOnly: true,
                        maxAge: 365 * 24 * 60 * 60 * 1000
                    })
                    req.session.destroy()
                    const ejsdata = {
                        formname: "Anonymus"
                    }
                    res.render('feedback', { ejsdata })
                }
            })
        } else { // FIRST TIMER
            req.session.loggedIn = 0
            res.cookie('footy-loggedin', 0, {
                httpOnly: true,
                maxAge: 365 * 24 * 60 * 60 * 1000
            })
            req.session.destroy()
            const ejsdata = {
                formname: "Anonymus"
            }
            res.render('feedback', { ejsdata })
        }
    })

    app.post('/feedback-reg', (req, res) => {
        mail.sendFeedback(req.body.title, req.body.content, req.body.username).then(fbResult => {
            res.status(fbResult.status).send(fbResult.msg)
        })

    })

    app.get('/new_password', (req, res) => {
        logger.log(`GET /new_password`, req.ip)
        if (!req.session.loggedIn) {
            res.redirect('/login')
        } else {
            res.render('new_password')
        }
    })

    app.get('/calendars', (req, res) => {
        logger.log(`GET /calendars`, req.ip)
        if (!req.session.loggedIn) {
            res.redirect('/login')
        } else {
            res.render('calendars')
        }
    })

    app.get('/new_email', (req, res) => {
        logger.log(`GET /new_email`, req.ip)
        if (!req.session.loggedIn) {
            res.redirect('/login')
        } else {
            res.render('new_email')
        }
    })

    app.get('/delete_account', (req, res) => {
        logger.log(`GET /delete_account`, req.ip)
        if (!req.session.loggedIn) {
            res.redirect('/login')
        } else {
            res.render('delete')
        }
    })

    app.post('/set-newpw', (req, res) => {
        dbCom.pwEncrypt(req.body.pw).then(el1 => {
            dbCom.setNewPw(req.session.user, req.body.old_pw, el1).then(newpwResult => {
                dbCom.getActiveUserInfo(req.session.user.UserID).then(el2 => {
                    req.session.user = el2.data
                    res.cookie('footy-user', req.session.user, {
                        httpOnly: true,
                        maxAge: 365 * 24 * 60 * 60 * 1000
                    })
                    res.status(newpwResult.status).send(newpwResult.msg)
                })
            })
        })
    })

    app.post('/setreset-pw', (req, res) => {
        dbCom.resetPw(req.body.token, req.body.pw).then(resetpwResult => {
            res.status(resetpwResult.status).send(resetpwResult.msg)
        })

    })

    app.post('/cancel_premium', (req, res) => {
        dbCom.cancelPremium(req.body.premiumID, req.body.end_time).then(cancelResult => {
            res.status(cancelResult.status).send(cancelResult.msg)
        })

    })

    app.post('/set-newemail', (req, res) => {
        dbCom.setNewEmail(req.session.user, req.body.email).then(newemailResult => {
            dbCom.getActiveUserInfo(req.session.user.UserID).then(el1 => {
                req.session.user = el1.data
                res.cookie('footy-user', req.session.user, {
                    httpOnly: true,
                    maxAge: 365 * 24 * 60 * 60 * 1000
                })
                res.status(newemailResult.status).send(newemailResult.msg)
            })
        })

    })

    app.post('/delete-account', (req, res) => {

        dbCom.deleteAccount(req.session.user, req.body.pw).then(deleteResult => {
            if (deleteResult.status == 200) {
                req.session.loggedIn = 0
                res.cookie('footy-loggedin', 0, {
                    httpOnly: true,
                    maxAge: 365 * 24 * 60 * 60 * 1000
                })
                req.session.destroy()
            }
            res.status(deleteResult.status).send(deleteResult.msg)
        })

    })

    app.post('/delete-calendar', (req, res) => {
        dbCom.deleteCalendar(req.body.calendarID, req.session.user, req.body.descString).then(deleteResult => {
            res.status(deleteResult.status).send(deleteResult.msg)
        })

    })

    app.post('/register_user', (req, res) => {
        dbCom.pwEncrypt(req.body.pw).then(el1 => {
            dbCom.createNewUser("undefined", req.body.team, req.body.sportID, req.body.username, el1, req.body.email).then(createResult => {
                res.status(createResult.status).send(createResult.msg)
            })
        })


    })

    app.post('/edit_user', (req, res) => {
        dbCom.editUser(req.session.user.UserID, req.body.username, req.body.region).then(editResult => {
            dbCom.getActiveUserInfo(req.session.user.UserID).then(el1 => {
                req.session.user = el1.data
                res.cookie('footy-user', req.session.user, {
                    httpOnly: true,
                    maxAge: 365 * 24 * 60 * 60 * 1000
                })
                res.status(editResult.status).send(editResult.msg)
            })
        })
    })

    app.post('/edit_calendar', (req, res) => {
        googleCom.removeGoogleCalendar(req.session.user, req.body.descString).then(el1 => {
            dbCom.editCalendar(req.body.calendarID, req.body.team, req.body.selected_color, req.body.sportID).then(editCalendarResult => {
                res.status(editCalendarResult.status).send(editCalendarResult.msg)
            })
        })
    })

    app.post('/insert_calendar', (req, res) => {
        dbCom.insertCalendar(req.body.team, req.body.selected_color, req.body.sportID, req.session.user.UserID).then(insertCalendarResult => {
            res.status(insertCalendarResult.status).send(insertCalendarResult.msg)
        })

    })

    app.get('/unlink-google', (req, res) => {
        dbCom.unlinkGoogle(req.session.user).then(unlinkResult => {
            res.status(unlinkResult.status).send(unlinkResult.msg)
        })
    })

    app.post('/force-refresh-events', (req, res) => {
        googleCom.removeGoogleCalendar(req.session.user, req.body.descString).then(el0 => {
            if (el0.status == 200) {
                dbCom.getActiveUserInfo(req.session.user.UserID).then(el1 => {
                    var userdata = el1.data
                    newScraper.newDbLoad(req.body.team, req.body.sportID).then(el2 => {
                        var flashdbres = el2
                        googleCom.insertGoogleEvents(userdata, req.body.team, req.body.sportID, req.body.selected_color, flashdbres).then(el3 => {
                            var insertResult = el3
                            res.status(insertResult.status).send(insertResult.msg)
                        })
                    })
                })
            } else {
                res.status(494).send('Google calendar removal error.')
            }
        })
    })

    app.post('/login_user', (req, res) => {
        dbCom.loginCheck(req.body.username, req.body.pw).then(dbresult => {
            if (dbresult.status == 200) { //successful login
                dbCom.findUserID(req.body.username).then(el1 => {
                    var UserID = el1
                    dbCom.getActiveUserInfo(UserID).then(el2 => {
                        const newUser = el2.data
                        res.cookie('footy-loggedin', 1, {
                            httpOnly: true,
                            maxAge: 365 * 24 * 60 * 60 * 1000
                        })
                        res.cookie('footy-user', newUser, {
                            httpOnly: true,
                            maxAge: 365 * 24 * 60 * 60 * 1000
                        })
                        req.session.loggedIn = 1
                        req.session.user = newUser
                        res.status(dbresult.status).send(dbresult.msg)
                    })
                })
            } else {
                res.cookie('footy-loggedin', false, {
                    httpOnly: true,
                    maxAge: 365 * 24 * 60 * 60 * 1000
                })
                res.status(dbresult.status).send(dbresult.msg)
            }
        })
    })

    app.get('/ads.txt', (req, res) => {
        const filePath = path.join(__dirname, 'ads.txt');

        // Check if ads.txt file exists
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                // File does not exist
                return res.status(404).send('Ads.txt file not found');
            }

            // File exists, read and send it as response
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    return res.status(500).send('Error reading ads.txt file');
                }

                res.set('Content-Type', 'text/plain');
                res.send(data);
            });
        });
    });

    app.get('/logout_user', (req, res) => {
        req.session.loggedIn = 0
        res.cookie('footy-loggedin', 0, {
            httpOnly: true,
            maxAge: 365 * 24 * 60 * 60 * 1000
        })
        req.session.destroy()
        res.status(200).send('logged out')
    })

    app.post('/link-google', (req, res) => {
        const googleurl = googleCom.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: googleCom.scopes
        })
        req.session.redirectGenerated = true
        res.status(200).send(googleurl)
    })

    app.post('/download-calendar', (req, res) => {
        newScraper.newDbLoad(req.body.team, req.body.sportID).then(flashdbres => {
            download.createDownloadableCalendar(flashdbres.db, req.session.user, req.body.team).then(downFilePath => {
                console.log('downFilePath start')
                console.log(downFilePath)
                console.log('downFilePath end')
                if (flashdbres.status != 200) {
                    res.status(flashdbres.status).send(flashdbres.msg)
                } else {

                    download.fs.readFile(downFilePath, (err, data) => {
                        if (err) {
                            console.error(err)
                            res.status(500).send('Internal Server Error')
                        } else {
                            res.setHeader('Content-Disposition', 'attachment; filename=footy_calendar.ics') // Set the desired file name
                            res.setHeader('Content-Type', 'text/calendar') // Set the appropriate content type
                            res.status(200).send(data)
                        }
                    })
                    download.fs.unlink(downFilePath, (err) => {
                        if (err) {
                            logger.log(`Error deleting file ${downFilePath}: ${err}`)
                        } else {
                            logger.log(`File ${downFilePath} deleted successfully`)
                        }
                    })
                }
            })
        })
    })

    app.get('/google/redirect', async(req, res) => {
        if (req.session.loggedIn !== undefined && req.session.loggedIn == 1 && req.session.redirectGenerated) {
            const code = req.query.code
            const response = await googleCom.oauth2Client.getToken(code)
            const {
                tokens
            } = response
            //console.log(tokens)
            googleCom.oauth2Client.setCredentials({
                access_token: tokens.access_token
            })
            let oauth2 = google.oauth2({
                auth: googleCom.oauth2Client,
                version: 'v2'
            })
            let {
                data
            } = await oauth2.userinfo.get()
                //console.log(data.id) // UNIQUE GOOGLE ID  
            dbCom.updateToken(req.session.user, tokens.refresh_token, data.id).then(updateRes => {
                console.log('data.id: ' + data.id)
                console.log('updateRes: ')
                console.log(updateRes)
                if (updateRes.status == 200) {
                    dbCom.getActiveUserInfo(req.session.user.UserID).then(el1 => {
                        console.log('el1.data: ')
                        console.log(el1.data)
                        req.session.user = el1.data
                        res.cookie('footy-user', req.session.user, {
                            httpOnly: true,
                            maxAge: 365 * 24 * 60 * 60 * 1000
                        })
                        res.redirect('/')
                    })
                } else {
                    const ejsdata = {
                            message: updateRes.msg
                        } // The data you want to send to the EJS template
                    res.status(updateRes.status).render('error', {
                        ejsdata
                    })
                }
            })
        } else {
            res.redirect('/register')
        }
    })

    app.post('/api-search', (req, res) => {
        newScraper.apiSearch(req.body.searchString, req.body.sport).then(searchRes => {
            res.status(searchRes.status).send(searchRes.msg)
        })


    })

    app.get('*', async(req, res) => {
        res.redirect('/')
    })

    app.listen(PORT, () => logger.log(`Server running on PORT ${PORT}`))

    /*
    httpsServer.listen(9001, () => {
        logger.log('Server is running...')
      })
    */

}

function handleCookies(req) {
    req.session.loggedIn = req.cookies['footy-loggedin']
    req.session.user = req.cookies['footy-user']
        //logger.log('----- LOGGING ------> ' + req.session.loggedIn)
}

function refreshAllPremium() {
    return new Promise((resolve, reject) => {
        db.query(`
            SELECT * FROM users JOIN premium ON users.UserID = premium.owner JOIN calendars ON calendars.owner = users.UserID
            WHERE refresh_token <> 'undefined';
            `, (err, dbres) => {
            var message = ''
            if (!err) {
                if (dbres.length > 0) {
                    for (var i = 0; i < dbres.length; i++) {
                        dbCom.getActiveUserInfo(dbres[i].UserID).then(el1 => {
                            const activeUser = el1.data
                            const descString = 'team_' + dbres[i].team + '_sport_' + dbres[i].sportID + '_footycalendar'
                            googleCom.removeGoogleCalendar(activeUser, descString).then(el2 => {
                                if (el2.status == 200) {
                                    googleCom.insertGoogleEvents(activeUser, dbres[i].team, dbres[i].sportID, dbres[i].selected_color).then(el3 => {
                                        message = 'Successfully refreshed all premium calendars!'
                                        return resolve({
                                            status: 200,
                                            msg: message
                                        })
                                    })
                                } else {
                                    message = 'There was an error.'
                                    return resolve({
                                        status: 491,
                                        msg: message
                                    })
                                }
                            })
                        })
                    }
                }
            } else {
                message = `${err.code}`
                logger.log(message)
                return resolve({
                    status: 492,
                    msg: message
                })
            }
        })
    })
}

function scheduledTask() {
    console.log('Starting scheduled task at ', new Date())
    refreshAllPremium().then(query => {
        if (query.status == 200) {
            console.log('Scheduled task performed at ', new Date())
        }
    })
}