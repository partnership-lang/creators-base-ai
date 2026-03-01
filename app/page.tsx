import Dashboard from "@/components/dashboard";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase-server";
import { Creator, WorkspaceInvite } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { isConfigured } = getSupabaseEnv();
  if (!isConfigured) {
    return (
      <main className="container" style={{ maxWidth: 760, paddingTop: 40 }}>
        <div className="card">
          <h1>Supabase Setup Required</h1>
          <p>Set these variables in <code>.env.local</code> and restart the server:</p>
          <pre>
            NEXT_PUBLIC_SUPABASE_URL=...
            {"\n"}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=...
            {"\n"}
            GEMINI_API_KEY=...
          </pre>
          <p>Then open this page again.</p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: workspaceIdData, error: wsError } = await supabase.rpc("ensure_personal_workspace");
  if (wsError) {
    throw new Error(wsError.message);
  }

  const workspaceId = workspaceIdData as string;

  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data: inviteData, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (inviteError) {
    throw new Error(inviteError.message);
  }

  return (
    <Dashboard
      userEmail={user.email || "unknown"}
      workspaceId={workspaceId}
      initialCreators={(data as Creator[]) || []}
      initialInvites={(inviteData as WorkspaceInvite[]) || []}
    />
  );
}
