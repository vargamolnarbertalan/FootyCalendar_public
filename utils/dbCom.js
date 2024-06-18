const mysql = require('mysql2')
const bcrypt = require('bcrypt')

const logger = require('./logger')
const mail = require('./mail')
const googleCom = require('./googleCom')

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 9,
    multipleStatements: true,
    dateStrings: true,
    authPlugins: {
        mysql_clear_password: () => () => Buffer.from(process.env.DB_PASSWORD + '\0')
    }
})

function getActiveUserInfo(UserID) {
    return new Promise((resolve, reject) => {
        var user = {
            UserID: '',
            refresh_token: '',
            UserName: '',
            email: '',
            pw: '',
            region: '',
            calendars: []
        }
        db.query(`
            SELECT * FROM users WHERE UserID = ?;
            `, [UserID], (err, dbres) => {
            var message = ''
            if (dbres && dbres.length > 0) {
                user.UserID = UserID
                user.refresh_token = dbres[0].refresh_token
                user.UserName = dbres[0].UserName
                user.email = dbres[0].email
                user.pw = dbres[0].pw
                user.region = dbres[0].region
                message = `Got info of '${user.UserName}' successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    data: user,
                    msg: message
                })
            } else if (dbres.length == 0) {
                message = `User does not exist`
                logger.log(message)
                return resolve({
                    status: 491,
                    msg: message
                })
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

function getCalendarUserInfo(UserID) {
    //console.log(UserID)
    var user = {
        UserID: '',
        UserName: '',
        refresh_token: '',
        calendars: []
    }
    return new Promise((resolve, reject) => {
        db.query(`
        SELECT * FROM users
        JOIN calendars ON owner = UserID
        JOIN colors ON color_id = selected_color
        WHERE UserID = ?;
        `, [UserID], (err, dbres) => {
            var message = ''
            if (dbres) {
                if (dbres.length > 0) {
                    user.UserID = UserID
                    user.UserName = dbres[0].UserName
                    user.refresh_token = dbres[0].refresh_token
                    for (var i = 0; i < dbres.length; i++) {
                        user.calendars.push({
                            calendarID: dbres[i].calendarID,
                            team: dbres[i].team,
                            selected_color: dbres[i].selected_color,
                            sportID: dbres[i].sportID
                        })
                    }
                    message = `Got calendar info of '${user.UserName}' successfully!`
                    logger.log(message)
                    return resolve({
                        status: 200,
                        data: user,
                        msg: message
                    })
                } else {
                    message = `User does not exist`
                    logger.log(message)
                    return resolve({
                        status: 491,
                        msg: message
                    })
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

function emailLookup(email) {
    return new Promise((resolve, reject) => {
        db.query(`
        SELECT * FROM users
        WHERE email = ?;
        `, [email], (err, dbres) => {
            if (dbres && dbres.length > 0) {
                return resolve({
                    isValid: true,
                    msg: 'This email exists.',
                    status: 200
                })
            } else if (dbres.length == 0) {
                return resolve({
                    isValid: false,
                    msg: 'This email does not exists.',
                    status: 491
                })
            } else {
                const message = `${err.code}`
                logger.log(message)
                return resolve({
                    isValid: false,
                    msg: 'DB related error',
                    status: 492
                })
            }
        })
    })
}

async function forgotPw(email) {
    return new Promise((resolve, reject) => {
        require('crypto').randomBytes(48, async function(err, buffer) {
            const token = buffer.toString('hex')
            const dBtoken = await pwEncrypt(token)
                //console.log(token)
            db.query(`
            INSERT INTO forgot_tokens (token, user_email)
            VALUES (?,?);
            `, [dBtoken, email], async(err, dbres) => {
                if (err) {
                    const message = `${err.code}`
                    logger.log(message)
                    return resolve({
                        msg: 'DB related error',
                        status: 491
                    })
                } else {
                    const emailQuery = await mail.sendEmail(email, token)
                    if (emailQuery.status == 200) {
                        return resolve({
                            msg: emailQuery.msg,
                            status: emailQuery.status
                        })
                    } else {
                        return resolve({
                            msg: emailQuery.msg,
                            status: emailQuery.status
                        })
                    }
                }
            })
        })
    })
}

function findUserID(username) {

    return new Promise((resolve, reject) => {
        db.query(`
        SELECT * FROM users WHERE UserName = ?;
        `, [username], (err, dbres) => {
            if (!err) {
                return resolve(dbres[0].UserID)
            } else {
                logger.log(err.message)
                return reject(err)
            }
        })
    })
}

async function activateCode(UserID, code) {
    const codequery = await codeValid(code)
    if (codequery.status == 200) {
        return new Promise((resolve, reject) => {
            db.query(`
            INSERT INTO premium (owner,start_time,end_time,p_level)
            VALUES(?,?,'2100-12-31','2');
            `, [UserID, getTodaysDate()], (err, dbres) => {
                if (!err) {
                    return resolve({
                        status: 200,
                        msg: 'Activation succesfull!'
                    })
                } else {
                    logger.log(err.message)
                    return resolve({
                        status: 490,
                        msg: err.message
                    })
                }
            })
        })
    } else {
        return {
            status: codequery.status,
            msg: codequery.msg
        }
    }
}

function codeValid(code) {
    return new Promise((resolve, reject) => {
        db.query(`
            SELECT * FROM codes WHERE code_content = ?;
            `, [code], (err, dbres) => {
            if (!err && dbres.length > 0 && dbres[0].can_be_used == 'true') {
                return resolve({
                    status: 200,
                    msg: 'Code is valid'
                })
            } else if (dbres.length == 0) {
                return resolve({
                    status: 491,
                    msg: 'Code is invalid'
                })
            } else {
                logger.log(err.message)
                return resolve({
                    status: 492,
                    msg: err.message
                })
            }
        })
    })

}

function createNewUser(refresh_token, team, sportID, UserName, pw, email) {
    //logger.log(`Registration of new user '${UserName}' in progress...`)
    return new Promise((resolve, reject) => {
        db.query(`
        INSERT INTO users (refresh_token, UserName, pw, email)
        VALUES (?, ?, ?, ?);        
        INSERT INTO calendars (owner, team, sportID)
        VALUES (
        (SELECT UserID
        FROM users
        WHERE UserName = ?),
        ?, ?);  
        `, [refresh_token, UserName, pw, email, UserName, team, sportID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `New user '${UserName}' registered successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
            } else {
                if (err.code == 'ER_DUP_ENTRY') {
                    message = `Username/email already in use!`
                    logger.log(message)
                    return resolve({
                        status: 491,
                        msg: message
                    })
                }
                message = `${err.code + '\n' + err.message}`
                logger.log(message)
                return resolve({
                    status: 492,
                    msg: message
                })
            }
        })
    })
}

