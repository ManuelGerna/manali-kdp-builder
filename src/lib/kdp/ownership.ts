export type OwnershipActor = {
  email: string;
  userId: string;
};

export function resolveActorEmail(email: string | null | undefined) {
  return email?.trim() || "Utente autenticato";
}

export function createOwnershipActor(input: {
  email?: string | null;
  userId: string;
}): OwnershipActor {
  return {
    email: resolveActorEmail(input.email),
    userId: input.userId,
  };
}

export function getCreateOwnershipFields(actor: OwnershipActor) {
  return {
    created_by_user_id: actor.userId,
    created_by_email: actor.email,
    updated_by_user_id: actor.userId,
    updated_by_email: actor.email,
  };
}

export function getUpdateOwnershipFields(actor: OwnershipActor) {
  return {
    updated_by_user_id: actor.userId,
    updated_by_email: actor.email,
  };
}

export function formatInternalOwner(email: string | null | undefined) {
  return email?.trim() || "Non disponibile";
}
