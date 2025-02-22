import React, { useContext, useState } from "react";
import { AxiosResponse } from "axios";
import { Location } from "history";
import { useQuery } from "react-query";
import { InjectedRouter } from "react-router";
import { useErrorHandler } from "react-error-boundary";

import PATHS from "router/paths";
import { buildQueryStringFromParams } from "utilities/url";
import { DEFAULT_USE_QUERY_OPTIONS } from "utilities/constants";
import softwareAPI from "services/entities/software";
import teamPoliciesAPI from "services/entities/team_policies";
import labelsAPI, { getCustomLabels } from "services/entities/labels";
import { QueryContext } from "context/query";
import { AppContext } from "context/app";
import { NotificationContext } from "context/notification";
import { Platform, PLATFORM_DISPLAY_NAMES } from "interfaces/platform";
import { ILabelSummary } from "interfaces/label";
import useToggleSidePanel from "hooks/useToggleSidePanel";

import BackLink from "components/BackLink";
import MainContent from "components/MainContent";
import Spinner from "components/Spinner";
import DataError from "components/DataError";
import SidePanelContent from "components/SidePanelContent";
import QuerySidePanel from "components/side_panels/QuerySidePanel";
import PremiumFeatureMessage from "components/PremiumFeatureMessage";
import Card from "components/Card";
import SoftwareIcon from "pages/SoftwarePage/components/icons/SoftwareIcon";
import Button from "components/buttons/Button";
import Icon from "components/Icon";
import FleetAppDetailsForm from "./FleetAppDetailsForm";
import { IFleetMaintainedAppFormData } from "./FleetAppDetailsForm/FleetAppDetailsForm";

import AddFleetAppSoftwareModal from "./AddFleetAppSoftwareModal";
import FleetAppDetailsModal from "./FleetAppDetailsModal";

import {
  getErrorMessage,
  getFleetAppPolicyDescription,
  getFleetAppPolicyName,
  getFleetAppPolicyQuery,
} from "./helpers";

const DEFAULT_ERROR_MESSAGE = "Couldn't add. Please try again.";
const REQUEST_TIMEOUT_ERROR_MESSAGE =
  "Couldn't upload. Request timeout. Please make sure your server and load balancer timeout is long enough.";
const AUTOMATIC_POLICY_ERROR_MESSAGE =
  "Couldn't add automatic install policy. Software is successfully added. To retry, delete software and add it again.";

const baseClass = "fleet-maintained-app-details-page";

interface IFleetAppSummaryProps {
  name: string;
  platform: string;
  version: string;
  onClickShowAppDetails: (event: MouseEvent) => void;
}

const FleetAppSummary = ({
  name,
  platform,
  version,
  onClickShowAppDetails,
}: IFleetAppSummaryProps) => {
  return (
    <Card
      className={`${baseClass}__fleet-app-summary`}
      borderRadiusSize="medium"
      color="grey"
    >
      <div className={`${baseClass}__fleet-app-summary--left`}>
        <SoftwareIcon name={name} size="medium" />
        <div className={`${baseClass}__fleet-app-summary--details`}>
          <div className={`${baseClass}__fleet-app-summary--title`}>{name}</div>
          <div className={`${baseClass}__fleet-app-summary--info`}>
            <div
              className={`${baseClass}__fleet-app-summary--details--platform`}
            >
              {PLATFORM_DISPLAY_NAMES[platform as Platform]}
            </div>
            &bull;
            <div
              className={`${baseClass}__fleet-app-summary--details--version`}
            >
              {version}
            </div>
          </div>
        </div>
      </div>
      <div className={`${baseClass}__fleet-app-summary--show-details`}>
        <Button variant="text-icon" onClick={onClickShowAppDetails}>
          <Icon name="info" /> Show details
        </Button>
      </div>
    </Card>
  );
};

export interface IFleetMaintainedAppDetailsQueryParams {
  team_id?: string;
}

interface IFleetMaintainedAppDetailsRouteParams {
  id: string;
}

interface IFleetMaintainedAppDetailsPageProps {
  location: Location<IFleetMaintainedAppDetailsQueryParams>;
  router: InjectedRouter;
  routeParams: IFleetMaintainedAppDetailsRouteParams;
}

/** This type includes the editable form data as well as the fleet maintained
 * app id */
export type IAddFleetMaintainedData = IFleetMaintainedAppFormData & {
  appId: number;
};