async function pwEncrypt(ogpw) {
    return await bcrypt.hash(ogpw, 10)
}

async function loginCheck(UserName, pw) {
    return new Promise((resolve, reject) => {
        db.query(`
        SELECT * FROM users WHERE UserName=?;
        `, [UserName], async(err, dbres) => {
            var message = ''
            if (!err) {
                if (dbres.length > 0) {
                    //logger.log(dbres)
                    message = `User '${UserName}' found!`
                        //logger.log(message)
                    if (await bcrypt.compare(pw, dbres[0].pw)) {
                        message = `${UserName} successfully logged in!`
                        logger.log(message)
                        return resolve({
                            status: 200,
                            msg: message
                        })
                    } else {
                        logger.log(`User '${UserName}' entered wrong password!`)
                        return resolve({
                            status: 490,
                            msg: `Incorrect password!`
                        })
                    }
                } else {
                    //logger.log(dbres)
                    message = `User '${UserName}' does not exist!`
                    logger.log(message)
                    return resolve({
                        status: 491,
                        msg: message
                    })
                }
            } else {
                message = `Database related problem: ${err}`
                logger.log(message)
                return resolve({
                    status: 492,
                    msg: message
                })
            }
        })
    })
}

function editUser(UserID, UserName, region) {
    //logger.log(`Editing user '${UserName}' in progress...`)
    return new Promise((resolve, reject) => {
        db.query(`
        UPDATE users
        SET UserName = ?, region = ?
        WHERE UserID = ?;
        `, [UserName, region, UserID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `User '${UserName}' edited successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
            } else {
                if (err.code == 'ER_DUP_ENTRY') {
                    message = `Username '${UserName}' is already in use!`
                    logger.log(message)
                    return resolve({
                        status: 491,
                        msg: message
                    })
                }
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

function editCalendar(calendarID, team, selected_color, sportID) {
    //logger.log(`Editing user '${UserName}' in progress...`)
    return new Promise((resolve, reject) => {
        db.query(`
        UPDATE calendars
        SET team = ?, selected_color = ?, sportID = ?
        WHERE calendarID = ?;
        `, [team, selected_color, sportID, calendarID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `Calendar edited successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
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

function insertCalendar(team, selected_color, sportID, owner) {
    //logger.log(`Editing user '${UserName}' in progress...`)
    return new Promise((resolve, reject) => {
        db.query(`
        INSERT INTO calendars (team, selected_color, sportID, owner)
        VALUES (?, ?, ?, ?);
        `, [team, selected_color, sportID, owner], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `Calendar inserted successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
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

async function unlinkGoogle(user) {
    const descString = '_footycalendar'
    var query = await googleCom.hasLiveGoogleCalendar(user, descString)
    while (query.hasCalendar) {
        await googleCom.removeGoogleCalendar(user, descString)
        query = await googleCom.hasLiveGoogleCalendar(user, descString)
    }

    //logger.log(`Unlinking google from user '${user.UserName}' in progress...`)
    return new Promise((resolve, reject) => {
        db.query(`
        UPDATE users
        SET refresh_token = 'undefined', googleID = NULL
        WHERE UserID = ?;
        `, [user.UserID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `User '${user.UserName}' unlinked google successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
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

async function updateToken(user, token, googleID) {
    //logger.log(`Updating token for user '${user.UserName}' in progress...`)
    return new Promise((resolve, reject) => {
        db.query(`
        UPDATE users
        SET refresh_token = ?, googleID = ?
        WHERE UserID = ?;
        `, [token, googleID, user.UserID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `User '${user.UserName}' refresh token updated successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
            } else {
                if (err.code == 'ER_DUP_ENTRY') {
                    message = `This google account is already linked to a Footy Calendar!`
                    logger.log(message)
                    return resolve({
                        status: 491,
                        msg: message
                    })
                }
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

async function setNewPw(user, old_pw, new_pw) {
    //logger.log(`Setting new password for user '${user.UserName}' in progress...`)

    const oldPwMatched = await passwordsMatch(user, old_pw)

    if (oldPwMatched.pwsMatch) {
        return new Promise((resolve, reject) => {
            db.query(`
            UPDATE users
            SET pw = ?
            WHERE UserID = ?;
            `, [new_pw, user.UserID], (err, dbres) => {
                var message = ''
                if (!err) {
                    message = `Set new password for user '${user.UserName}' successfully!`
                    logger.log(message)
                    return resolve({
                        status: 200,
                        msg: message
                    })
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
    } else {
        return {
            status: 491,
            msg: oldPwMatched.msg
        }
    }
}

async function findtokenID(token) {
    return new Promise(async(resolve, reject) => {
        db.query(`
        SELECT * FROM forgot_tokens;
        `, async(err, dbres) => {
            var message = ''
            if (!err) {
                for (var i = 0; i < dbres.length; i++) {
                    if (await bcrypt.compare(token, dbres[i].token)) {
                        message = `Found tokenID!`
                        return resolve({
                            tokenID: dbres[i].tokenID,
                            status: 200,
                            msg: message
                        })
                    }
                }
            } else {
                message = `${err.code}`
                logger.log(message)
                return resolve({
                    status: 493,
                    msg: message
                })
            }
        })
    })
}

async function resetPw(token, pw) {
    return new Promise(async(resolve, reject) => {
        const query = await findtokenID(token)
        const new_pw = await pwEncrypt(pw)
        db.query(`
        UPDATE users JOIN forgot_tokens ON users.email = forgot_tokens.user_email
        SET pw = ?
        WHERE tokenID = ?;
        DELETE FROM forgot_tokens
        WHERE tokenID = ?;
        `, [new_pw, query.tokenID, query.tokenID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `Set new password successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
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

async function cancelPremium(premiumID, end_time) {
    return new Promise((resolve, reject) => {
        db.query(`
            DELETE FROM premium
            WHERE premiumID = ?;
            `, [premiumID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `Premium canceled successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
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

async function getPremiumStatus(UserID) {
    return new Promise((resolve, reject) => {
        db.query(`
            SELECT * FROM premium JOIN users on users.userID = premium.owner
            WHERE owner = ?;
            `, [UserID], (err, dbres) => {
            var message = ''
            if (!err && dbres.length > 0) {
                message = `Premium found`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message,
                    data: {
                        UserID: UserID,
                        UserName: dbres[0].UserName,
                        premiumID: dbres[0].premiumID,
                        start_time: dbres[0].start_time,
                        end_time: dbres[0].end_time,
                        p_level: dbres[0].p_level,
                        hasPremium: true
                    }


                })
            } else if (!err && dbres.length == 0) {
                message = `This user has no premium`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message,
                    data: {
                        hasPremium: false
                    }

                })
            } else {
                message = `${err.code}`
                logger.log(message)
                return resolve({
                    status: 493,
                    msg: message,
                    hasPremium: false
                })
            }
        })
    })
}

async function setNewEmail(user, email) {
    //logger.log(`Setting new password for user '${user.UserName}' in progress...`)

    return new Promise((resolve, reject) => {
        db.query(`
        UPDATE users
        SET email = ?
        WHERE UserID = ?;
        `, [email, user.UserID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `Set new email for user '${user.UserName}' successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
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

async function deleteAccount(user, pw) {

    const pwMatched = await passwordsMatch(user, pw)

    if (pwMatched.pwsMatch) {
        await unlinkGoogle(user)
        return new Promise((resolve, reject) => {
            db.query(`
            DELETE FROM calendars
            WHERE owner = ?;
            DELETE FROM premium
            WHERE owner = ?;
            DELETE FROM users
            WHERE UserID = ?;
            `, [user.UserID, user.UserID, user.UserID], (err, dbres) => {
                var message = ''
                if (!err) {
                    message = `Account '${user.UserName}' deleted successfully!`
                    logger.log(message)
                    return resolve({
                        status: 200,
                        msg: message
                    })
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
    } else {
        return {
            status: 491,
            msg: pwMatched.msg
        }
    }
}

async function deleteCalendar(calendarID, user, descString) {

    await googleCom.removeGoogleCalendar(user, descString)

    return new Promise((resolve, reject) => {
        db.query(`
            DELETE FROM calendars
            WHERE calendarID = ?;
            `, [calendarID], (err, dbres) => {
            var message = ''
            if (!err) {
                message = `Calendar deleted successfully!`
                logger.log(message)
                return resolve({
                    status: 200,
                    msg: message
                })
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

async function passwordsMatch(user, pw) {
    return new Promise((resolve, reject) => {
        db.query(`
        SELECT * FROM users WHERE UserID=?;
        `, [user.UserID], async(err, dbres) => {
            var message = ''
            if (!err) {
                if (dbres.length > 0) {
                    //logger.log(dbres)
                    message = `User '${user.UserName}' found!`
                        //logger.log(message)
                    if (await bcrypt.compare(pw, dbres[0].pw)) {
                        message = `${user.UserName} entered corect pw!`
                            //logger.log(message)
                        return resolve({
                            pwsMatch: true,
                            status: 200,
                            msg: message
                        })
                    } else {
                        //logger.log(`User '${user.UserName}' entered wrong password!`)
                        return resolve({
                            pwsMatch: false,
                            status: 490,
                            msg: `Incorrect password!`
                        })
                    }
                } else {
                    //logger.log(dbres)
                    message = `User '${user.UserName}' does not exist!`
                        //logger.log(message)
                    return resolve({
                        pwsMatch: false,
                        status: 491,
                        msg: message
                    })
                }
            } else {
                message = `Database related problem: ${err}`
                logger.log(message)
                return resolve({
                    pwsMatch: false,
                    status: 492,
                    msg: message
                })
            }
        })
    })
}

function getTodaysDate() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0') // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0')

    const formattedDate = `${year}-${month}-${day}`
    return formattedDate
}


/////////////////////////////////////////////////////

module.exports = {
    getActiveUserInfo,
    getCalendarUserInfo,
    emailLookup,
    forgotPw,
    findUserID,
    activateCode,
    codeValid,
    createNewUser,
    pwEncrypt,
    loginCheck,
    editUser,
    editCalendar,
    insertCalendar,
    unlinkGoogle,
    updateToken,
    setNewPw,
    findtokenID,
    resetPw,
    cancelPremium,
    getPremiumStatus,
    setNewEmail,
    deleteAccount,
    deleteCalendar,
    passwordsMatch
}