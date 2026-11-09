"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../utils/supabase/browser";
import styles from "./awards.module.css";

type AwardRow = {
  award_id: string;
  title: string;
  description: string;
  unit: string;
  target: number;
  sort_order: number;
  current_progress: number;
  unlocked_at: string | null;
};

async function loadAwards(): Promise<AwardRow[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("sync_user_awards");
  if (error) throw new Error(error.message || "Could not load your awards.");
  return (data ?? []) as AwardRow[];
}

export default function AwardsContent() {
  const [awards, setAwards] = useState<AwardRow[] | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadAwards()
      .then(rows => {
        if (!cancelled) setAwards(rows);
      })
      .catch(cause => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load your awards.");
          setAwards([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const unlockedCount = awards?.filter(award => award.unlocked_at != null).length ?? 0;

  return (
    <div className={styles.awardsPage}>
      <div className={styles.pageHeading}>
        <h1>Your awards</h1>
        <p>
          {isLoading
            ? "Loading your milestones…"
            : `${unlockedCount} of ${awards?.length ?? 0} awards unlocked`}
        </p>
      </div>

      {error && <p className={styles.errorMessage} role="alert">{error}</p>}

      <section aria-label="Award collection" className={styles.badgeGrid}>
        {(awards ?? []).map(award => {
          const unlocked = award.unlocked_at != null;
          const shown = Math.min(award.current_progress, award.target);
          return (
            <article
              aria-label={`${award.title}: ${unlocked ? "unlocked" : "locked"}`}
              className={`${styles.badgeItem}${unlocked ? ` ${styles.unlocked}` : ""}`}
              key={award.award_id}
            >
              <div className={styles.badgeArt}>
                <Image
                  alt=""
                  className={styles.badgeImage}
                  height={120}
                  src={unlocked ? "/images/awards/gold.png" : "/images/awards/locked.png"}
                  width={120}
                />
              </div>
              <div className={styles.badgeCopy}>
                <p className={styles.badgeStatus}>{unlocked ? "Unlocked" : "Locked"}</p>
                <h2>{award.title}</h2>
                <p className={styles.badgeDescription}>{award.description}</p>
                <div className={styles.progressTrack} aria-hidden="true">
                  <span
                    className={styles.progressFill}
                    style={{ width: `${award.target > 0 ? (shown / award.target) * 100 : 0}%` }}
                  />
                </div>
                <p className={styles.progressLabel}>
                  {shown} / {award.target} {award.unit}
                </p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
