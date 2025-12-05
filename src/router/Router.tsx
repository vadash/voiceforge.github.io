import type { FunctionalComponent, ComponentChildren } from 'preact';
import { isConvertRoute, isSettingsRoute, isLogsRoute, isAboutRoute, isChangelogRoute } from './useRoute';

interface RouterProps {
  convertView: ComponentChildren;
  settingsView: ComponentChildren;
  logsView: ComponentChildren;
  aboutView: ComponentChildren;
  changelogView: ComponentChildren;
}

export function Router({ convertView, settingsView, logsView, aboutView, changelogView }: RouterProps) {
  if (isSettingsRoute.value) {
    return <>{settingsView}</>;
  }
  if (isLogsRoute.value) {
    return <>{logsView}</>;
  }
  if (isAboutRoute.value) {
    return <>{aboutView}</>;
  }
  if (isChangelogRoute.value) {
    return <>{changelogView}</>;
  }
  return <>{convertView}</>;
}
