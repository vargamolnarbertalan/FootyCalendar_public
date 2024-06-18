const logger = require('./logger')

function newIsValidTimeString(inputString) {
    // Define the regular expression pattern
    var pattern = /^[0-9.:\s]+$/

    // Test the input string against the pattern
    return pattern.test(inputString)
}

async function dbLoad(teamname, sportID) {
    //logger.log('WAITING FOR API...')
    const browser = await puppeteer.launch({
        headless: false, // 'new', false
        defaultViewport: null,
        args: ['--start-maximized']
    })
    const page = await browser.newPage()
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
        url = page.url() + 'meccsek'
        await page.goto(url)
        const teamDB = await getFixtures(page, sportID)
            //await browser.close()
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

async function getFixtures(page, sportID) {

    var apiCheckError = await page.$$eval('#live-table > div.event.event--fixtures > div > div > div', divs => {
        if (divs.length != 0) {
            return false
        } else {
            return true
        }
    })

    if (!apiCheckError) {
        var eventList = await page.$$eval('#live-table > div.event.event--fixtures > div > div > div', divs => {
            var eventListHelp = []
                //console.log('listlength: ' + divs.length)
            var i = 1
            for (var div of divs) {
                if (div.className.includes('event__header')) {
                    eventListHelp.push({
                        position: i,
                        name: div.querySelector('.event__title--name').textContent
                    })
                }
                i++
            }
            var helper = 0
            for (var i = 0; i < eventListHelp.length; i++) {
                eventListHelp[i].position = eventListHelp[i].position - helper
                helper++
            }
            return eventListHelp
        })
    } else {
        var eventList = await page.$$eval('#teamPage > section > div > div', divs => {
            var eventListHelp = []
                //console.log('listlength: ' + divs.length)
            var i = 1
            for (var div of divs) {
                if (div.className.includes('event__header')) {
                    eventListHelp.push({
                        position: i,
                        name: div.querySelector('.event__title--name').textContent
                    })
                }
                i++
            } // EDDIG JO
            var helper = 0
            for (var i = 0; i < eventListHelp.length; i++) {
                eventListHelp[i].position = eventListHelp[i].position - helper
                helper++
            }
            return eventListHelp
        })
    }

    var fixtures = await page.$$eval('.event__match', fixtures => {
        var fixturesHelp = []
        for (var fixture of fixtures) {
            const childSVG = fixture.querySelector('svg.tv-ico.icon.icon--tv')
            const sharpStart = fixture.querySelector('.event__time').textContent

            if (true) {
                //console.log(sharpStart)
                if (childSVG) {
                    fixturesHelp.push({
                        key: '',
                        home: fixture.querySelector('.event__participant.event__participant--home').textContent,
                        away: fixture.querySelector('.event__participant.event__participant--away').textContent,
                        starttime: fixture.querySelector('.event__time').textContent,
                        endtime: '',
                        competition: '',
                        broadcasted: true,
                        tv: '-',
                    })
                } else {
                    fixturesHelp.push({
                        key: '',
                        home: fixture.querySelector('.event__participant.event__participant--home').textContent,
                        away: fixture.querySelector('.event__participant.event__participant--away').textContent,
                        starttime: fixture.querySelector('.event__time').textContent,
                        endtime: '',
                        competition: '',
                        broadcasted: false,
                        tv: '-'
                    })
                }
            }
        }
        //console.log(fixturesHelp)
        return fixturesHelp
    })

    //console.log(fixtures)
    // EDDIG JO

    // MERGING FIXTURES WITH COMPETITIONS
    for (var i = 0; i < eventList.length; i++) {
        if (i == eventList.length - 1) {
            for (var j = eventList[i].position - 1; j < fixtures.length; j++) {
                fixtures[j].competition = eventList[i].name
                    //console.log(fixtures[j])
            }
        } else {
            for (var j = eventList[i].position - 1; j < eventList[i + 1].position - 1; j++) {
                fixtures[j].competition = eventList[i].name
                    //console.log(fixtures[j])
            }
        }
    }

    //console.log(fixtures)
    // EDDIG JO


    // GETTING TVS
    var tvs = []
    var tvHtmls = await page.$$('.tv-ico.icon.icon--tv')
    for (let tv of tvHtmls) {
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(150)
        await tv.hover()
        try {
            var actual = await page.$eval('#tooltip-1 > span > span > a', element => element.textContent)
        } catch (err) {
            logger.log(err)
            var actual = 'tv-404'
        }
        if (actual != 'Live Streaming' && actual != 'tv-404') {
            tvs.push(actual)
        }
    }

    //console.log(tvs)



    //MERGING TVS WITH FIXTURES, GENERATING KEYS AND CALCULATING TIMES
    var j = 0
    var results = []
    for (var fixture of fixtures) {

        if (fixture.starttime.includes(':') && isValidTimeString(fixture.starttime)) {
            fixture.starttime = dateConverter(fixture.starttime)
            fixture.endtime = calcEndTime(fixture.starttime, sportID)
            if (fixture.broadcasted) {
                fixture.tv = tvs[j]
                j++
            }
            fixture.key = generateKey(fixture)
            results.push(fixture)
        }

    }
    //console.log(results)
    return results
}

function dateConverter(inputDateStr) {
    // Get the current date
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth()
    const currentDay = new Date().getDate()

    // Extract components from the input string
    const [day, month, time] = inputDateStr.split(/[.\s]+/)
    var realYear
    if (month < currentMonth) {
        realYear = currentYear + 1
    } else if (month == currentMonth && day < currentDay) {
        realYear = currentYear + 1
    } else {
        realYear = currentYear
    }

    // Combine the components to form a valid date string
    const formattedDateStr = `${realYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}:00`

    return formattedDateStr
}

function calcEndTime(dateTimeString, sportID) {
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

function generateKey(fixture) {
    const str = fixture.home + fixture.away + fixture.starttime + fixture.tv
    return str.replace(/[^a-z0-9]/gi, '').toLowerCase().replace(/[wxyz]/g, '0')
}