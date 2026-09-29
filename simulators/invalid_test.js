const mqtt = require("mqtt");

const { url, options } = require("./mqtt_config");
const client = mqtt.connect(url, options);

const topic = "smartparking/PARK-A/A01";

client.on("connect", () =>
{
    console.log("Connected to MQTT");

    const invalidData =
    {
        parkingID: "PARK-A",
        slotID: "A01",
        deviceID: "NODE-A01",

        // Invalid value
        status: "busy",

        plateNumber: "ABC123",
        LEDstatus: "red",
        timestamp: new Date().toISOString(),
        sensorStatus: "working"
    };

    client.publish(topic, JSON.stringify(invalidData), () =>
    {
        console.log("Invalid message sent");
        client.end();
    });
});