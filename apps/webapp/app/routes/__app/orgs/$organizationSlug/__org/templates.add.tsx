import { FolderIcon } from "@heroicons/react/24/solid";
import { Form, useTransition } from "@remix-run/react";
import type { ActionArgs, LoaderArgs } from "@remix-run/server-runtime";
import {
  redirect,
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from "remix-typedjson";
import { z } from "zod";
import { OctoKitty } from "~/components/GitHubLoginButton";
import { Container } from "~/components/layout/Container";
import { Panel } from "~/components/layout/Panel";
import { PanelWarning } from "~/components/layout/PanelWarning";
import { StepNumber } from "~/components/onboarding/StepNumber";
import { PrimaryButton, PrimaryLink } from "~/components/primitives/Buttons";
import { FormError } from "~/components/primitives/FormError";
import { Input } from "~/components/primitives/Input";
import { InputGroup } from "~/components/primitives/InputGroup";
import { Label } from "~/components/primitives/Label";
import { Select } from "~/components/primitives/Select";
import { Body } from "~/components/primitives/text/Body";
import { SubTitle } from "~/components/primitives/text/SubTitle";
import { Title } from "~/components/primitives/text/Title";
import { TemplateCard } from "~/components/templates/TemplateCard";
import { WorkflowStartPresenter } from "~/presenters/workflowStartPresenter.server";
import { requireUserId } from "~/services/session.server";
import { AddTemplateService } from "~/services/templates/addTemplate.server";
import { ConnectedToGithub, DeployBlankState } from "./templates/$templateId";

export async function loader({ params, request }: LoaderArgs) {
  const userId = await requireUserId(request);
  const { organizationSlug } = z
    .object({ organizationSlug: z.string() })
    .parse(params);

  const { templateId } = z
    .object({ templateId: z.string().optional() })
    .parse(Object.fromEntries(new URL(request.url).searchParams));

  const presenter = new WorkflowStartPresenter();

  return typedjson(
    await presenter.data({ organizationSlug, userId, templateId })
  );
}

export async function action({ params, request }: ActionArgs) {
  const userId = await requireUserId(request);
  const { organizationSlug } = z
    .object({ organizationSlug: z.string() })
    .parse(params);
  const payload = Object.fromEntries(await request.formData());

  const service = new AddTemplateService();

  const validation = service.validate(payload);

  if (!validation.success) {
    return typedjson(
      {
        type: "validationError" as const,
        errors: validation.error.issues,
      },
      { status: 422 }
    );
  }

  const result = await service.call({
    data: validation.data,
    organizationSlug,
    userId,
  });

  if (result.type === "error") {
    return typedjson(
      {
        type: "serviceError" as const,
        message: result.message,
      },
      { status: 422 }
    );
  }

  return redirect(`/orgs/${organizationSlug}/templates/${result.template.id}`);
}

export default function AddTemplatePage() {
  const { appAuthorizations, templates, template } =
    useTypedLoaderData<typeof loader>();

  const actionData = useTypedActionData<typeof action>();
  const transition = useTransition();

  const isSubmittingOrLoading =
    (transition.state === "submitting" &&
      transition.type === "actionSubmission") ||
    (transition.state === "loading" && transition.type === "actionRedirect");

  return (
    <Container>
      <div className="grid w-full grid-cols-3 gap-8">
        <Form method="post" className="col-span-2 max-w-4xl">
          <Title>You're almost done</Title>

          {!isSubmittingOrLoading && actionData?.type === "serviceError" ? (
            <PanelWarning
              message={actionData.message}
              className="mb-4"
            ></PanelWarning>
          ) : !isSubmittingOrLoading &&
            actionData?.type === "validationError" ? (
            <PanelWarning
              message="There was a problem with your submission."
              className="mb-4"
            ></PanelWarning>
          ) : (
            <></>
          )}

          {appAuthorizations.length === 0 ? (
            <>
              <ConnectToGithub templateId={template?.id} />
              <ConfigureGithub />
            </>
          ) : (
            <>
              <ConnectedToGithub templateId={template?.id} />
              <SubTitle className="flex items-center">
                <StepNumber active stepNumber="2" />
                Where should we create the new repository?
              </SubTitle>
              <Panel className="!p-4">
                <div className="mb-3 grid grid-cols-2 gap-4">
                  <InputGroup>
                    <Label htmlFor="appAuthorizationId">
                      Select a GitHub account
                    </Label>
                    <Select
                      disabled={isSubmittingOrLoading}
                      name="appAuthorizationId"
                      required
                    >
                      {appAuthorizations.map((appAuthorization) => (
                        <option
                          value={appAuthorization.id}
                          key={appAuthorization.id}
                        >
                          {appAuthorization.accountName}
                        </option>
                      ))}
                    </Select>

                    {!isSubmittingOrLoading &&
                      actionData?.type === "validationError" && (
                        <FormError
                          errors={actionData.errors}
                          path={["appAuthorizationId"]}
                        />
                      )}
                  </InputGroup>

                  {template ? (
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
                  ) : (
                    <InputGroup>
                      <Label htmlFor="templateId">Choose a template</Label>

                      <Select
                        disabled={isSubmittingOrLoading}
                        name="templateId"
                        required
                      >
                        {templates.map((template) => (
                          <option value={template.id} key={template.id}>
                            {template.title}
                          </option>
                        ))}
                      </Select>

                      {!isSubmittingOrLoading &&
                        actionData?.type === "validationError" && (
                          <FormError
                            errors={actionData.errors}
                            path={["templateId"]}
                          />
                        )}
                    </InputGroup>
                  )}

                  <InputGroup>
                    <Label htmlFor="name">
                      Enter a repository name (required)
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder={`e.g. ${
                        template
                          ? `trigger.dev-${template.slug}`
                          : `my-trigger.dev-workflows`
                      }`}
                      spellCheck={false}
                      className=""
                      disabled={isSubmittingOrLoading}
                    />

                    {!isSubmittingOrLoading &&
                      actionData?.type === "validationError" && (
                        <FormError errors={actionData.errors} path={["name"]} />
                      )}
                  </InputGroup>
                  <div>
                    <p className="mb-1 text-sm text-slate-500">
                      Set the repo as public
                    </p>
                    <Label
                      htmlFor="publicRepo"
                      className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
                    >
                      <div className="flex w-full items-center gap-2 rounded bg-black/20 px-3 py-2.5">
                        <input
                          type="checkbox"
                          name="publicRepo"
                          id="publicRepo"
                          className="border-3 h-4 w-4 cursor-pointer rounded border-black bg-slate-500 transition hover:bg-slate-300 focus:outline-none"
                          disabled={isSubmittingOrLoading}
                        />
                        Public repo
                      </div>
                    </Label>
                  </div>
                </div>
                <div className="flex justify-end">
                  {isSubmittingOrLoading ? (
                    <PrimaryButton disabled>Creating repo...</PrimaryButton>
                  ) : (
                    <PrimaryButton type="submit">Create Repo</PrimaryButton>
                  )}
                </div>
              </Panel>
            </>
          )}

          <DeployBlankState />
        </Form>
        <div className="w-full">
          {template && (
            <TemplateCard
              template={template}
              className="sticky top-0 mt-[60px] w-[300px] justify-self-start"
            />
          )}
        </div>
      </div>
    </Container>
  );
}

function ConnectToGithub({ templateId }: { templateId?: string }) {
  return (
    <>
      <SubTitle className="flex items-center">
        <StepNumber active stepNumber="1" />
        Grant GitHub repo access to get started
      </SubTitle>
      <Panel className="mb-6 flex h-56 flex-col items-center justify-center gap-4">
        <PrimaryLink
          size="large"
          to={`../apps/github${templateId ? `?templateId=${templateId}` : ``}`}
        >
          <OctoKitty className="mr-1 h-5 w-5" />
          Grant access
        </PrimaryLink>
        <Body size="extra-small" className="flex items-center text-slate-400">
          To create a new repository from a template, we need GitHub access.{" "}
          <a
            href="https://docs.trigger.dev/faq#why-do-we-ask-for-github-access"
            target="_blank"
            rel="noreferrer"
            className="ml-1 underline decoration-slate-500 underline-offset-2 transition hover:cursor-pointer hover:text-slate-300"
          >
            Learn more.
          </a>
        </Body>
      </Panel>
    </>
  );
}

function ConfigureGithub() {
  return (
    <>
      <div className="mt-6">
        <SubTitle className="flex items-center">
          <StepNumber stepNumber="2" />
          Create your GitHub repository from a template
        </SubTitle>
        <Panel className="flex h-56 w-full max-w-4xl items-center justify-center gap-6">
          <OctoKitty className="h-10 w-10 text-slate-600" />
          <div className="h-[1px] w-16 border border-dashed border-slate-600"></div>
          <FolderIcon className="h-10 w-10 text-slate-600" />
        </Panel>
      </div>
    </>
  );
}
