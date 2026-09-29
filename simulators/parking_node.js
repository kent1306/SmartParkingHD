// parking_node.js

const mqtt = require("mqtt");

// MQTT connection
const { url, options } = require("./mqtt_config");
const client = mqtt.connect(url, options);

// Basic information of this parking node
const parkingID = "PARK-A";
const slotID = process.argv[2] || "A01";
const fixedPlate = process.argv[3] || null;
const deviceID = `NODE-${slotID}`;
const fixedSensorStatus =
    process.argv[4] || "working";

// MQTT topic for this parking slot
const topic = `smartparking/${parkingID}/slots/${slotID}`;

// Generate a random licence plate
function generatePlate()
{
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const plate =
        letters[Math.floor(Math.random() * letters.length)] +
        letters[Math.floor(Math.random() * letters.length)] +
        letters[Math.floor(Math.random() * letters.length)] +
        Math.floor(Math.random() * 900 + 100);

    return plate;
}

// Generate simulated parking sensor data
function generateParkingData()
{
    const occupied = Math.random() < 0.5;

    const parkingData =
    {
        parkingID: parkingID,
        slotID: slotID,
        deviceID: deviceID,

        status: occupied ? "occupied" : "available",

        plateNumber: occupied
            ? (fixedPlate || generatePlate())
            : null,

        LEDstatus: occupied ? "red" : "green",

        timestamp: new Date().toISOString(),

        sensorStatus: fixedSensorStatus
    };

    return parkingData;
}

// When connected to MQTT
client.on("connect", () =>
{
    console.log("Parking node connected to MQTT");
    console.log("Publishing to topic:", topic);

    // Generate and send parking data every 2 seconds
    setInterval(() =>
    {
        const parkingData = generateParkingData();

        const jsonString = JSON.stringify(parkingData);

        client.publish(topic, jsonString);

        console.log("Published:");
        console.log(jsonString);

    }, 2000);
});

// MQTT error
client.on("error", (error) =>
{
    console.log("MQTT error:", error.message);
});