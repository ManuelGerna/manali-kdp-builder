import { signOut } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={signOut} className="logout-form">
      <button className="ghost-button" type="submit">
        Esci
      </button>
    </form>
  );
}
