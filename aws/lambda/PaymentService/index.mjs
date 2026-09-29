import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";

import {
    LambdaClient,
    InvokeCommand
} from "@aws-sdk/client-lambda";


const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const lambdaClient = new LambdaClient({});


const paymentTable = "PaymentRecords";
const parkingTable = "ParkingSpaces";


export const handler = async (event) =>
{
    try
    {
        const parkingID = event.parkingID;
        const slotID = event.slotID;
        const plateNumber = event.plateNumber;


        console.log(
            "Checking payment for:",
            plateNumber
        );

        const result = await dynamoDB.send(
            new GetCommand({
                TableName: paymentTable,

                Key: {
                    plateNumber: plateNumber
                }
            })
        );


        let paymentStatus;
        let permitType = null;


        if (
            result.Item &&
            result.Item.paymentStatus === "valid"
        )
        {
            paymentStatus = "valid";
            permitType = result.Item.permitType;

            console.log(
                "Valid payment found"
            );
        }
        else
        {
            paymentStatus = "unpaid";

            console.log(
                "No valid payment found"
            );
        }

        await dynamoDB.send(
            new UpdateCommand({
                TableName: parkingTable,

                Key: {
                    parkingID: parkingID,
                    slotID: slotID
                },

                UpdateExpression:
                    "SET paymentStatus = :paymentStatus, " +
                    "permitType = :permitType, " +
                    "paymentCheckedAt = :paymentCheckedAt",

                ExpressionAttributeValues: {
                    ":paymentStatus": paymentStatus,
                    ":permitType": permitType,
                    ":paymentCheckedAt":
                        new Date().toISOString()
                }
            })
        );


        console.log(
            "Parking space payment status updated"
        );

        if (paymentStatus === "unpaid")
        {
            const alertEvent =
            {
                parkingID: parkingID,
                slotID: slotID,
                plateNumber: plateNumber
            };


            await lambdaClient.send(
                new InvokeCommand({
                    FunctionName: "AlertService",

                    InvocationType: "Event",

                    Payload: Buffer.from(
                        JSON.stringify(alertEvent)
                    )
                })
            );


            console.log(
                "AlertService triggered"
            );
        }

        return {
            paymentStatus: paymentStatus,
            plateNumber: plateNumber,
            permitType: permitType
        };
    }

    catch (error)
    {
        console.log(
            "Error:",
            error
        );

        return {
            paymentStatus: "error",
            error: error.message
        };
    }
};