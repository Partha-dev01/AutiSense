//DYNAMODB_SESSIONS_TABLE    — e.g. "autisense-sessions"
//DYNAMODB_BIOMARKERS_TABLE  — e.g. "autisense-biomarkers"
//AWS_REGION                 — e.g. "ap-south-1"  (set automatically by Lambda)
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

//duplicated here so Lambda has no dependency on Next.js app

interface SessionSyncPayload {
  id: string;
  userId: string;
  ageMonths: number;
  language: string;
  gender: string;
  createdAt: number;
  completedAt: number | null;
  status: string;
  synced: boolean;
}

interface BiomarkerAggregate {
  sessionId: string;
  avgGazeScore: number;
  avgMotorScore: number;
  avgVocalizationScore: number;
  avgResponseLatencyMs: number | null;
  sampleCount: number;
  overallScore: number;
  flags: {
    socialCommunication: boolean;
    restrictedBehavior: boolean;
  };
}

interface SyncPayload {
  session: SessionSyncPayload;
  biomarkers: BiomarkerAggregate | null;
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.DYNAMODB_SESSIONS_TABLE!;
const BIOMARKERS_TABLE = process.env.DYNAMODB_BIOMARKERS_TABLE!;

const TTL_1_YEAR = () => Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  // Parse body
  let payload: SyncPayload;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf-8")
      : (event.body ?? "{}");
    payload = JSON.parse(raw);
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  // Validate
  if (!payload?.session?.id || !payload?.session?.userId) {
    return respond(400, {
      error: "Missing required fields: session.id, session.userId",
    });
  }

  const { session, biomarkers } = payload;

  // Hard guard — childName must never reach this function
  if ("childName" in session) {
    console.error("[Lambda sync] childName present in payload — rejecting");
    return respond(400, { error: "PII field detected in payload" });
  }

  // Write session
  try {
    await docClient.send(
      new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: { ...session, ttl: TTL_1_YEAR() },
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
    console.log(`[Lambda sync] Session written: ${session.id}`);
  } catch (err: unknown) {
    if (isConditionalCheckFailed(err)) {
      // Already exists — idempotent success
      console.log(
        `[Lambda sync] Session ${session.id} already exists — skipping`,
      );
    } else {
      console.error("[Lambda sync] Failed to write session:", err);
      return respond(500, { error: "Failed to write session to DynamoDB" });
    }
  }

  // Write biomarkers aggregate
  if (biomarkers) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: BIOMARKERS_TABLE,
          Item: {
            ...biomarkers,
            userId: session.userId,
            createdAt: session.createdAt,
            ttl: TTL_1_YEAR(),
          },
        }),
      );
      console.log(
        `[Lambda sync] Biomarkers written for session: ${session.id}`,
      );
    } catch (err) {
      // Non-fatal — log and continue
      console.error("[Lambda sync] Failed to write biomarkers:", err);
    }
  }

  return respond(200, { ok: true, sessionId: session.id });
};

//Helpers

function respond(statusCode: number, body: object): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "ConditionalCheckFailedException"
  );
}
