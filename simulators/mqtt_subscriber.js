const mqtt = require("mqtt");

const { url, options } = require("./mqtt_config");
const client = mqtt.connect(url, options);

const topic = "smartparking/PARK-A/display";

client.on("connect", () =>
{
    console.log("Subscriber connected to MQTT");

    client.subscribe(topic, (error) =>
    {
        if (error)
        {
            console.log("Subscribe error:", error);
        }
        else
        {
            console.log("Subscribed to:", topic);
        }
    });
});

client.on("message", (topic, message) =>
{
    console.log("Topic:", topic);
    console.log("Message:", message.toString());
});

client.on("error", (error) =>
{
    console.log("MQTT error:", error.message);
});