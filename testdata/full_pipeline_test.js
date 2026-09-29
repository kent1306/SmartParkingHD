const API_BASE_URL =
    "https://a7fls5fve5.execute-api.us-east-1.amazonaws.com/dev";


const PARKING_EVENT_URL =
    `${API_BASE_URL}/parking-event`;

const PARKING_SPACES_URL =
    `${API_BASE_URL}/parking-spaces`;

const ALERTS_URL =
    `${API_BASE_URL}/alerts`;


// ------------------------------------------------
// Configuration
// ------------------------------------------------

// API key is loaded from .env
const API_KEY =
    process.env.SMART_PARKING_API_KEY;


if (!API_KEY)
{
    console.error(
        "ERROR: SMART_PARKING_API_KEY is missing."
    );

    console.error(
        "Run the script using: " +
        "npx dotenv -e .env -- node .\\testdata\\full_pipeline_test.js 10"
    );

    process.exit(1);
}


// Read total requests from command line.
// Default = 10 requests.
const requestedTotal =
    Number(process.argv[2] || 10);


if (
    !Number.isInteger(requestedTotal) ||
    requestedTotal <= 0
)
{
    console.error(
        "ERROR: TOTAL_REQUESTS must be a positive integer."
    );

    process.exit(1);
}


const TOTAL_REQUESTS =
    requestedTotal;


// Half of the requests use valid payment.
// The rest use unpaid payment.
const EXPECTED_VALID =
    Math.ceil(TOTAL_REQUESTS / 2);

const EXPECTED_UNPAID =
    Math.floor(TOTAL_REQUESTS / 2);

const EXPECTED_ALERTS =
    EXPECTED_UNPAID;


// Unique ID for this test run
const runID =
    `FULL-${Date.now()}`;


//
// ------------------------------------------------
// Send one occupied parking event
// ------------------------------------------------
//

async function sendParkingEvent(index)
{
    const slotNumber =
        String(index + 1).padStart(3, "0");


    const slotID =
        `${runID}-${slotNumber}`;


    // Alternate between:
    // ABC123 = valid student permit
    // OYF789 = unpaid / no valid permit
    const plateNumber =
        index % 2 === 0
            ? "ABC123"
            : "OYF789";


    const parkingData =
    {
        parkingID: "PARK-A",

        slotID: slotID,

        deviceID:
            `NODE-${slotID}`,

        status: "occupied",

        plateNumber: plateNumber,

        LEDstatus: "red",

        timestamp:
            new Date(
                Date.now() + index
            ).toISOString(),

        sensorStatus: "working"
    };


    const startTime =
        Date.now();


    try
    {
        const response =
            await fetch(
                PARKING_EVENT_URL,
                {
                    method: "POST",

                    headers:
                    {
                        "Content-Type":
                            "application/json",

                        "x-api-key":
                            API_KEY
                    },

                    body:
                        JSON.stringify(
                            parkingData
                        )
                }
            );


        const responseBody =
            await response.text();


        return {
            request:
                index + 1,

            slotID:
                slotID,

            plateNumber:
                plateNumber,

            status:
                response.status,

            duration:
                Date.now() - startTime,

            success:
                response.ok,

            responseBody:
                responseBody
        };
    }

    catch (error)
    {
        return {
            request:
                index + 1,

            slotID:
                slotID,

            plateNumber:
                plateNumber,

            status:
                "ERROR",

            duration:
                Date.now() - startTime,

            success:
                false,

            responseBody:
                error.message
        };
    }
}


// ------------------------------------------------
// Wait helper
// ------------------------------------------------

function wait(ms)
{
    return new Promise(
        resolve =>
            setTimeout(resolve, ms)
    );
}


// ------------------------------------------------
// Get dashboard API data
// ------------------------------------------------

async function getJson(url)
{
    const response =
        await fetch(url);


    if (!response.ok)
    {
        const body =
            await response.text();

        throw new Error(
            `GET ${url} failed: ` +
            `${response.status} ${body}`
        );
    }


    return await response.json();
}


// ------------------------------------------------
// Check downstream services
// ------------------------------------------------

