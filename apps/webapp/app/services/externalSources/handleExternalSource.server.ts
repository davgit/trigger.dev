import { ManualWebhookSourceSchema } from "@trigger.dev/common-schemas";
import * as github from "@trigger.dev/github/internal";
import type { NormalizedRequest } from "@trigger.dev/integration-sdk";
import * as whatsapp from "@trigger.dev/whatsapp/internal";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ulid } from "ulid";
import type { PrismaClient } from "~/db.server";
import { prisma } from "~/db.server";
import type { ExternalSourceWithConnection } from "~/models/externalSource.server";
import { IngestEvent } from "../events/ingest.server";
import { createNormalizedRequest } from "./utils";

type IgnoredEventResponse = {
  status: "ignored";
  reason: string;
};

type ErrorEventResponse = {
  status: "error";
  error: string;
};

type TriggeredEventResponse = {
  status: "ok";
  data: {
    id: string;
    payload: any;
    event: string;
    timestamp?: string;
    context?: any;
  }[];
};

export type HandledExternalEventResponse =
  | TriggeredEventResponse
  | IgnoredEventResponse
  | ErrorEventResponse;

export class HandleExternalSource {
  #prismaClient: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.#prismaClient = prismaClient;
  }

  public async call(
    externalSource: NonNullable<ExternalSourceWithConnection>,
    serviceIdentifier: string,
    request: Request
  ) {
    const normalizedRequest = await createNormalizedRequest(request);
    const possibleEvent = await this.#handleExternalSource(
      externalSource,
      serviceIdentifier,
      normalizedRequest
    );

    switch (possibleEvent.status) {
      case "ok": {
        for (let index = 0; index < possibleEvent.data.length; index++) {
          const { id, payload, event, timestamp, context } =
            possibleEvent.data[index];

          const ingestService = new IngestEvent();

          await ingestService.call(
            {
              id,
              payload,
              name: event,
              type: externalSource.type,
              service: serviceIdentifier,
              timestamp,
              context,
            },
            externalSource.organization
          );
        }

        return true;
      }
      case "ignored": {
        console.log(`Ignored external event: ${possibleEvent.reason}`);
        return true;
      }
      case "error": {
        throw new Error(possibleEvent.error);
      }
    }
  }

  async #handleExternalSource(
    externalSource: NonNullable<ExternalSourceWithConnection>,
    serviceIdentifier: string,
    normalizedRequest: NormalizedRequest
  ): Promise<HandledExternalEventResponse> {
    switch (externalSource.type) {
      case "WEBHOOK": {
        return this.#handleWebhook(
          externalSource,
          serviceIdentifier,
          normalizedRequest
        );
      }
      default: {
        return {
          status: "error",
          error: `Could not handle external source with unsupported type: ${externalSource.type}`,
        };
      }
    }
  }

  async #handleWebhook(
    externalSource: NonNullable<ExternalSourceWithConnection>,
    serviceIdentifier: string,
    request: NormalizedRequest
  ): Promise<HandledExternalEventResponse> {
    switch (serviceIdentifier) {
      case "github": {
        return github.internalIntegration.webhooks!.handleWebhookRequest({
          request,
          secret: externalSource.secret ?? undefined,
        });
      }
      case "whatsapp": {
        return whatsapp.internalIntegration.webhooks!.handleWebhookRequest({
          request,
          secret: externalSource.secret ?? undefined,
        });
      }
    }

    if (externalSource.manualRegistration) {
      return this.#handleManualWebhook(
        externalSource,
        serviceIdentifier,
        request
      );
    }

    return {
      status: "ignored" as const,
      reason: `Could not handle external source with unsupported service: ${serviceIdentifier}`,
    };
  }

  async #handleManualWebhook(
    externalSource: NonNullable<ExternalSourceWithConnection>,
    serviceIdentifier: string,
    request: NormalizedRequest
  ): Promise<HandledExternalEventResponse> {
    const source = ManualWebhookSourceSchema.parse(externalSource.source);

    if (source.verifyPayload.enabled && source.verifyPayload.header) {
      const hmac = createHmac("sha256", externalSource.secret!);
      const digest = Buffer.from(
        hmac.update(request.rawBody).digest("hex"),
        "utf8"
      );

      const providerSigString =
        request.headers[source.verifyPayload.header.toLowerCase()] || "";

      const providerSig = Buffer.from(providerSigString, "utf8");

      if (
        digest.length !== providerSig.length ||
        !timingSafeEqual(digest, providerSig)
      ) {
        return {
          status: "error",
          error: "Payload signature did not match",
        };
      }
    }

    return {
      status: "ok",
      data: [
        {
          id: ulid(),
          payload: request.body,
          event: source.event,
          context: {
            headers: request.headers,
            externalSourceId: externalSource.id,
          },
        },
      ],
    };
  }
}
