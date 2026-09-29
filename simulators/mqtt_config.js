const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");

if (fs.existsSync(envPath))
{
    process.loadEnvFile(envPath);
}

const { MQTT_HOST, MQTT_USERNAME, MQTT_PASSWORD } = process.env;

if (!MQTT_HOST || !MQTT_USERNAME || !MQTT_PASSWORD)
{
    throw new Error(
        "Set MQTT_HOST, MQTT_USERNAME and MQTT_PASSWORD in the project .env file"
    );
}

module.exports = {
    url: `mqtts://${MQTT_HOST}:8883`,
    options: {
        username: MQTT_USERNAME,
        password: MQTT_PASSWORD
    }
};
