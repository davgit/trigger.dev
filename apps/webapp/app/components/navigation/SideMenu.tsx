import {
  SquaresPlusIcon,
  ArrowsRightLeftIcon,
  UsersIcon,
  ForwardIcon,
} from "@heroicons/react/24/outline";
import { Link, NavLink } from "@remix-run/react";
import {
  useCurrentOrganization,
  useOrganizations,
} from "~/hooks/useOrganizations";
import { useCurrentWorkflow, useWorkflows } from "~/hooks/useWorkflows";
import { Header1 } from "../primitives/text/Headers";

export function SideMenuContainer({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[300px_2fr] h-full">{children}</div>;
}

type SideMenuItem = {
  name: string;
  icon: React.ReactNode;
  to: string;
};

const iconStyle = "h-6 w-6";

export function OrganizationsSideMenu() {
  const organizations = useOrganizations();
  const currentOrganization = useCurrentOrganization();

  if (organizations === undefined || currentOrganization === undefined) {
    return null;
  }

  const items: SideMenuItem[] = [
    {
      name: "Workflows",
      icon: <ArrowsRightLeftIcon className={iconStyle} />,
      to: `/orgs/${currentOrganization.slug}`,
    },
    {
      name: "API Integrations",
      icon: <SquaresPlusIcon className={iconStyle} />,
      to: `/orgs/${currentOrganization.slug}/integrations`,
    },
    {
      name: "Members",
      icon: <UsersIcon className={iconStyle} />,
      to: `/orgs/${currentOrganization.slug}/members`,
    },
  ];

  return <SideMenu title={currentOrganization.title} items={items} />;
}

export function WorkflowsSideMenu() {
  const currentWorkflow = useCurrentWorkflow();

  if (currentWorkflow === undefined) {
    return null;
  }

  const items: SideMenuItem[] = [
    {
      name: "Overview",
      icon: <ArrowsRightLeftIcon className={iconStyle} />,
      to: ``,
    },
    {
      name: "Runs",
      icon: <ForwardIcon className={iconStyle} />,
      to: `runs`,
    },
    {
      name: "API integrations",
      icon: <SquaresPlusIcon className={iconStyle} />,
      to: `integrations`,
    },
  ];

  return <SideMenu title={currentWorkflow.title} items={items} />;
}

const defaultStyle =
  "group flex items-center gap-2 px-3 py-3 text-base rounded transition text-slate-300 hover:bg-slate-900 hover:text-white";
const activeStyle =
  "group flex items-center gap-2 px-3 py-3 text-base rounded transition bg-slate-800 text-white";

function SideMenu({ title, items }: { title: string; items: SideMenuItem[] }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-1000 border-r border-slate-800">
      <div className="flex flex-1 flex-col overflow-y-auto pb-4">
        <nav
          className="mt-2 flex-1 space-y-1 bg-slate-1000 px-2"
          aria-label="Sidebar"
        >
          <Header1 size="regular" className="p-2 my-2">
            <Link to="">{title}</Link>
          </Header1>

          {items.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end
              className={({ isActive }) =>
                isActive ? activeStyle : defaultStyle
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}