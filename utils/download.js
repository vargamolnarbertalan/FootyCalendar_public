const fs = require('fs')
const ics = require('ics')

const logger = require('./logger')
const newScraper = require('./newScraper')

async function createDownloadableCalendar(database, user, team) {
    //logger.log('Generating downloadable calendar...')
    const savePath = `${__dirname}/footy_calendar_${user.UserName}_${team.replace(/[^a-z0-9]/gi, '')}.ics`
    var events = []
    for (var data of database) {

        const datetimeString = data.starttime
        const dt = new Date(datetimeString)

        const year = dt.getFullYear()
        const month = dt.getMonth() + 1 // Months are zero-based, so add 1
        const day = dt.getDate()
        const hour = dt.getHours()
        const minute = dt.getMinutes()

        const datetimeStringEnd = data.endtime
        const dtEnd = new Date(datetimeStringEnd)

        const yearEnd = dtEnd.getFullYear()
        const monthEnd = dtEnd.getMonth() + 1 // Months are zero-based, so add 1
        const dayEnd = dtEnd.getDate()
        const hourEnd = dtEnd.getHours()
        const minuteEnd = dtEnd.getMinutes()

        const event = {
            start: [year, month, day, hour, minute],
            end: [yearEnd, monthEnd, dayEnd, hourEnd, minuteEnd],
            title: newScraper.generateSummary(data, user.region),
            description: 'Added via Footy Calendar'
        }
        events.push(event)
    }

    return new Promise((resolve, reject) => {
        ics.createEvents(events, (error, value) => {
            if (error) {
                logger.log(error)
                return resolve(error)
            } else {
                fs.writeFileSync(savePath, value)
                return resolve(savePath)
            }
        })
    })
}

/////////////////////////////////////////////////////

module.exports = {
    createDownloadableCalendar,
    fs
}