import { signIn } from "@/app/login/actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    setup?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasSetupNotice = params?.setup === "supabase";
  const hasMissingCredentials = params?.error === "missing_credentials";
  const hasInvalidCredentials = params?.error === "invalid_credentials";

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-heading">
          <span className="brand-mark">KB</span>
          <h1>KDP Builder</h1>
          <p>Accesso privato Manali Corporate.</p>
        </div>

        {hasSetupNotice ? (
          <p className="form-note">
            Supabase non configurato. Aggiungi le variabili dedicate al progetto
            KDP Builder in locale per abilitare il login.
          </p>
        ) : null}

        {hasMissingCredentials ? (
          <p className="form-note">Inserisci email e password.</p>
        ) : null}

        {hasInvalidCredentials ? (
          <p className="form-note">Credenziali non valide.</p>
        ) : null}

        <form action={signIn} className="form-grid">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="nome@azienda.com"
              type="email"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              autoComplete="current-password"
              id="password"
              name="password"
              type="password"
            />
          </div>

          <button className="button" type="submit">
            Entra
          </button>
        </form>
      </section>
    </main>
  );
}
