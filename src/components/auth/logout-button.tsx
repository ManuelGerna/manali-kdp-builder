import { signOut } from "@/app/login/actions";
import { ActionButton } from "@/components/ui/action-button";

export function LogoutButton() {
  return (
    <form action={signOut} className="logout-form">
      <ActionButton variant="ghost" type="submit">
        Esci
      </ActionButton>
    </form>
  );
}
