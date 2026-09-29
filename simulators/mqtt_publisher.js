const mqtt = require("mqtt");

const { url, options } = require("./mqtt_config");
const client = mqtt.connect(url, options);

const topic = "smartparking/PARK-A/A01";

client.on("connect", () =>
{
    console.log("Publisher connected to MQTT");

    const message =
    {
        parkingID: "PARK-A",
        slotID: "A01",
        status: "occupied"
    };

    client.publish(topic, JSON.stringify(message));

    console.log("Published:", message);
});