const puppeteer = require('puppeteer')
const path = require('path')
const eventlengths = require(path.join(__dirname, '../public/js/event_lengths.json'))
const regionList = require(path.join(__dirname, '../public/js/regions.json'))
var url = `https://www.flashscore.com/`
const moment = require('moment')

const launchProps = {
    headless: 'new', // 'new', false
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox'],
    // executablePath: __dirname + '/Chrome/Application/chrome.exe' // Windows
    executablePath: '/usr/bin/google-chrome-stable' // Linux
}

const logger = require('./logger')

async function newDbLoad(teamname, sportID) {
    logger.log('API running...')
    teamname = teamname.replace(/\//g, ' ')
        //logger.log('WAITING FOR API...')
    const browser = await puppeteer.launch({
        headless: launchProps.headless,
        defaultViewport: launchProps.defaultViewport,
        args: launchProps.args
    })
    var [page] = await browser.pages()

    //BLOCKING HEAVY TRAFFIC
    await page.setRequestInterception(true)
    page.on('request', request => {
            if (request.resourceType() === 'image' || request.resourceType() === 'font') {
                request.abort()
            } else {
                request.continue()
            }
        })
        ///////////////
    page.setDefaultTimeout(30000)
    try {

        await page.setViewport({
            width: 1920,
            height: 1080
        })
        await page.goto(url)
        await page.waitForSelector('#search-window')
        await page.click('#search-window')
        await page.waitForSelector('#search-window > div > div > div.searchInput > div > button')
        await page.click('#search-window > div > div > div.searchInput > div > button')
        await page.click(`#search-window > div > div > div.searchInput > div > ul > li:nth-child(${sportID}) > button`)
        await page.waitForSelector('.searchInput__input')
        await page.type('.searchInput__input', teamname)
        await page.waitForSelector('#search-window > div > div > div.searchResults > div > a:nth-child(1)')
        await page.click('#search-window > div > div > div.searchResults > div > a:nth-child(1)')
        url = page.url() + 'fixtures'
        await page.goto(url)
        const teamDB = await newGetFixtures(page, sportID, browser)
        await browser.close()
        if (teamDB.length == 0) {
            return {
                status: 491,
                msg: 'This team has no upcoming matches!'
            }
        } else {
            return {
                status: 200,
                db: teamDB,
                msg: 'Matches successfully loaded'
            }
        }

    } catch (err) {
        return {
            status: 492,
            msg: 'API related error: ' + err
        }
    }

}

async function newGetFixtures(page, sportID, browser) {
    var fixtures = []
    const matchExists = await page.evaluate(() => {
        const el = document.querySelector('.event__match')
        if (el) {
            return true
        }
        return false
    })

    if (matchExists) {
        const pptrFixturesIds = await page.$$eval('.event__match', fixtures => {
            var fixturesIds = []
            var index = -1
            for (var i = 0; i < fixtures.length; i++) {
                fixturesIds.push(fixtures[i].id)
                if (fixtures[i].id == '') {
                    //console.log('invalid element')
                    index = i
                }
            }
            if (index > -1) {
                fixtures.splice(index, 1)
            }
            return fixturesIds
        })

        var fixturesLinks = []

        for (var id of pptrFixturesIds) {
            fixturesLinks.push(getFixtureLink(id))
        }

        for (var i = 0; i < fixturesLinks.length; i++) {
            await page.goto(fixturesLinks[i])
            const timeElClassName = await page.$eval('#detail > div.duelParticipant > div.duelParticipant__startTime > div', el => el.className)

            if (timeElClassName.includes('line_through')) {
                //console.log("postponed")
            } else {
                const timeEl = await page.$eval('#detail > div.duelParticipant > div.duelParticipant__startTime > div', el => el.textContent)
                const homeEl = await page.$eval('.duelParticipant__home > .participant__participantNameWrapper', el => el.textContent)
                const awayEl = await page.$eval('.duelParticipant__away > .participant__participantNameWrapper', el => el.textContent)
                const compEl = await page.$eval('#detail > div.tournamentHeader.tournamentHeaderDescription > div > span.tournamentHeader__country > a', el => el.textContent)
                const tvEl = await page.evaluate(() => {
                    var tv = []
                    const elArray = document.querySelectorAll('.br__broadcast')
                    if (elArray.length > 0) {
                        for (var x = 0; x < elArray.length; x++) {
                            tv.push(elArray[x].textContent)
                        }
                    }
                    return tv
                })

                const comp = compEl
                const home = homeEl
                const away = awayEl
                const start = startTimeFormatting(timeEl)
                const end = newCalcEndTime(startTimeFormatting(timeEl), sportID)
                const key = newGenerateKey(home, away, start)
                var tv = []
                if (tvEl.length > 0) {
                    for (var el of tvEl) {
                        tv.push(splitNetworkString(el))
                    }
                }

                fixtures.push({
                    key: key,
                    home: home,
                    away: away,
                    starttime: start,
                    endtime: end,
                    competition: comp,
                    tv: tv
                })

            }

        }
        return fixtures
    } else {
        return fixtures
    }


}

function splitNetworkString(inputString) {
    // Use regular expression to split at the first ' (' substring from the right
    const regex = /^(.+)\s+\(([^)]+)\)$/

    const match = inputString.match(regex)

    if (!match) {
        // If the string doesn't match the expected format, return null or handle accordingly
        if (inputString == "Spiler1 TV" || inputString == "Spiler2 TV" || inputString == "Spíler1 TV" || inputString == "Spíler2 TV" || inputString == "M4 Sport" || inputString == "Duna World / M4 Sport +" || inputString == "Duna World" || inputString == "M4 Sport +") {
            return { network: inputString, region: 'HUN' }
        }
        return { network: inputString, region: 'unknown' }
    }

    // Extract values from the matched groups
    const network = match[1].trim()
    const region = match[2].toUpperCase()

    // Create and return the object
    return { network: network, region: region }
}

