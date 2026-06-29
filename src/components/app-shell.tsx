import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageHeader } from "@/components/ui/page-header";

type AppShellProps = {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
};

export function AppShell({
  children,
  title,
  eyebrow = "KDP Builder",
  description,
  actions,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand-lockup" href="/libri" aria-label="KDP Builder">
            <span className="brand-mark">K</span>
            <span className="brand-text">
              <span className="brand-name">KDP Builder</span>
              <span className="brand-domain">kdp.manalicorporate.com</span>
            </span>
          </Link>

          <nav className="top-nav" aria-label="Navigazione principale">
            <Link className="nav-link" href="/libri">
              Libri
            </Link>
            <Link className="nav-link" href="/impostazioni">
              Impostazioni
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="shell-main">
        <PageHeader
          actions={actions}
          description={description}
          eyebrow={eyebrow}
          title={title}
        />

        {children}
      </main>
    </div>
  );
}