async function verifyPipeline()
{
    console.log(
        "\nWaiting for asynchronous services..."
    );


    let finalResult =
    {
        spaces: 0,
        valid: 0,
        unpaid: 0,
        alerts: 0
    };


    // Check every 2 seconds.
    // Maximum observation window = 20 seconds.
    for (
        let attempt = 1;
        attempt <= 10;
        attempt++
    )
    {
        await wait(2000);


        try
        {
            const parkingResult =
                await getJson(
                    PARKING_SPACES_URL
                );


            const alertResult =
                await getJson(
                    ALERTS_URL
                );


            // Only records created by THIS run
            const testSpaces =
                (
                    parkingResult.data ||
                    []
                ).filter(
                    space =>
                        space.parkingID ===
                            "PARK-A" &&

                        space.slotID &&

                        space.slotID.startsWith(
                            runID
                        )
                );


            const validPayments =
                testSpaces.filter(
                    space =>
                        space.paymentStatus ===
                            "valid"
                );


            const unpaidPayments =
                testSpaces.filter(
                    space =>
                        space.paymentStatus ===
                            "unpaid"
                );


            // Only unpaid_vehicle alerts
            // created by THIS run
            const matchingAlerts =
                (
                    alertResult.data ||
                    []
                ).filter(
                    alert =>
                        alert.parkingID ===
                            "PARK-A" &&

                        alert.slotID &&

                        alert.slotID.startsWith(
                            runID
                        ) &&

                        alert.alertType ===
                            "unpaid_vehicle"
                );


            // Count unique unpaid slots
            // to avoid duplicate alerts
            const uniqueAlertSlots =
                new Set(
                    matchingAlerts.map(
                        alert =>
                            alert.slotID
                    )
                );


            finalResult =
            {
                spaces:
                    testSpaces.length,

                valid:
                    validPayments.length,

                unpaid:
                    unpaidPayments.length,

                alerts:
                    uniqueAlertSlots.size
            };


            console.log(
                `Check ${attempt}: ` +
                `${finalResult.spaces}/${TOTAL_REQUESTS} spaces, ` +
                `${finalResult.valid}/${EXPECTED_VALID} valid, ` +
                `${finalResult.unpaid}/${EXPECTED_UNPAID} unpaid, ` +
                `${finalResult.alerts}/${EXPECTED_ALERTS} alerts`
            );


            if (
                finalResult.spaces ===
                    TOTAL_REQUESTS &&

                finalResult.valid ===
                    EXPECTED_VALID &&

                finalResult.unpaid ===
                    EXPECTED_UNPAID &&

                finalResult.alerts ===
                    EXPECTED_ALERTS
            )
            {
                break;
            }
        }

        catch (error)
        {
            console.log(
                `Check ${attempt} failed:`,
                error.message
            );
        }
    }


    console.log(
        "\nFull Pipeline Verification"
    );


    console.log(
        "Parking records:",
        finalResult.spaces,
        `/ ${TOTAL_REQUESTS}`
    );


    console.log(
        "Valid payments:",
        finalResult.valid,
        `/ ${EXPECTED_VALID}`
    );


    console.log(
        "Unpaid payments:",
        finalResult.unpaid,
        `/ ${EXPECTED_UNPAID}`
    );


    console.log(
        "Alerts created:",
        finalResult.alerts,
        `/ ${EXPECTED_ALERTS}`
    );


    const passed =
        finalResult.spaces ===
            TOTAL_REQUESTS &&

        finalResult.valid ===
            EXPECTED_VALID &&

        finalResult.unpaid ===
            EXPECTED_UNPAID &&

        finalResult.alerts ===
            EXPECTED_ALERTS;


    if (passed)
    {
        console.log(
            "\nFULL PIPELINE TEST PASSED"
        );
    }
    else
    {
        console.log(
            "\nFULL PIPELINE TEST INCOMPLETE"
        );

        process.exitCode = 1;
    }
}


// ------------------------------------------------
// Run test
// ------------------------------------------------

