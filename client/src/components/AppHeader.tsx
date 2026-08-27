import { type ReactNode } from "react";

type AppHeaderProps = {
  brand: ReactNode;
  organization: ReactNode;
  context: ReactNode;
  account: ReactNode;
  navigation: ReactNode;
  search: ReactNode;
  utilities: ReactNode;
};

export function AppHeader({ brand, organization, context, account, navigation, search, utilities }: AppHeaderProps) {
  return <header className="nawa-global-header nawa-command-bar">
    <div className="nawa-header-topline">
      <div className="nawa-header-brandline">{brand}</div>
      <div className="nawa-header-organization">{organization}</div>
      <nav className="nawa-header-context" aria-label="سياق البوابة">{context}</nav>
      <span className="nawa-header-top-spacer" aria-hidden="true" />
      <div className="nawa-header-accountline">{account}</div>
    </div>
    <div className="nawa-header-workline">
      <nav className="nawa-header-navigation" aria-label="تنقل الصفحة">{navigation}</nav>
      <div className="nawa-header-search">{search}</div>
      <div className="nawa-header-utilities">{utilities}</div>
    </div>
  </header>;
}
