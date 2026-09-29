import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    PutCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";

import {
    LambdaClient,
    InvokeCommand
} from "@aws-sdk/client-lambda";

import {
    SQSClient,
    SendMessageCommand
} from "@aws-sdk/client-sqs";

// AWS clients
const client =
    new DynamoDBClient({});

const dynamoDB =
    DynamoDBDocumentClient.from(client);


const lambdaClient =
    new LambdaClient({});


const sqsClient =
    new SQSClient({});

// Tables and queue
const spacesTable =
    "ParkingSpaces";

const eventsTable =
    "ParkingEvents";


const paymentQueueURL =
    process.env.PAYMENT_QUEUE_URL;

// Main handler
export const handler = async (event) =>
{
    try
    {
        console.log(
            "Parking event received:"
        );

        console.log(event);


        const parkingData =
            event.body
                ? JSON.parse(event.body)
                : event;

        // 1. Validate parking event
        if (
            !parkingData.parkingID ||
            !parkingData.slotID ||
            !parkingData.deviceID ||
            !parkingData.status ||
            !parkingData.timestamp ||
            !parkingData.sensorStatus
        )
        {
            return {
                statusCode: 400,

                body: JSON.stringify({
                    message:
                        "Missing required parking data"
                })
            };
        }


        if (
            parkingData.status !== "occupied" &&
            parkingData.status !== "available"
        )
        {
            return {
                statusCode: 400,

                body: JSON.stringify({
                    message:
                        "Invalid parking status"
                })
            };
        }


        if (
            parkingData.status === "occupied" &&
            !parkingData.plateNumber
        )
        {
            return {
                statusCode: 400,

                body: JSON.stringify({
                    message:
                        "Occupied space requires plateNumber"
                })
            };
        }

        // 2. Update current parking state
        if (
            parkingData.status === "occupied" &&
            parkingData.plateNumber
        )
        {
            await dynamoDB.send(
                new UpdateCommand({
                    TableName:
                        spacesTable,

                    Key: {
                        parkingID:
                            parkingData.parkingID,

                        slotID:
                            parkingData.slotID
                    },

                    UpdateExpression:
                        "SET deviceID = :deviceID, " +
                        "#status = :status, " +
                        "plateNumber = :plateNumber, " +
                        "LEDstatus = :LEDstatus, " +
                        "#timestamp = :timestamp, " +
                        "sensorStatus = :sensorStatus, " +
                        "paymentStatus = :paymentStatus " +
                        "REMOVE permitType, paymentCheckedAt",

                    ExpressionAttributeNames: {
                        "#status":
                            "status",

                        "#timestamp":
                            "timestamp"
                    },

                    ExpressionAttributeValues: {
                        ":deviceID":
                            parkingData.deviceID,

                        ":status":
                            parkingData.status,

                        ":plateNumber":
                            parkingData.plateNumber,

                        ":LEDstatus":
                            parkingData.LEDstatus,

                        ":timestamp":
                            parkingData.timestamp,

                        ":sensorStatus":
                            parkingData.sensorStatus,

                        ":paymentStatus":
                            "checking"
                    }
                })
            );
        }

        else
        {
            await dynamoDB.send(
                new UpdateCommand({
                    TableName:
                        spacesTable,

                    Key: {
                        parkingID:
                            parkingData.parkingID,

                        slotID:
                            parkingData.slotID
                    },

                    UpdateExpression:
                        "SET deviceID = :deviceID, " +
                        "#status = :status, " +
                        "plateNumber = :plateNumber, " +
                        "LEDstatus = :LEDstatus, " +
                        "#timestamp = :timestamp, " +
                        "sensorStatus = :sensorStatus " +
                        "REMOVE paymentStatus, permitType, paymentCheckedAt",

                    ExpressionAttributeNames: {
                        "#status":
                            "status",

                        "#timestamp":
                            "timestamp"
                    },

                    ExpressionAttributeValues: {
                        ":deviceID":
                            parkingData.deviceID,

                        ":status":
                            parkingData.status,

                        ":plateNumber":
                            parkingData.plateNumber || null,

                        ":LEDstatus":
                            parkingData.LEDstatus,

                        ":timestamp":
                            parkingData.timestamp,

                        ":sensorStatus":
                            parkingData.sensorStatus
                    }
                })
            );
        }


        console.log(
            "ParkingSpaces updated"
        );

        // 3. Save event history
        const eventID =
            `${parkingData.timestamp}#${parkingData.slotID}`;


        await dynamoDB.send(
            new PutCommand({
                TableName:
                    eventsTable,

                Item: {
                    ...parkingData,

                    eventID:
                        eventID
                }
            })
        );


        console.log(
            "Parking event saved to history"
        );

        // 4. Send payment event to SQS
        if (
            parkingData.status === "occupied" &&
            parkingData.plateNumber
        )
        {
            if (!paymentQueueURL)
            {
                throw new Error(
                    "PAYMENT_QUEUE_URL is not configured"
                );
            }


            const paymentEvent =
            {
                parkingID:
                    parkingData.parkingID,

                slotID:
                    parkingData.slotID,

                plateNumber:
                    parkingData.plateNumber
            };


            await sqsClient.send(
                new SendMessageCommand({
                    QueueUrl:
                        paymentQueueURL,

                    MessageBody:
                        JSON.stringify(
                            paymentEvent
                        )
                })
            );


            console.log(
                "Payment event sent to SQS"
            );
        }

        if (
            parkingData.sensorStatus !== "working"
        )
        {
            const alertEvent =
            {
                parkingID:
                    parkingData.parkingID,

                slotID:
                    parkingData.slotID,

                deviceID:
                    parkingData.deviceID,

                alertType:
                    "sensor_failure",

                sensorStatus:
                    parkingData.sensorStatus
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
                "Sensor failure AlertService triggered"
            );
        }

        return {
            statusCode: 200,

            body: JSON.stringify({
                message:
                    "Parking event accepted successfully",

                parkingID:
                    parkingData.parkingID,

                slotID:
                    parkingData.slotID
            })
        };
    }

    catch (error)
    {
        console.log(
            "Error:",
            error
        );


        return {
            statusCode: 500,

            body: JSON.stringify({
                message:
                    "Failed to process parking event",

                error:
                    error.message
            })
        };
    }
};