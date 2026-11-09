"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { subscribeAwardNotices, tryUnlockAward, type AwardUnlockNotice } from "../../utils/awards";
import styles from "./award-toast.module.css";

const TOAST_MS = 5200;

export function AwardToastHost() {
  const [notice, setNotice] = useState<AwardUnlockNotice | null>(null);

  useEffect(() => {
    let hideTimer = 0;
    const unsubscribe = subscribeAwardNotices(next => {
      window.clearTimeout(hideTimer);
      setNotice(next);
      hideTimer = window.setTimeout(() => setNotice(null), TOAST_MS);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    void tryUnlockAward("unlock_login_streak_award");
  }, []);

  if (!notice) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <Image
        alt=""
        className={styles.toastArt}
        height={48}
        src="/images/awards/gold.png"
        width={48}
      />
      <div className={styles.toastCopy}>
        <p className={styles.toastLabel}>Award unlocked</p>
        <strong>{notice.title}</strong>
        <span>{notice.description}</span>
      </div>
      <button
        type="button"
        className={styles.toastDismiss}
        aria-label="Yay!"
        onClick={() => setNotice(null)}
      >
        Close
      </button>
    </div>
  );
}
