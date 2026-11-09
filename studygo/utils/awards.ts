import { createSupabaseBrowserClient } from "./supabase/browser";

export type AwardUnlockNotice = {
  award_id: string;
  title: string;
  description: string;
};

type AwardUnlockResponse = {
  unlocked?: boolean;
  award_id?: string;
  title?: string;
  description?: string;
};

type AwardListener = (notice: AwardUnlockNotice) => void;

const listeners = new Set<AwardListener>();

export function subscribeAwardNotices(listener: AwardListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function announceAwardUnlock(notice: AwardUnlockNotice) {
  listeners.forEach(listener => listener(notice));
}

export type AwardUnlockRpc =
  | "unlock_login_streak_award"
  | "unlock_file_upload_award"
  | "unlock_quiz_generation_award"
  | "unlock_quiz_dedication_award"
  | "unlock_quiz_perfect_award"
  | "unlock_quiz_mastery_award";

export async function tryUnlockAward(rpc: AwardUnlockRpc): Promise<AwardUnlockNotice | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc(rpc);
  if (error) {
    console.error(`Could not evaluate ${rpc}:`, error.message);
    return null;
  }

  const result = data as AwardUnlockResponse | null;
  if (!result?.unlocked || !result.award_id || !result.title || !result.description) {
    return null;
  }

  const notice = {
    award_id: result.award_id,
    title: result.title,
    description: result.description,
  };
  announceAwardUnlock(notice);
  return notice;
}