function generateSummary(data, prefRegion) {
    var prefRegionObj = regionList.find(region => region.id === prefRegion)
    if (data.tv.some(obj => obj.region === prefRegionObj.name)) {
        var foundTV = {}
        for (var el of data.tv) {
            if (el.region == prefRegionObj.name) {
                foundTV = { network: el.network, region: el.region }
            }
        }
        return `${data.home} - ${data.away} | ${data.competition} | TV: ${foundTV.network}`
            // Diósgyőri VTK - Kecskeméti TE | OTP Bank Liga | TV: M4 Sport
    } else {
        return `${data.home} - ${data.away} | ${data.competition}`
            // Diósgyőri VTK - Kecskeméti TE | OTP Bank Liga
    }
}

async function generateSummary2(data, prefRegionNum) {
    const prefRegion = await regionList.find(region => region.id === prefRegionNum)
    if (data.tv.some(obj => obj.region === prefRegion.name)) {
        var foundTV = {}
        for (var el of data.tv) {
            if (el.region == prefRegion.name) {
                foundTV = { network: el.network, region: el.region }
            }
        }
        return `${data.home} - ${data.away} | ${data.competition} | TV: ${foundTV.network}`
            // Diósgyőri VTK - Kecskeméti TE | OTP Bank Liga | TV: M4 Sport
    } else {
        return `${data.home} - ${data.away} | ${data.competition}`
            // Diósgyőri VTK - Kecskeméti TE | OTP Bank Liga
    }
}

function startTimeFormatting(inputString) {

    // Parse the input string using the specified format
    const parsedDate = moment(inputString, 'DD.MM.YYYY HH:mm')

    // Check if the parsing was successful
    if (!parsedDate.isValid()) {
        return 'Invalid date format'
    }

    // Format the date in ISO format (YYYY-MM-DDThh:mm:ss)
    const formattedDate = parsedDate.format('YYYY-MM-DDTHH:mm:ss')

    return formattedDate
}

