const API_BASE_URL =
    "https://a7fls5fve5.execute-api.us-east-1.amazonaws.com/dev";


const PARKING_EVENT_URL =
    `${API_BASE_URL}/parking-event`;

const PARKING_SPACES_URL =
    `${API_BASE_URL}/parking-spaces`;


// --------------------------------
// Configuration
// --------------------------------

const API_KEY =
    process.env.SMART_PARKING_API_KEY;


if (!API_KEY)
{
    console.error(
        "ERROR: SMART_PARKING_API_KEY is missing."
    );

    process.exit(1);
}


// Argument 1 = total number of events
const TOTAL_EVENTS =
    Number(process.argv[2] || 20);


// Argument 2 = target event arrival rate
const EVENTS_PER_SECOND =
    Number(process.argv[3] || 5);


// Argument 3 = safety cap for outstanding HTTP requests
const MAX_IN_FLIGHT =
    Number(process.argv[4] || 4);


if (
    !Number.isInteger(TOTAL_EVENTS) ||
    TOTAL_EVENTS <= 0
)
{
    console.error(
        "TOTAL_EVENTS must be a positive integer."
    );

    process.exit(1);
}


if (
    !Number.isFinite(EVENTS_PER_SECOND) ||
    EVENTS_PER_SECOND <= 0
)
{
    console.error(
        "EVENTS_PER_SECOND must be greater than 0."
    );

    process.exit(1);
}


if (
    !Number.isInteger(MAX_IN_FLIGHT) ||
    MAX_IN_FLIGHT <= 0
)
{
    console.error(
        "MAX_IN_FLIGHT must be a positive integer."
    );

    process.exit(1);
}


// Unique ID for this burst test
const runID =
    `BURST-${Date.now()}`;


// Time between event starts
const SEND_INTERVAL_MS =
    1000 / EVENTS_PER_SECOND;


// --------------------------------
// Helper
// --------------------------------

function wait(ms)
{
    return new Promise(
        resolve =>
            setTimeout(resolve, ms)
    );
}


// --------------------------------
// Send one parking event
// --------------------------------

