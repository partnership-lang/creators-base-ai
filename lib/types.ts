export type Gender = "Male" | "Female" | "";
export type Source = "AIGC" | "Fiverr" | "UGC" | "";
export type CreatorStatus = "Added in base" | "Contact" | "Signed a contract";

export type Creator = {
  id: string;
  workspace_id: string;
  name: string;
  photo_url: string | null;
  instagram: string | null;
  portfolio: string | null;
  email: string | null;
  contact: string | null;
  language: string | null;
  niches: string | null;
  country: string | null;
  budget: string | null;
  gender: Gender;
  age_range: string | null;
  race: string | null;
  source: Source;
  status: CreatorStatus;
  comment: string | null;
  ai_raw_input: string | null;
  created_at: string;
};

export type WorkspaceInvite = {
  id: string;
  workspace_id: string;
  invite_email: string;
  invited_by: string;
  created_at: string;
};

export type GeminiOutput = {
  gender: string;
  age_range: string;
  race: string;
  instagram: string;
  email: string;
  contact: string;
  country: string;
  language: string;
  niches: string;
  budget: string;
  source: string;
  comment: string;
};
