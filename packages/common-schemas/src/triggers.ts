import { z } from "zod";
import { EventFilterSchema } from "./events";
import { JsonSchema } from "./json";

export const CustomEventTriggerSchema = z.object({
  type: z.literal("CUSTOM_EVENT"),
  service: z.literal("trigger"),
  name: z.string(),
  filter: EventFilterSchema,
});

export const WebhookEventTriggerSchema = z.object({
  type: z.literal("WEBHOOK"),
  service: z.string(),
  name: z.string(),
  filter: EventFilterSchema,
  source: JsonSchema,
});

export const HttpEventTriggerSchema = z.object({
  type: z.literal("HTTP_ENDPOINT"),
  service: z.literal("trigger"),
  name: z.string(),
  filter: EventFilterSchema,
});

export const ScheduledEventTriggerSchema = z.object({
  type: z.literal("SCHEDULE"),
  service: z.literal("trigger"),
  name: z.string(),
  filter: EventFilterSchema,
});

export const TriggerMetadataSchema = z.discriminatedUnion("type", [
  CustomEventTriggerSchema,
  WebhookEventTriggerSchema,
  HttpEventTriggerSchema,
  ScheduledEventTriggerSchema,
]);
