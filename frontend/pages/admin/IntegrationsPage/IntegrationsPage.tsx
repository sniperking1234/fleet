import { AppContext } from "context/app";
import React, { useContext } from "react";
import { InjectedRouter, Params } from "react-router/lib/Router";

import SideNav from "../components/SideNav";
import getFilteredIntegrationSettingsNavItems from "./IntegrationNavItems";

const baseClass = "integrations";

interface IIntegrationSettingsPageProps {
  router: InjectedRouter;
  params: Params;
}

const IntegrationsPage = ({
  router,
  params,
}: IIntegrationSettingsPageProps) => {
  const { isSandboxMode } = useContext(AppContext);
  const { section } = params;
  const navItems = getFilteredIntegrationSettingsNavItems(isSandboxMode);
  const DEFAULT_SETTINGS_SECTION = navItems[0];
  const currentSection =
    navItems.find((item) => item.urlSection === section) ??
    DEFAULT_SETTINGS_SECTION;

  const CurrentCard = currentSection.Card;

  return (
    <div className={`${baseClass}`}>
      <p className={`${baseClass}__page-description`}>
        Add ticket destinations and turn on mobile device management features.
      </p>
      <SideNav
        className={`${baseClass}__side-nav`}
        navItems={navItems}
        activeItem={currentSection.urlSection}
        CurrentCard={<CurrentCard router={router} />}
      />
    </div>
  );
};

export default IntegrationsPage;
