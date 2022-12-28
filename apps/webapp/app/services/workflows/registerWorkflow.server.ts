import { github } from "internal-integrations";
import type { WorkflowMetadata } from "internal-platform";
import { WorkflowMetadataSchema } from "internal-platform";
import type { PrismaClient } from "~/db.server";
import { prisma } from "~/db.server";
import type { Organization } from "~/models/organization.server";
import type { RuntimeEnvironment } from "~/models/runtimeEnvironment.server";
import type { Workflow } from "~/models/workflow.server";
import { internalPubSub } from "../messageBroker.server";

export class RegisterWorkflow {
  #prismaClient: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.#prismaClient = prismaClient;
  }

  public async call(
    slug: string,
    payload: unknown,
    organization: Organization,
    environment: RuntimeEnvironment
  ) {
    const validation = WorkflowMetadataSchema.safeParse(payload);

    if (!validation.success) {
      return {
        status: "validationError" as const,
        errors: validation.error.format(),
      };
    }

    const workflow = await this.#upsertWorkflow(
      slug,
      validation.data,
      organization
    );

    if (validation.data.trigger.service !== "trigger") {
      const externalSource = await this.#upsertExternalSource(
        validation.data,
        organization
      );

      if (externalSource) {
        await this.#prismaClient.workflow.update({
          where: {
            id: workflow.id,
          },
          data: {
            externalSourceId: externalSource.id,
          },
        });
      }
    }

    await this.#upsertEventRule(
      workflow,
      validation.data,
      organization,
      environment
    );

    return {
      status: "success" as const,
      data: { id: workflow.id },
    };
  }

  async #upsertEventRule(
    workflow: Workflow,
    payload: WorkflowMetadata,
    organization: Organization,
    environment: RuntimeEnvironment
  ) {
    return this.#prismaClient.eventRule.upsert({
      where: {
        workflowId_environmentId: {
          workflowId: workflow.id,
          environmentId: environment.id,
        },
      },
      update: {
        filter: payload.trigger.filter,
      },
      create: {
        workflowId: workflow.id,
        environmentId: environment.id,
        organizationId: organization.id,
        filter: payload.trigger.filter,
        type: payload.trigger.type,
        trigger: payload.trigger,
      },
    });
  }

  async #upsertWorkflow(
    slug: string,
    payload: WorkflowMetadata,
    organization: Organization
  ) {
    const workflow = await this.#prismaClient.workflow.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug,
        },
      },
      update: {
        title: payload.name,
        packageJson: payload.package,
        type: payload.trigger.type,
      },
      create: {
        organizationId: organization.id,
        slug,
        title: payload.name,
        packageJson: payload.package,
        type: payload.trigger.type,
        status: payload.trigger.service === "trigger" ? "READY" : "CREATED",
      },
      include: {
        externalSource: true,
      },
    });

    return workflow;
  }

  async #upsertExternalSource(
    payload: WorkflowMetadata,
    organization: Organization
  ) {
    switch (payload.trigger.type) {
      case "WEBHOOK": {
        if (!payload.trigger.source) {
          return;
        }

        const existingConnection =
          await this.#findLatestExistingConnectionInOrg(
            payload.trigger.service,
            organization
          );

        const externalSource = await this.#prismaClient.externalSource.upsert({
          where: {
            organizationId_key: {
              key: this.#keyForExternalSource(payload),
              organizationId: organization.id,
            },
          },
          update: {
            source: payload.trigger.source,
          },
          create: {
            organizationId: organization.id,
            key: this.#keyForExternalSource(payload),
            type: "WEBHOOK",
            source: payload.trigger.source,
            status: "CREATED",
            connectionId: existingConnection?.id,
            service: payload.trigger.service,
          },
        });

        if (!externalSource.connectionId && existingConnection) {
          await this.#prismaClient.externalSource.update({
            where: {
              id: externalSource.id,
            },
            data: {
              connectionId: existingConnection.id,
            },
          });
        }

        await internalPubSub.publish("EXTERNAL_SOURCE_UPSERTED", {
          id: externalSource.id,
        });

        return externalSource;
      }
      default: {
        return;
      }
    }
  }

  #keyForExternalSource(payload: WorkflowMetadata): string {
    if (payload.trigger.type === "WEBHOOK") {
      switch (payload.trigger.service) {
        case "github": {
          return github.webhooks.keyForSource(payload.trigger.source);
        }
        default: {
          return payload.trigger.service;
        }
      }
    } else {
      return payload.trigger.service;
    }
  }

  async #findLatestExistingConnectionInOrg(
    serviceIdentifier: string,
    organization: Organization
  ) {
    const connection = await this.#prismaClient.aPIConnection.findFirst({
      where: {
        organizationId: organization.id,
        apiIdentifier: serviceIdentifier,
        status: "CONNECTED",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return connection;
  }
}