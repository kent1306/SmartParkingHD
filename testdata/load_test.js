const { randomUUID } = require("node:crypto");

const API_URL =
    "https://a7fls5fve5.execute-api.us-east-1.amazonaws.com/dev/parking-event";

const API_KEY =
    process.env.SMART_PARKING_API_KEY;

if (!API_KEY || !API_KEY.trim())
{
    console.error("ERROR: SMART_PARKING_API_KEY is missing.");
    console.error(
        "Run: npx dotenv -e .env -- node .\\testdata\\load_test.js [10|50|100]"
    );
    process.exit(1);
}

const countArg = process.argv[2];

if (process.argv.length > 3 ||
    (countArg !== undefined && !["10", "50", "100"].includes(countArg)))
{
    console.error("Usage: node testdata/load_test.js [10|50|100]");
    process.exit(1);
}

const TOTAL_REQUESTS = Number(countArg ?? "100");

// A new slot for each request prevents concurrent writes to the same item.
const runID = `${Date.now()}-${randomUUID().slice(0, 8)}`;


async function sendParkingEvent(index)
{
    const slotID =
        `LT-${runID}-${String(index + 1).padStart(3, "0")}`;

    const parkingData =
    {
        parkingID: "PARK-A",

        slotID,

        deviceID: "NODE-LOADTEST",

        status: "available",

        plateNumber: null,

        LEDstatus: "green",

        // Add index so every history event has a different timestamp
        timestamp:
            new Date(Date.now() + index).toISOString(),

        sensorStatus: "working"
    };


    const startTime = Date.now();


    try
    {
        const response = await fetch(
            API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": API_KEY
                },

                body: JSON.stringify(parkingData)
            }
        );


        const duration = Date.now() - startTime;


        return {
            request: index + 1,
            slotID,
            status: response.status,
            duration: duration,
            success: response.ok
        };
    }

    catch (error)
    {
        return {
            request: index + 1,
            slotID,
            status: "ERROR",
            duration: Date.now() - startTime,
            success: false,
            error: error.message
        };
    }
}



async function runLoadTest()
{
    console.log(
        `Starting load test ${runID} with ${TOTAL_REQUESTS} concurrent requests...\n`
    );


    const startTime = Date.now();

    const requests = [];


    for (let i = 0; i < TOTAL_REQUESTS; i++)
    {
        requests.push(
            sendParkingEvent(i)
        );
    }


    const results =
        await Promise.all(requests);


    const totalTime =
        Date.now() - startTime;


    const successful =
        results.filter(
            result => result.success
        ).length;


    const failed =
        results.length - successful;


    const averageDuration =
        results.reduce(
            (sum, result) => sum + result.duration,
            0
        ) / results.length;


    console.table(results);


    console.log("\nLoad Test Summary");

    console.log(
        "Total requests:",
        TOTAL_REQUESTS
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
        "Total test time:",
        totalTime,
        "ms"
    );

    console.log(
        "Average request duration:",
        averageDuration.toFixed(2),
        "ms"
    );
}


runLoadTest();
