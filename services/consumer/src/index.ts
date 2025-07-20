import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import type { S3Event } from "aws-lambda";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import dotenv from "dotenv";

dotenv.config();

const client = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ecsclient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function init() {
  const command = new ReceiveMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL!,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20,
  });

  while (true) {
    const { Messages } = await client.send(command);
    if (!Messages) {
      console.log(`No Message in Queue`);
      continue;
    }

    try {
      for (const message of Messages) {
        const { MessageId, Body } = message;
        console.log(`Message Recieved`, { MessageId, Body });

        if (!Body) continue;

        //Validate and Parse the event
        const event = JSON.parse(Body) as S3Event;
        console.log(event);

        //Ignore the test event
        if ("Service" in event && "Event" in event) {
          if (event.Event === "s3:TestEvent") {
            const deleteCommand = new DeleteMessageCommand({
              QueueUrl: process.env.SQS_QUEUE_URL!,
              ReceiptHandle: message.ReceiptHandle,
            });
            await client.send(deleteCommand);
            continue;
          }
        }

        //Spin the docker container
        for (const record of event.Records) {
          console.log(record.s3.object.key);
          const { s3 } = record;
          const {
            bucket,
            object: { key },
          } = s3;
          const runTaskCommand = new RunTaskCommand({
            taskDefinition: process.env.ECS_TASK_DEFINITION!,
            cluster: process.env.ECS_CLUSTER_ARN!,
            launchType: "FARGATE",
            networkConfiguration: {
              awsvpcConfiguration: {
                subnets: process.env.ECS_SUBNETS!.split(","),
                securityGroups: [process.env.ECS_SECURITY_GROUP!],
                assignPublicIp: "ENABLED",
              },
            },
            overrides: {
              containerOverrides: [
                {
                  name: process.env.ECS_CONTAINER_NAME!,
                  environment: [
                    { name: "BUCKET_NAME", value: bucket.name },
                    { name: "KEY", value: key },
                    {
                      name: "AWS_ACCESS_KEY_ID",
                      value: process.env.AWS_ACCESS_KEY_ID,
                    },
                    {
                      name: "AWS_SECRET_ACCESS_KEY",
                      value: process.env.AWS_SECRET_ACCESS_KEY,
                    },
                    {
                      name: "OUTPUT_BUCKET_NAME",
                      value: process.env.OUTPUT_BUCKET_NAME,
                    },
                  ],
                },
              ],
            },
          });
          await ecsclient.send(runTaskCommand);

          //Delete the message from queue
          const deleteCommand = new DeleteMessageCommand({
            QueueUrl: process.env.SQS_QUEUE_URL!,
            ReceiptHandle: message.ReceiptHandle,
          });
          await client.send(deleteCommand);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}

init();
