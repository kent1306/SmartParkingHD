import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    PutCommand
} from "@aws-sdk/lib-dynamodb";


const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const alertsTable = "Alerts";


export const handler = async (event) =>
{
    try
    {
        console.log("Alert event received:");
        console.log(event);


        const timestamp =
            new Date().toISOString();


        const alertType =
            event.alertType || "unpaid_vehicle";


        let message;


        if (alertType === "sensor_failure")
            {
                message =
                    `Sensor at ${event.slotID} reported ${event.sensorStatus}`;
            }
            else if (alertType === "gateway_failure")
            {
                message =
                    `Gateway ${event.gatewayID} for ${event.parkingID} is offline`;
            }
            else
            {
                message =
                    `Vehicle ${event.plateNumber} has no valid payment or permit`;
            }


        const sourceID =
            event.slotID ||
            event.gatewayID ||
            "unknown";


        const alert =
        {
            parkingID: event.parkingID,

            alertID:
                `${timestamp}#${sourceID}`,

            alertType: alertType,

            message: message,

            status: "active",

            timestamp: timestamp
        };

        if (event.slotID)
            {
                alert.slotID =
                    event.slotID;
            }


        if (event.plateNumber)
        {
            alert.plateNumber =
                event.plateNumber;
        }


        if (event.deviceID)
        {
            alert.deviceID =
                event.deviceID;
        }

        if (event.gatewayID)
            {
                alert.gatewayID =
                    event.gatewayID;
            }


        if (event.sensorStatus)
        {
            alert.sensorStatus =
                event.sensorStatus;
        }


        await dynamoDB.send(
            new PutCommand({
                TableName: alertsTable,
                Item: alert
            })
        );


        console.log(
            "Alert saved successfully"
        );


        return {
            alertStatus: "created",
            alertType: alertType,
            parkingID: event.parkingID,
            slotID: event.slotID
        };
    }

    catch (error)
    {
        console.log("Error:", error);

        return {
            alertStatus: "error",
            error: error.message
        };
    }
};