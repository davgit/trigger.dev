import { Trigger } from "@trigger.dev/sdk";
import { github } from "@trigger.dev/integrations";

const trigger = new Trigger({
  id: "github-webhook-9",
  name: "GitHub Issue changes for jsonhero-web",
  apiKey: "trigger_dev_zC25mKNn6c0q",
  endpoint: "ws://localhost:8889/ws",
  logLevel: "debug",
  on: github.repoIssueEvent({ repo: "apihero-run/jsonhero-web" }),
  run: async (event, ctx) => {
    await ctx.logger.info(
      "Inside the github-webhook workflow, received event",
      {
        event,
      }
    );

    return event;
  },
});

trigger.listen();