const FleetMaintainedAppDetailsPage = ({
  location,
  router,
  routeParams,
}: IFleetMaintainedAppDetailsPageProps) => {
  const teamId = location.query.team_id;
  const appId = parseInt(routeParams.id, 10);
  if (isNaN(appId)) {
    router.push(PATHS.SOFTWARE_ADD_FLEET_MAINTAINED);
  }

  const { renderFlash } = useContext(NotificationContext);
  const handlePageError = useErrorHandler();
  const { isPremiumTier } = useContext(AppContext);
  const { selectedOsqueryTable, setSelectedOsqueryTable } = useContext(
    QueryContext
  );
  const { isSidePanelOpen, setSidePanelOpen } = useToggleSidePanel(false);
  const [
    showAddFleetAppSoftwareModal,
    setShowAddFleetAppSoftwareModal,
  ] = useState(false);
  const [showAppDetailsModal, setShowAppDetailsModal] = useState(false);

  const {
    data: fleetApp,
    isLoading: isLoadingFleetApp,
    isError: isErrorFleetApp,
  } = useQuery(
    ["fleet-maintained-app", appId],
    () => softwareAPI.getFleetMaintainedApp(appId),
    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      enabled: isPremiumTier,
      retry: false,
      select: (res) => res.fleet_maintained_app,
      onError: (error) => handlePageError(error),
    }
  );

  const {
    data: labels,
    isLoading: isLoadingLabels,
    isError: isErrorLabels,
  } = useQuery<ILabelSummary[], Error>(
    ["custom_labels"],
    () => labelsAPI.summary().then((res) => getCustomLabels(res.labels)),

    {
      ...DEFAULT_USE_QUERY_OPTIONS,
      enabled: isPremiumTier,
      staleTime: 10000,
    }
  );

  const onOsqueryTableSelect = (tableName: string) => {
    setSelectedOsqueryTable(tableName);
  };

  const onClickShowAppDetails = () => {
    setShowAppDetailsModal(true);
  };

  const backToAddSoftwareUrl = `${
    PATHS.SOFTWARE_ADD_FLEET_MAINTAINED
  }?${buildQueryStringFromParams({ team_id: teamId })}`;

  const onCancel = () => {
    router.push(backToAddSoftwareUrl);
  };

  const onSubmit = async (formData: IFleetMaintainedAppFormData) => {
    // this should not happen but we need to handle the type correctly
    if (!teamId) return;

    setShowAddFleetAppSoftwareModal(true);

    const { installType } = formData;
    let titleId: number | undefined;
    try {
      const res = await softwareAPI.addFleetMaintainedApp(
        parseInt(teamId, 10),
        {
          ...formData,
          appId,
        }
      );
      titleId = res.software_title_id;

      // for manual install we redirect only on a successful software add.
      if (installType === "manual") {
        router.push(
          `${PATHS.SOFTWARE_TITLES}?${buildQueryStringFromParams({
            team_id: teamId,
            available_for_install: true,
          })}`
        );
        renderFlash(
          "success",
          <>
            <b>{fleetApp?.name}</b> successfully added.
          </>
        );
      }
    } catch (error) {
      // quick exit if there was an error adding the software. Skip the policy
      // creation.

      const ae = (typeof error === "object" ? error : {}) as AxiosResponse;

      const errorMessage = getErrorMessage(ae);

      if (
        ae.status === 408 ||
        errorMessage.includes("json decoder error") // 400 bad request when really slow
      ) {
        renderFlash("error", REQUEST_TIMEOUT_ERROR_MESSAGE);
      } else if (errorMessage) {
        renderFlash("error", errorMessage);
      } else {
        renderFlash("error", DEFAULT_ERROR_MESSAGE);
      }

      setShowAddFleetAppSoftwareModal(false);
      return;
    }

    // If the install type is automatic we now need to create the new policy.
    if (installType === "automatic" && fleetApp) {
      try {
        await teamPoliciesAPI.create({
          name: getFleetAppPolicyName(fleetApp.name),
          description: getFleetAppPolicyDescription(fleetApp.name),
          query: getFleetAppPolicyQuery(fleetApp.name),
          team_id: parseInt(teamId, 10),
          software_title_id: titleId,
          platform: "darwin",
        });

        renderFlash(
          "success",
          <>
            <b>{fleetApp?.name}</b> successfully added.
          </>,
          { persistOnPageChange: true }
        );
      } catch (e) {
        renderFlash("error", AUTOMATIC_POLICY_ERROR_MESSAGE, {
          persistOnPageChange: true,
        });
      }

      // for automatic install we redirect on both a successful and error policy
      // add because the software was already successfuly added.
      router.push(
        `${PATHS.SOFTWARE_TITLES}?${buildQueryStringFromParams({
          team_id: teamId,
          available_for_install: true,
        })}`
      );
    }

    setShowAddFleetAppSoftwareModal(false);
  };

  const renderContent = () => {
    if (!isPremiumTier) {
      return <PremiumFeatureMessage />;
    }

    if (isLoadingFleetApp || isLoadingLabels) {
      return <Spinner />;
    }

    if (isErrorFleetApp || isErrorLabels) {
      return <DataError className={`${baseClass}__data-error`} />;
    }

    if (fleetApp) {
      return (
        <>
          <BackLink
            text="Back to add software"
            path={backToAddSoftwareUrl}
            className={`${baseClass}__back-to-add-software`}
          />
          <h1>{fleetApp.name}</h1>
          <div className={`${baseClass}__page-content`}>
            <FleetAppSummary
              name={fleetApp.name}
              platform={fleetApp.platform}
              version={fleetApp.version}
              onClickShowAppDetails={onClickShowAppDetails}
            />
            <FleetAppDetailsForm
              labels={labels || []}
              name={fleetApp.name}
              showSchemaButton={!isSidePanelOpen}
              defaultInstallScript={fleetApp.install_script}
              defaultPostInstallScript={fleetApp.post_install_script}
              defaultUninstallScript={fleetApp.uninstall_script}
              onClickShowSchema={() => setSidePanelOpen(true)}
              onCancel={onCancel}
              onSubmit={onSubmit}
            />
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <>
      <MainContent className={baseClass}>
        <>{renderContent()}</>
      </MainContent>
      {isPremiumTier && fleetApp && isSidePanelOpen && (
        <SidePanelContent className={`${baseClass}__side-panel`}>
          <QuerySidePanel
            key="query-side-panel"
            onOsqueryTableSelect={onOsqueryTableSelect}
            selectedOsqueryTable={selectedOsqueryTable}
            onClose={() => setSidePanelOpen(false)}
          />
        </SidePanelContent>
      )}
      {showAddFleetAppSoftwareModal && <AddFleetAppSoftwareModal />}
      {showAppDetailsModal && fleetApp && (
        <FleetAppDetailsModal
          name={fleetApp.name}
          platform={fleetApp.platform}
          version={fleetApp.version}
          url={fleetApp.url}
          onCancel={() => setShowAppDetailsModal(false)}
        />
      )}
    </>
  );
};

export default FleetMaintainedAppDetailsPage;
