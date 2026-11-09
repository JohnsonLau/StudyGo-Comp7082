"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { subscribeAwardNotices, tryUnlockAward, type AwardUnlockNotice } from "../../utils/awards";
import styles from "./award-toast.module.css";

const TOAST_MS = 5200;

export function AwardToastHost() {
  const [notice, setNotice] = useState<AwardUnlockNotice | null>(null);
  const queueRef = useRef<AwardUnlockNotice[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const showingRef = useRef(false);
  const hideTimerRef = useRef(0);
  const advanceRef = useRef<() => void>(() => {});

  useEffect(() => {
    function advance() {
      window.clearTimeout(hideTimerRef.current);
      const next = queueRef.current.shift() ?? null;
      if (!next) {
        showingRef.current = false;
        activeIdRef.current = null;
        setNotice(null);
        return;
      }

      showingRef.current = true;
      activeIdRef.current = next.award_id;
      setNotice(next);
      hideTimerRef.current = window.setTimeout(() => {
        advance();
      }, TOAST_MS);
    }

    advanceRef.current = advance;

    function enqueue(next: AwardUnlockNotice) {
      if (
        activeIdRef.current === next.award_id
        || queueRef.current.some(item => item.award_id === next.award_id)
      ) {
        return;
      }

      queueRef.current.push(next);
      if (!showingRef.current) advance();
    }

    const unsubscribe = subscribeAwardNotices(enqueue);
    return () => {
      unsubscribe();
      window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    void tryUnlockAward("unlock_login_streak_award");
  }, []);

  if (!notice) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite" key={notice.award_id}>
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
        aria-label="Dismiss award notification"
        onClick={() => advanceRef.current()}
      >
        Close
      </button>
    </div>
  );
}