function newCalcEndTime(dateTimeString, sportID) {
    // Parse the input string to a Date object
    const originalDate = new Date(dateTimeString)
    var eventlength = 105
    for (var i = 0; i < eventlengths.length; i++) {
        if (sportID == eventlengths[i].id) {
            eventlength = eventlengths[i].length
        }
    }

    // Add 90 minutes to the original date
    const newDate = new Date(originalDate.getTime() + eventlength * 60 * 1000) // minutes in milliseconds

    // Format the new date as 'YYYY-MM-DDThh:mm:ss'
    const year = newDate.getFullYear()
    const month = String(newDate.getMonth() + 1).padStart(2, '0')
    const day = String(newDate.getDate()).padStart(2, '0')
    const hours = String(newDate.getHours()).padStart(2, '0')
    const minutes = String(newDate.getMinutes()).padStart(2, '0')
    const seconds = String(newDate.getSeconds()).padStart(2, '0')

    const newDateTimeString = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`

    return newDateTimeString
}

function newGenerateKey(home, away, start) {
    const str = home + away + start
    return str.replace(/[^a-z0-9]/gi, '').toLowerCase().replace(/[wxyz]/g, '0')
}

async function apiSearch(searchString, sport) {
    var searchRes = {
        name: '',
        sport: '',
        country: ''
    }
    var sportNum = sport

    const browser = await puppeteer.launch({
        headless: launchProps.headless,
        defaultViewport: launchProps.defaultViewport,
        args: launchProps.args
    })
    var [page] = await browser.pages()
    page.setDefaultTimeout(10000)
    try {
        await page.setViewport({
            width: 1920,
            height: 1080
        })
        await page.goto(url)
        await page.waitForSelector('#search-window')
        await page.click('#search-window')
        await page.waitForSelector('#search-window > div > div > div.searchInput > div > button')
        await page.click('#search-window > div > div > div.searchInput > div > button')
        await page.click(`#search-window > div > div > div.searchInput > div > ul > li:nth-child(${sportNum}) > button`)
        await page.waitForSelector('.searchInput__input')
        await page.type('.searchInput__input', searchString)
            //await page.waitForTimeout(1000)
        try {
            await page.waitForSelector('#search-window > div > div > div.searchResults > div > a:nth-child(1) > div.searchResult__participantName')
                //console.log('found')
            var element = await page.waitForSelector('#search-window > div > div > div.searchResults > div > a:nth-child(1) > div.searchResult__participantName')
            searchRes.name = await element.evaluate(el => el.textContent)
            element = await page.waitForSelector('#search-window > div > div > div.searchResults > div > a:nth-child(1) > div.searchResult__participantCategory')
            var helper = await element.evaluate(el => el.textContent)
            helper = helper.split(', ')
            searchRes.sport = helper[0]
            searchRes.country = helper[1]
            await browser.close()
            return {
                status: 200,
                msg: searchRes
            }
        } catch (err) {
            logger.log(err)
                //console.log('not found')

            await browser.close()
            return {
                status: 491,
                msg: 'Didn\'t find anything like that.'
            }
        }
    } catch (e) {
        return {
            status: 492,
            msg: 'API related error: ' + e
        }
    }

}

function getFixtureLink(inputString) {
    const lastUnderscoreIndex = inputString.lastIndexOf('_')

    if (lastUnderscoreIndex !== -1) {
        return `https://www.flashscore.com/match/${ inputString.substring(lastUnderscoreIndex + 1) }/#/match-summary`
    } else {
        // If there is no underscore in the string, return the original string
        return inputString
    }
}

/* PUPPPETEER DEBUGGING HELP
    setTimeout(function(){debugger;}, 5000)
*/

/////////////////////////////////////////////////////

module.exports = {
    newDbLoad,
    generateSummary,
    splitNetworkString,
    apiSearch
}