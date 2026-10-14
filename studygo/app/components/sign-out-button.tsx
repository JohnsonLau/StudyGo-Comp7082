"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "../../utils/supabase/browser";
import { WorkspaceIcon } from "./workspace-icon";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function signOut() {
    setIsSigningOut(true);
    setErrorMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message);
        setIsSigningOut(false);
        return;
      }

      router.replace("/login");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not sign out. Please try again.",
      );
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <button
        className="workspace-nav-link workspace-signout-button"
        disabled={isSigningOut}
        onClick={signOut}
        type="button"
      >
        <WorkspaceIcon name="signout" />
        <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
      </button>
      {errorMessage && <p className="workspace-signout-error" role="alert">{errorMessage}</p>}
    </>
  );
}