async function sendParkingEvent(index)
{
    const slotNumber =
        String(index + 1).padStart(3, "0");


    const slotID =
        `${runID}-${slotNumber}`;


    // Valid plate only.
    // This isolates ParkingService -> PaymentService
    // without adding AlertService load.
    const parkingData =
    {
        parkingID:
            "PARK-A",

        slotID:
            slotID,

        deviceID:
            `NODE-${slotID}`,

        status:
            "occupied",

        plateNumber:
            "ABC123",

        LEDstatus:
            "red",

        timestamp:
            new Date(
                Date.now() + index
            ).toISOString(),

        sensorStatus:
            "working"
    };


    const requestStart =
        Date.now();


    try
    {
        const response =
            await fetch(
                PARKING_EVENT_URL,
                {
                    method:
                        "POST",

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

            status:
                response.status,

            success:
                response.ok,

            duration:
                Date.now() - requestStart,

            startedAt:
                requestStart,

            finishedAt:
                Date.now(),

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

            status:
                "ERROR",

            success:
                false,

            duration:
                Date.now() - requestStart,

            startedAt:
                requestStart,

            finishedAt:
                Date.now(),

            responseBody:
                error.message
        };
    }
}


// --------------------------------
// Read parking data
// --------------------------------

async function getParkingSpaces()
{
    const response =
        await fetch(
            PARKING_SPACES_URL,
            {
                headers:
                {
                    "x-api-key":
                        API_KEY
                }
            }
        );


    if (!response.ok)
    {
        const body =
            await response.text();


        throw new Error(
            `GET parking-spaces failed: ` +
            `${response.status} ${body}`
        );
    }


    return await response.json();
}


// --------------------------------
// Wait for downstream payment processing
// --------------------------------

async function waitForPaymentCompletion(
    testStart,
    httpFinishedAt
)
{
    console.log(
        "\nWaiting for downstream payment processing..."
    );


    let peakApplicationBacklog = 0;


    // Maximum observation time = 60 seconds
    for (
        let attempt = 1;
        attempt <= 120;
        attempt++
    )
    {
        await wait(500);


        try
        {
            const parkingResult =
                await getParkingSpaces();


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


            const completed =
                testSpaces.filter(
                    space =>
                        space.paymentStatus ===
                            "valid"
                ).length;


            const applicationBacklog =
                TOTAL_EVENTS - completed;


            peakApplicationBacklog =
                Math.max(
                    peakApplicationBacklog,
                    applicationBacklog
                );


            console.log(
                `Check ${attempt}: ` +
                `${completed}/${TOTAL_EVENTS} payments completed, ` +
                `pending=${applicationBacklog}`
            );


            if (
                completed === TOTAL_EVENTS
            )
            {
                const completedAt =
                    Date.now();


                return {
                    completed:
                        true,

                    endToEndTime:
                        completedAt - testStart,

                    recoveryTime:
                        completedAt - httpFinishedAt,

                    peakApplicationBacklog:
                        peakApplicationBacklog
                };
            }
        }

        catch (error)
        {
            console.log(
                `Check ${attempt} failed: ` +
                error.message
            );
        }
    }


    return {
        completed:
            false,

        endToEndTime:
            null,

        recoveryTime:
            null,

        peakApplicationBacklog:
            peakApplicationBacklog
    };
}


// --------------------------------
// Run burst test
// --------------------------------

async function runTest()
{
    console.log(
        "\n========================================"
    );

    console.log(
        "Smart Parking Burst / Scalability Test"
    );

    console.log(
        "========================================"
    );


    console.log(
        `Total events: ${TOTAL_EVENTS}`
    );

    console.log(
        `Target arrival rate: ${EVENTS_PER_SECOND} events/second`
    );

    console.log(
        `Maximum client in-flight requests: ${MAX_IN_FLIGHT}`
    );

    console.log(
        `Run ID: ${runID}`
    );


    console.log(
        "\nAll events use valid plate ABC123."
    );

    console.log(
        "This isolates ParkingService -> PaymentService processing.\n"
    );


    const testStart =
        Date.now();


    let inFlight = 0;
    let peakInFlight = 0;

    const promises = [];
    const results = [];


    let firstRequestStart = null;
    let lastRequestStart = null;


    for (
        let i = 0;
        i < TOTAL_EVENTS;
        i++
    )
    {
        // Target time for this event
        const targetStart =
            testStart +
            (i * SEND_INTERVAL_MS);


        const delay =
            targetStart - Date.now();


        if (delay > 0)
        {
            await wait(delay);
        }


        // Safety cap
        while (
            inFlight >= MAX_IN_FLIGHT
        )
        {
            await wait(10);
        }


        const actualStart =
            Date.now();


        if (
            firstRequestStart === null
        )
        {
            firstRequestStart =
                actualStart;
        }


        lastRequestStart =
            actualStart;


        inFlight++;


        peakInFlight =
            Math.max(
                peakInFlight,
                inFlight
            );


        const promise =
            sendParkingEvent(i)
                .then(
                    result =>
                    {
                        results.push(
                            result
                        );


                        console.log(
                            `Request ${result.request}/${TOTAL_EVENTS}: ` +
                            `${result.status}, ` +
                            `${result.duration} ms`
                        );
                    }
                )
                .finally(
                    () =>
                    {
                        inFlight--;
                    }
                );


        promises.push(
            promise
        );
    }


    // Wait for all HTTP responses
    await Promise.all(
        promises
    );


    const httpFinishedAt =
        Date.now();


    // --------------------------------
    // HTTP result summary
    // --------------------------------

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
        durations.reduce(
            (sum, value) =>
                sum + value,
            0
        ) / durations.length;


    const minimumDuration =
        Math.min(
            ...durations
        );


    const maximumDuration =
        Math.max(
            ...durations
        );


    const httpTestTime =
        httpFinishedAt - testStart;


    const requestStartWindow =
        lastRequestStart -
        firstRequestStart;


    const effectiveStartRate =
        requestStartWindow > 0

            ? (TOTAL_EVENTS - 1) /
                (
                    requestStartWindow /
                    1000
                )

            : TOTAL_EVENTS;


    console.log(
        "\n========================================"
    );

    console.log(
        "HTTP Burst Summary"
    );

    console.log(
        "========================================"
    );


    console.log(
        "Configured events:",
        TOTAL_EVENTS
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
        "Target arrival rate:",
        EVENTS_PER_SECOND,
        "events/second"
    );


    console.log(
        "Effective event start rate:",
        effectiveStartRate.toFixed(2),
        "events/second"
    );


    console.log(
        "Peak client in-flight requests:",
        peakInFlight
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
        "HTTP phase duration:",
        httpTestTime,
        "ms"
    );


    if (
        successful !== TOTAL_EVENTS
    )
    {
        console.log(
            "\nSome HTTP requests failed."
        );

        console.log(
            "Stopping before downstream verification."
        );


        process.exitCode = 1;

        return;
    }


    // --------------------------------
    // Downstream completion
    // --------------------------------

    const processingResult =
        await waitForPaymentCompletion(
            testStart,
            httpFinishedAt
        );


    console.log(
        "\n========================================"
    );

    console.log(
        "End-to-End Processing Summary"
    );

    console.log(
        "========================================"
    );


    console.log(
        "All payments completed:",
        processingResult.completed
    );


    if (
        processingResult.completed
    )
    {
        console.log(
            "End-to-end completion time:",
            processingResult.endToEndTime,
            "ms"
        );


        console.log(
            "Post-ingestion recovery time:",
            processingResult.recoveryTime,
            "ms"
        );
    }


    console.log(
        "Peak application pending payments:",
        processingResult.peakApplicationBacklog
    );


    if (
        processingResult.completed
    )
    {
        console.log(
            "\nBURST PIPELINE TEST PASSED"
        );
    }
    else
    {
        console.log(
            "\nBURST PIPELINE TEST INCOMPLETE"
        );

        process.exitCode = 1;
    }
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