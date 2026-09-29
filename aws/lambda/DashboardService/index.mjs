import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    QueryCommand
} from "@aws-sdk/lib-dynamodb";


const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);


const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
};

export const handler = async (event) =>
{
    try
    {
        console.log("Dashboard request:");
        console.log(event);

        const path =
            event.path ||
            event.resource ||
            "";


        if (path.includes("parking-spaces"))
        {
            const result = await dynamoDB.send(
                new QueryCommand({
                    TableName: "ParkingSpaces",

                    KeyConditionExpression:
                        "parkingID = :parkingID",

                    ExpressionAttributeValues: {
                        ":parkingID": "PARK-A"
                    }
                })
            );


            return {
                statusCode: 200,

                headers: corsHeaders,

                body: JSON.stringify({
                    type: "parkingSpaces",
                    count: result.Items.length,
                    data: result.Items
                })
            };
        }

        if (path.includes("alerts"))
        {
            const result = await dynamoDB.send(
                new QueryCommand({
                    TableName: "Alerts",

                    KeyConditionExpression:
                        "parkingID = :parkingID",

                    ExpressionAttributeValues: {
                        ":parkingID": "PARK-A"
                    }
                })
            );

            return {
                statusCode: 200,

                headers: corsHeaders,

                body: JSON.stringify({
                    type: "alerts",
                    count: result.Items.length,
                    data: result.Items
                })
            };
        }

        return {
            statusCode: 404,

            headers: corsHeaders,

            body: JSON.stringify({
                message:
                    "Dashboard resource not found"
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

            headers: corsHeaders,

            body: JSON.stringify({
                message:
                    "Failed to load dashboard data",

                error:
                    error.message
            })
        };
    }
};