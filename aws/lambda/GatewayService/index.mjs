import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    UpdateCommand,
    QueryCommand
} from "@aws-sdk/lib-dynamodb";


const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const gatewayTable = "GatewayStatus";
const alertsTable = "Alerts";


export const handler = async (event) =>
{
    try
    {
        console.log("Gateway heartbeat received:");
        console.log(event);


        const gatewayData =
            event.body
                ? JSON.parse(event.body)
                : event;


        if (
            !gatewayData.gatewayID ||
            !gatewayData.parkingID ||
            !gatewayData.timestamp
        )
        {
            return {
                statusCode: 400,

                body: JSON.stringify({
                    message:
                        "Missing required gateway heartbeat data"
                })
            };
        }

        await dynamoDB.send(
            new UpdateCommand({
                TableName: gatewayTable,

                Key: {
                    gatewayID:
                        gatewayData.gatewayID
                },

                UpdateExpression:
                    "SET parkingID = :parkingID, " +
                    "#status = :status, " +
                    "lastSeen = :lastSeen",

                ExpressionAttributeNames: {
                    "#status": "status"
                },

                ExpressionAttributeValues: {
                    ":parkingID":
                        gatewayData.parkingID,

                    ":status":
                        "online",

                    ":lastSeen":
                        gatewayData.timestamp
                }
            })
        );


        console.log(
            "Gateway heartbeat saved"
        );

        const alertResult =
            await dynamoDB.send(
                new QueryCommand({
                    TableName: alertsTable,

                    KeyConditionExpression:
                        "parkingID = :parkingID",

                    FilterExpression:
                        "alertType = :alertType " +
                        "AND gatewayID = :gatewayID " +
                        "AND #status = :activeStatus",

                    ExpressionAttributeNames: {
                        "#status": "status"
                    },

                    ExpressionAttributeValues: {
                        ":parkingID":
                            gatewayData.parkingID,

                        ":alertType":
                            "gateway_failure",

                        ":gatewayID":
                            gatewayData.gatewayID,

                        ":activeStatus":
                            "active"
                    }
                })
            );


        const activeAlerts =
            alertResult.Items || [];

        for (const alert of activeAlerts)
        {
            await dynamoDB.send(
                new UpdateCommand({
                    TableName: alertsTable,

                    Key: {
                        parkingID:
                            alert.parkingID,

                        alertID:
                            alert.alertID
                    },

                    UpdateExpression:
                        "SET #status = :resolved, " +
                        "resolvedAt = :resolvedAt",

                    ExpressionAttributeNames: {
                        "#status": "status"
                    },

                    ExpressionAttributeValues: {
                        ":resolved":
                            "resolved",

                        ":resolvedAt":
                            new Date().toISOString()
                    }
                })
            );
        }


        console.log(
            `${activeAlerts.length} gateway alert(s) resolved`
        );


        return {
            statusCode: 200,

            body: JSON.stringify({
                message:
                    "Gateway heartbeat received",

                gatewayID:
                    gatewayData.gatewayID,

                status:
                    "online",

                resolvedAlerts:
                    activeAlerts.length
            })
        };
    }

    catch (error)
    {
        console.log("Error:", error);


        return {
            statusCode: 500,

            body: JSON.stringify({
                message:
                    "Failed to process gateway heartbeat",

                error:
                    error.message
            })
        };
    }
};