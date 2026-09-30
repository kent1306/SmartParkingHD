import boto3
import json
import time
from datetime import datetime


# ------------------------------------------------
# Configuration
# ------------------------------------------------

REGION = "us-east-1"

QUEUE_NAME = "SmartParkingPaymentQueue"

TOTAL_MESSAGES = 200


# ------------------------------------------------
# AWS SQS client
# ------------------------------------------------

sqs = boto3.client(
    "sqs",
    region_name=REGION
)


queue_url = sqs.get_queue_url(
    QueueName=QUEUE_NAME
)["QueueUrl"]


# Unique ID for this test run
run_id = (
    "HD-BACKLOG-" +
    datetime.now().strftime("%Y%m%d%H%M%S")
)


print("=" * 60)
print("SQS Backlog and Recovery Test")
print("=" * 60)

print("Queue:", QUEUE_NAME)
print("Messages:", TOTAL_MESSAGES)
print("Run ID:", run_id)
print()


# ------------------------------------------------
# Send burst using batches of 10 messages
# ------------------------------------------------

print("Sending burst...")


send_start = time.time()


for batch_start in range(
    0,
    TOTAL_MESSAGES,
    10
):
    entries = []


    for i in range(
        batch_start,
        min(
            batch_start + 10,
            TOTAL_MESSAGES
        )
    ):
        slot_id = (
            f"{run_id}-{i + 1:03d}"
        )


        # Same payment event structure normally
        # produced by ParkingService
        payment_event = {
            "parkingID":
                "PARK-A",

            "slotID":
                slot_id,

            "plateNumber":
                "ABC123"
        }


        entries.append({
            "Id":
                str(i),

            "MessageBody":
                json.dumps(
                    payment_event
                )
        })


    response = sqs.send_message_batch(
        QueueUrl=queue_url,
        Entries=entries
    )


    failed = response.get(
        "Failed",
        []
    )


    if failed:
        print(
            "Failed batch messages:",
            failed
        )


send_end = time.time()


send_duration = (
    send_end -
    send_start
)


print(
    f"{TOTAL_MESSAGES} messages submitted in "
    f"{send_duration:.2f} seconds"
)


# ------------------------------------------------
# Monitor queue backlog and recovery
# ------------------------------------------------

print()
print("Monitoring queue...")
print()


peak_visible = 0
peak_not_visible = 0

samples = []

recovery_start = send_end


while True:

    response = sqs.get_queue_attributes(
        QueueUrl=queue_url,

        AttributeNames=[
            "ApproximateNumberOfMessages",
            "ApproximateNumberOfMessagesNotVisible",
            "ApproximateNumberOfMessagesDelayed"
        ]
    )


    attributes = response[
        "Attributes"
    ]


    # Messages waiting in the queue
    visible = int(
        attributes.get(
            "ApproximateNumberOfMessages",
            0
        )
    )


    # Messages currently being processed
    not_visible = int(
        attributes.get(
            "ApproximateNumberOfMessagesNotVisible",
            0
        )
    )


    delayed = int(
        attributes.get(
            "ApproximateNumberOfMessagesDelayed",
            0
        )
    )


    peak_visible = max(
        peak_visible,
        visible
    )


    peak_not_visible = max(
        peak_not_visible,
        not_visible
    )


    elapsed = (
        time.time() -
        recovery_start
    )


    samples.append({
        "time":
            elapsed,

        "visible":
            visible,

        "not_visible":
            not_visible
    })


    print(
        f"{elapsed:6.1f}s | "
        f"visible={visible:3d} | "
        f"in-flight={not_visible:3d} | "
        f"delayed={delayed:3d}"
    )


    # Queue has completely recovered
    if (
        visible == 0 and
        not_visible == 0 and
        elapsed >= 2
    ):
        break


    # Safety timeout
    if elapsed >= 120:
        print(
            "Stopped after 120 seconds."
        )

        break


    time.sleep(1)


recovery_end = time.time()


recovery_time = (
    recovery_end -
    recovery_start
)


# ------------------------------------------------
# Final summary
# ------------------------------------------------

print()
print("=" * 60)
print("Backlog Test Summary")
print("=" * 60)


print(
    "Messages submitted:",
    TOTAL_MESSAGES
)


print(
    "Burst submission time:",
    f"{send_duration:.2f} seconds"
)


print(
    "Peak visible backlog:",
    peak_visible
)


print(
    "Peak in-flight messages:",
    peak_not_visible
)


print(
    "Queue recovery time:",
    f"{recovery_time:.2f} seconds"
)


print(
    "Final visible messages:",
    visible
)


print(
    "Final in-flight messages:",
    not_visible
)


if (
    visible == 0 and
    not_visible == 0
):
    print(
        "\nQUEUE RECOVERY TEST PASSED"
    )

else:
    print(
        "\nQUEUE RECOVERY TEST INCOMPLETE"
    )