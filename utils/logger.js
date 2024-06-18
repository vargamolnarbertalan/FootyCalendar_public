function log(msg, ip, user) {
    const timestamp = getFormattedLocalTime()
    var loggedMsg = ''
    if (user !== undefined && ip !== undefined) {
        loggedMsg = `${timestamp} | User: ${user} | IP: ${ip} | ${msg}`
    } else if (ip !== undefined) {
        loggedMsg = `${timestamp} | IP: ${ip} | ${msg}`
    } else {
        loggedMsg = `${timestamp} | ${msg}`
    }

    /*
    db.query(`
    INSERT INTO logs (msg)
    VALUES (?);
    `,[loggedMsg], (err, dbres) => {
        var message = ''
        if (err) {
            console.log(err)
        }
    }) 
    */
    console.log(loggedMsg)
}

function getFormattedLocalTime() {
    const now = new Date()

    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')

    return `${year}. ${month}. ${day}. ${hours}:${minutes}:${seconds}`
}

/////////////////////////////////////////////////////

module.exports = {
    log
}