async function runTest()
{
    console.log(
        "\n========================================"
    );

    console.log(
        "Smart Parking Baseline Test"
    );

    console.log(
        "========================================"
    );

    console.log(
        `Total events: ${TOTAL_REQUESTS}`
    );

    console.log(
        "Client concurrency: 1 (sequential)"
    );

    console.log(
        `Run ID: ${runID}\n`
    );


    const startTime =
        Date.now();


    const results = [];


    // IMPORTANT:
    // Each request waits for the previous
    // request to finish.
    //
    // This keeps client concurrency at 1.
    for (
        let i = 0;
        i < TOTAL_REQUESTS;
        i++
    )
    {
        console.log(
            `Sending request ` +
            `${i + 1}/${TOTAL_REQUESTS}...`
        );


        const result =
            await sendParkingEvent(i);


        results.push(result);


        console.log(
            `Request ${result.request}: ` +
            `${result.status}, ` +
            `${result.duration} ms`
        );


        // Stop early if a request fails.
        // This avoids continuing unnecessary load.
        if (!result.success)
        {
            console.log(
                "\nRequest failed. " +
                "Stopping the test early."
            );

            break;
        }
    }


    const totalTime =
        Date.now() - startTime;


    const successful =
        results.filter(
            result =>
                result.success
        ).length;


    const failed =
        results.filter(
            result =>
                !result.success
        ).length;


    const durations =
        results.map(
            result =>
                result.duration
        );


    const averageDuration =
        durations.length > 0

            ? durations.reduce(
                (sum, duration) =>
                    sum + duration,
                0
            ) / durations.length

            : 0;


    const minimumDuration =
        durations.length > 0
            ? Math.min(...durations)
            : 0;


    const maximumDuration =
        durations.length > 0
            ? Math.max(...durations)
            : 0;


    // Throughput:
    // completed requests per second
    const throughput =
        totalTime > 0

            ? results.length /
                (totalTime / 1000)

            : 0;


    console.log(
        "\n========================================"
    );

    console.log(
        "Individual Request Results"
    );

    console.log(
        "========================================"
    );


    console.table(
        results.map(
            result => ({
                request:
                    result.request,

                slotID:
                    result.slotID,

                plateNumber:
                    result.plateNumber,

                status:
                    result.status,

                duration_ms:
                    result.duration,

                success:
                    result.success
            })
        )
    );


    console.log(
        "\n========================================"
    );

    console.log(
        "Request Summary"
    );

    console.log(
        "========================================"
    );


    console.log(
        "Configured requests:",
        TOTAL_REQUESTS
    );


    console.log(
        "Requests sent:",
        results.length
    );


    console.log(
        "Successful:",
        successful
    );


    console.log(
        "Failed:",
        failed
    );


    console.log(
        "Client concurrency:",
        1
    );


    console.log(
        "Total test time:",
        totalTime,
        "ms"
    );


    console.log(
        "Average request duration:",
        averageDuration.toFixed(2),
        "ms"
    );


    console.log(
        "Minimum request duration:",
        minimumDuration,
        "ms"
    );


    console.log(
        "Maximum request duration:",
        maximumDuration,
        "ms"
    );


    console.log(
        "Throughput:",
        throughput.toFixed(2),
        "requests/second"
    );


    // Print failed response bodies
    // only when something went wrong
    if (failed > 0)
    {
        console.log(
            "\nFailed Request Details"
        );


        results
            .filter(
                result =>
                    !result.success
            )
            .forEach(
                result =>
                {
                    console.log(
                        `Request ${result.request}: ` +
                        `${result.status} - ` +
                        `${result.responseBody}`
                    );
                }
            );
    }


    // Do not continue pipeline verification
    // if all configured requests were not completed
    // successfully.
    if (
        successful !== TOTAL_REQUESTS
    )
    {
        console.log(
            "\nPipeline verification skipped " +
            "because not all requests succeeded."
        );

        process.exitCode = 1;

        return;
    }


    await verifyPipeline();
}


runTest()
    .catch(
        error =>
        {
            console.error(
                "Unexpected test error:",
                error
            );

            process.exitCode = 1;
        }
    );