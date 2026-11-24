"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionState } from "@/lib/auth/dal";
import { audit } from "@/lib/auth/audit";

export async function signOut() {
  const state = await getSessionState();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  if (state.status === "authenticated") {
    await audit("logout", { email: state.user.email, userId: state.user.authId });
  }
  // The trusted-device cookie is kept on purpose: it trusts the computer, not the session.
  redirect("/login");
}
