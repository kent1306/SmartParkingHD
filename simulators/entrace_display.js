const mqtt = require("mqtt");

const { url, options } = require("./mqtt_config");
const client = mqtt.connect(url, options);

const topic = "smartparking/PARK-A/display";

client.on("connect", () =>
{
    console.log("Entrance display connected to MQTT");

    client.subscribe(topic, (error) =>
    {
        if (error)
        {
            console.log("Subscribe error:", error);
        }
        else
        {
            console.log("Listening for parking updates...");
        }
    });
});

client.on("message", (topic, message) =>
{
    const data = JSON.parse(message.toString());

    console.log("-----------------------------");
    console.log("PARKING LOT:", data.parkingID);
    console.log("Total spaces:", data.totalSpaces);
    console.log("Occupied spaces:", data.occupiedSpaces);
    console.log("AVAILABLE SPACES:", data.availableSpaces);
});