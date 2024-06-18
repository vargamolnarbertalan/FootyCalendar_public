const { google } = require('googleapis')

const logger = require('./logger')
const dbCom = require('./dbCom')
const newScraper = require('./newScraper')

const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
)

const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
]
const timezone = 'Europe/Budapest'

async function forceFootyCalendarID(activeUser, team, sportID) {
    const descString = 'team_' + team + '_sport_' + sportID + '_footycalendar'
    var foundID = ''
        //logger.log(`Checking if ${activeUser.UserName} already has a footycalendar in google calendar...`)
    oauth2Client.setCredentials({
        refresh_token: activeUser.refresh_token
    })
    const calendar = google.calendar('v3')
    var userCalendarListObject = {}
    try {
        userCalendarListObject = await calendar.calendarList.list({
            auth: oauth2Client
        })
    } catch (error) {
        logger.log(error)
    }
    for (var userCalendar of userCalendarListObject.data.items) {
        if (typeof userCalendar.description !== 'undefined' && userCalendar.description.includes(descString)) {
            //logger.log('YES')
            foundID = userCalendar.id
        }
    }
    if (foundID == '') {
        //logger.log('NO')
        //logger.log(`Creating ${activeUser.UserName}'s footycalendar in google calendar...`)
        oauth2Client.setCredentials({
            refresh_token: activeUser.refresh_token
        })
        const calendar = google.calendar('v3')

        try {
            const response = await calendar.calendars.insert({
                    auth: oauth2Client,
                    requestBody: {
                        description: descString,
                        summary: team + ' matches',
                        timeZone: timezone
                    }
                })
                //logger.log(response)
            foundID = response.data.id
        } catch (error) {
            logger.log(error)
        }
        //logger.log(`Created ${activeUser.UserName}'s footycalendar in google calendar!`)
    }
    return foundID
}

async function insertGoogleEvents(activeUser, team, sportID, selected_color, flashdbres) {
    const database = flashdbres.db

    if (flashdbres.status == 492) return {
        status: flashdbres.status,
        msg: flashdbres.msg
    }
    if (flashdbres.status == 491) return {
        status: flashdbres.status,
        msg: flashdbres.msg
    }
    var message = ''
    const localCalendarID = await forceFootyCalendarID(activeUser, team, sportID)
        //logger.log(`Inserting events into ${activeUser.UserName}'s google calendar...`)
    oauth2Client.setCredentials({
        refresh_token: activeUser.refresh_token
    })
    const calendar = google.calendar('v3')
        //console.log(database)
    for (var data of database) {

        try {
            await calendar.events.insert({
                auth: oauth2Client,
                calendarId: localCalendarID,
                requestBody: {
                    summary: newScraper.generateSummary(data, activeUser.region),
                    description: 'Added by Footy Calendar',
                    id: data.key,
                    colorId: selected_color,
                    start: {
                        dateTime: new Date(data.starttime),
                        timeZone: timezone
                    },
                    end: {
                        dateTime: new Date(data.endtime),
                        timeZone: timezone
                    }

                }
            })
        } catch (error) {
            message = error
            logger.log(message)
            return {
                status: 490,
                msg: message
            }
        }
    }
    message = `Successfully inserted events into ${activeUser.UserName}'s google calendar!`
    logger.log(message)
    return {
        status: 200,
        msg: message
    }
}

async function hasLiveGoogleCalendar(activeUser, descString) {
    //logger.log(`Checking if ${activeUser.UserName} already has a footycalendar in google calendar...`)
    oauth2Client.setCredentials({
        refresh_token: activeUser.refresh_token
    })
    const calendar = google.calendar('v3')
    try {
        const userCalendarListObject = await calendar.calendarList.list({
            auth: oauth2Client
        })
        for (var userCalendar of userCalendarListObject.data.items) {
            if (typeof userCalendar.description !== 'undefined' && userCalendar.description.includes(descString)) {
                //console.log('YES')
                return {
                    hasCalendar: true,
                    calendarIdString: userCalendar.id
                }
            }
        }
    } catch (error) {
        logger.log(error)
    }

    //console.log('NO')
    return {
        hasCalendar: false,
        calendarIdString: ''
    }

}

async function removeGoogleCalendar(activeUser, descString) {
    const result = await hasLiveGoogleCalendar(activeUser, descString)
        //logger.log(`Deleting ${activeUser.UserName}'s footycalendar in google calendar...`)
    oauth2Client.setCredentials({
        refresh_token: activeUser.refresh_token
    })
    const calendar = google.calendar('v3')


    try {
        const deleteObj = await calendar.calendars.delete({
            auth: oauth2Client,
            calendarId: result.calendarIdString
        })
    } catch (error) {
        message = error
        logger.log(message)
        return {
            status: 490,
            msg: message
        }
    }

    message = `Successfully deleted ${activeUser.UserName}'s google calendar!`
    logger.log(message)
    return {
        status: 200,
        msg: message
    }
}

async function getLiveGoogleEvents(activeUser, index) {
    const query = await dbCom.getCalendarUserInfo(activeUser.UserID)
    const calendarDescString = 'team_' + query.data.calendars[index].team + '_sport_' + query.data.calendars[index].sportID + '_footycalendar'
    oauth2Client.setCredentials({
        refresh_token: activeUser.refresh_token
    })
    const calendar = google.calendar('v3')
    try {
        const query2 = await getLiveGoogleCalendarId(activeUser, calendarDescString)
        const response = await calendar.events.list({
            auth: oauth2Client,
            calendarId: query2.id
        })
        logger.log(`Got the list of ${activeUser.UserName}'s events that are live in their google calendar!`)
        return {
            status: 200,
            events: response.data.items
        }

    } catch (error) {
        logger.log(error)
        return {
            status: 491,
        }
    }
}

async function getLiveGoogleCalendarId(activeUser, calendarDescString) {
    oauth2Client.setCredentials({
        refresh_token: activeUser.refresh_token
    })
    const calendar = google.calendar('v3')
    try {
        const response = await calendar.calendarList.list({
            auth: oauth2Client
        })
        for (var i = 0; i < response.data.items.length; i++) {
            if (response.data.items[i].description == calendarDescString) {
                return {
                    status: 200,
                    id: response.data.items[i].id
                }
            }
        }
    } catch (error) {
        logger.log(error)
        return {
            status: 491,
            id: -1
        }
    }
}

/////////////////////////////////////////////////////

module.exports = {
    forceFootyCalendarID,
    insertGoogleEvents,
    hasLiveGoogleCalendar,
    removeGoogleCalendar,
    getLiveGoogleEvents,
    getLiveGoogleCalendarId,
    oauth2Client,
    scopes
}