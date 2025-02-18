import { LoaderArgs, redirect } from "@remix-run/server-runtime";
import { z } from "zod";
import { StartAppInstallation } from "~/services/github/startAppInstallation.server";
import { requireUserId } from "~/services/session.server";

const ParamsSchema = z.object({
  organizationSlug: z.string(),
});

export async function loader({ request, params }: LoaderArgs) {
  const userId = await requireUserId(request);
  const { organizationSlug } = ParamsSchema.parse(params);

  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  const service = new StartAppInstallation();

  const redirectTo = await service.call({
    userId,
    organizationSlug,
    templateId: queryParams.templateId,
  });

  return redirect(redirectTo ?? `/orgs/${organizationSlug}`);
}
