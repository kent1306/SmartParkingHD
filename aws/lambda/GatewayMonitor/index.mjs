import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    ScanCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";

import {
    LambdaClient,
    InvokeCommand
} from "@aws-sdk/client-lambda";


const client = new DynamoDBClient({});
const dynamoDB =
    DynamoDBDocumentClient.from(client);

const lambdaClient =
    new LambdaClient({});


const gatewayTable =
    "GatewayStatus";


const OFFLINE_THRESHOLD_MS =
    30 * 1000;


export const handler = async () =>
{
    try
    {
        const now = Date.now();

        const result =
            await dynamoDB.send(
                new ScanCommand({
                    TableName: gatewayTable
                })
            );


        const gateways =
            result.Items || [];


        console.log(
            `Checking ${gateways.length} gateway(s)`
        );

        for (const gateway of gateways)
        {
            const lastSeen =
                Date.parse(gateway.lastSeen);


            if (isNaN(lastSeen))
            {
                console.log(
                    "Invalid lastSeen for:",
                    gateway.gatewayID
                );

                continue;
            }


            const timeSinceLastHeartbeat =
                now - lastSeen;


            console.log(
                gateway.gatewayID,
                "last heartbeat:",
                timeSinceLastHeartbeat,
                "ms ago"
            );

            if (
                timeSinceLastHeartbeat >
                    OFFLINE_THRESHOLD_MS &&
                gateway.status !== "offline"
            )
            {
                console.log(
                    "Gateway offline:",
                    gateway.gatewayID
                );


                // Update gateway status
                await dynamoDB.send(
                    new UpdateCommand({
                        TableName: gatewayTable,

                        Key: {
                            gatewayID:
                                gateway.gatewayID
                        },

                        UpdateExpression:
                            "SET #status = :status",

                        ExpressionAttributeNames: {
                            "#status": "status"
                        },

                        ExpressionAttributeValues: {
                            ":status": "offline"
                        }
                    })
                );


                // Trigger AlertService
                const alertEvent =
                {
                    parkingID:
                        gateway.parkingID,

                    gatewayID:
                        gateway.gatewayID,

                    alertType:
                        "gateway_failure"
                };


                await lambdaClient.send(
                    new InvokeCommand({
                        FunctionName:
                            "AlertService",

                        InvocationType:
                            "Event",

                        Payload:
                            Buffer.from(
                                JSON.stringify(
                                    alertEvent
                                )
                            )
                    })
                );


                console.log(
                    "Gateway failure alert triggered"
                );
            }
        }


        return {
            statusCode: 200,

            body: JSON.stringify({
                message:
                    "Gateway monitoring completed"
            })
        };
    }

    catch (error)
    {
        console.log(
            "Gateway monitor error:",
            error
        );


        return {
            statusCode: 500,

            body: JSON.stringify({
                message:
                    "Gateway monitoring failed",

                error:
                    error.message
            })
        };
    }
};