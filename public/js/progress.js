function startProgress() {
    $("#loadOverlay").css("opacity", "0.6")
    $("#loadOverlay").css("z-index", "100")
}

function stopProgress() {
    $("#loadOverlay").css("opacity", "0")
    $("#loadOverlay").css("z-index", "-100")
}

function displayResult() {
    setTimeout(function() {
        $("#result").animate({ opacity: 1 }, 1000); // 1000 milliseconds = 1 second
    }, 0);
    setTimeout(function() {
        $("#result").animate({ opacity: 0 }, 1000); // 1000 milliseconds = 1 second
    }, 5000);
}

function searchInit(n) {
    startProgress()
    const searchString = $(`#team${n}`).val()
    if (searchString.length < 2) {
        stopProgress()
        $(`#save-btn${n}`).prop("disabled", true)
        openAlert('You must enter at least 2 characters in order to search!')
    } else {
        const sport = $(`#sport-selector${n}`).val()
            //console.log("apiSearch alert " + searchString + " " + sport)
        $.ajax({
            type: "POST",
            url: "/api-search",
            data: {
                'searchString': searchString,
                'sport': sport
            },
            success: function(data, status, xhr) {
                // Handle the success response from the server
                $("#result").css("color", "rgb(144, 255, 110)")
                    //$("#result").text(xhr.responseText)
                    //console.log(`response status code: ${xhr.status} | response text: ${xhr.responseText}`)
                    //displayResult()
                const queryRes = data
                    //console.log("queryRes.name: " + queryRes.name)
                if (queryRes.sport == 'Soccer') {
                    queryRes.sport = 'Football'
                }
                openConfirm(`Did you mean the following?\n\n${queryRes.name}\n${queryRes.country}\n${queryRes.sport}`, 'CONFIRM', 'CANCEL', n, queryRes.name, queryRes.sport)
            },
            error: function(xhr, status, error) {
                // Handle errors
                console.error(xhr.responseText)
                $("#result").css("color", "rgb(255, 94, 94)")
                $("#result").text("Error: " + xhr.responseText)
                displayResult()
                console.log(`response status code: ${xhr.status} | response text: ${xhr.responseText}`)
                stopProgress()
                $(`#save-btn${n}`).prop("disabled", true)
            }
        })
    }

}

// Add this at the end of your existing JavaScript file

// Function to open the custom alert
function openAlert(alertString) {
    $('#customAlert').css('display', 'block')
    $('.overlay').css('display', 'block')
    $('#customAlert > div > p').text(alertString)
}

// Function to close the custom alert
function closeAlert() {
    $('#customAlert').css('display', 'none')
    $('.overlay').css('display', 'none')
}

// Function to open the custom confirm dialog
function openConfirm(question, option1, option2, n, name, sport) {
    $('#customConfirm').data("n", n)
    $('#customConfirm').data("name", name)
    $('#customConfirm').data("sport", sport)
    $('#customConfirm').css('display', 'block')
    $('.overlay').css('display', 'block')
    $('#question').text(question)
    $('#conf-yes').text(option1)
    $('#conf-no').text(option2)
    stopProgress()
}

// Function to close the custom confirm dialog
function closeConfirm() {
    const n = $('#customConfirm').data("n")
    $(`#save-btn${n}`).prop("disabled", true)
    $('#customConfirm').css('display', 'none')
    $('.overlay').css('display', 'none')
}

// Function to handle the confirmed action
function confirmAction() {
    const n = $('#customConfirm').data("n")
    const name = $('#customConfirm').data("name")
    const sport = $('#customConfirm').data("sport")
    $(`#team${n}`).val(name)
    $(`#sport-selector${n} option[value="${sport}"]`)
    $(`#save-btn${n}`).prop("disabled", false)

    $('#customConfirm').css('display', 'none')
    $('.overlay').css('display', 'none')
}

function premiumOpenConfirm(question, option1, option2, pQuery) {
    $('#customConfirm').data('premiumID', pQuery.premiumID)
    $('#customConfirm').css('display', 'block')
    $('.overlay').css('display', 'block')
    $('#question').text(question)
    $('#conf-yes').text(option1)
    $('#conf-no').text(option2)
    stopProgress()
}

// Function to close the custom confirm dialog
function premiumCloseConfirm() {
    $('#customConfirm').css('display', 'none')
    $('.overlay').css('display', 'none')
}

// Function to handle the confirmed action
function premiumConfirmAction() {
    const premiumID = $('#customConfirm').data('premiumID')
    $.ajax({
        type: "POST",
        url: "/cancel_premium",
        data: {
            premiumID: premiumID,
            end_time: getFormattedDate()
        },
        success: function(response) {
            console.log(`response status code: ${response.status} | response text: ${response.msg}`)
            $("#result").css("color", "rgb(144, 255, 110)")
            $("#result").text(response.msg)
            $("#end").text(getFormattedDate())
            stopProgress()
            displayResult()
            location.href = "/"
        },
        error: function(xhr, status, error) {
            $("#result").css("color", "rgb(255, 94, 94)")
            $("#result").text("Error: " + xhr.responseText)
            displayResult()
            console.log(`response status code: ${xhr.status} | response text: ${xhr.responseText}`)
            stopProgress()
        }
    })

    $('#customConfirm').css('display', 'none')
    $('.overlay').css('display', 'none')
}

function getFormattedDate() {
    const today = new Date()
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(today.getDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
}

function onlyGetCalendarInfo() {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "GET",
            async: false,
            url: "/get-userinfo-calendars",
            success: function(response) {
                return resolve(response)
            },
            error: function(xhr, status, error) {
                console.error(xhr.responseText)
                return resolve(status)
            }
        })
    })
}



function caldelOpenConfirm(question, option1, option2, nth) {
    $('#customConfirm-caldel').data('nth', nth)
    $('#customConfirm-caldel').css('display', 'block')
    $('.overlay').css('display', 'block')
    $('#question-caldel').text(question)
    $('#conf-yes-caldel').text(option1)
    $('#conf-no-caldel').text(option2)
    stopProgress()
}

// Function to close the custom confirm dialog
function caldelCloseConfirm() {
    $('#customConfirm-caldel').css('display', 'none')
    $('.overlay').css('display', 'none')
}

// Function to handle the confirmed action
function caldelConfirmAction() {
    const NTH = $('#customConfirm-caldel').data('nth')
    onlyGetCalendarInfo().then(clientCalendars => {
        startProgress()
        var calendarID = clientCalendars.calendars[NTH].calendarID
        $.ajax({
            type: "POST",
            url: "/delete-calendar",
            async: true,
            data: {
                'calendarID': calendarID,
                'descString': "team_" + clientCalendars.calendars[NTH].team + "_sport_" + clientCalendars.calendars[NTH].sportID + "_footycalendar"
            },
            success: function(data, status, xhr) {
                $("#result").css("color", "rgb(144, 255, 110)")
                $("#result").text(xhr.responseText)
                displayResult()
                stopProgress()
                location.reload()
            },
            error: function(xhr, status, error) {
                console.error(xhr.responseText)
                $("#result").css("color", "rgb(255, 94, 94)")
                $("#result").text("Error: " + xhr.responseText)
                displayResult()
                stopProgress()
            }
        })

        $('#customConfirm-caldel').css('display', 'none')
        $('.overlay').css('display', 'none')
    })
}