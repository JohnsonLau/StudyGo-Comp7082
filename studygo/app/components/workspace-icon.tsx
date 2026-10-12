import type { ReactNode } from "react";

export type IconName =
  | "home"
  | "book"
  | "folder"
  | "quiz"
  | "results"
  | "insights"
  | "profile"
  | "settings"
  | "bell"
  | "upload"
  | "arrow"
  | "leaf"
  | "plus"
  | "sparkle";

export function WorkspaceIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
    book: <><path d="M12 7v14" /><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 23z" /><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5 2z" /></>,
    folder: <><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /><path d="M3.5 10h17" /></>,
    quiz: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3.5h6v3H9zM9 11h6M9 15h6" /></>,
    results: <><path d="M5 20v-6M12 20V5M19 20V9" /><path d="M3 20h18" /></>,
    insights: <><path d="M9 18h6M10 22h4" /><path d="M8 14.5a7 7 0 1 1 8 0c-1 .7-1.5 1.5-1.5 2.5h-5c0-1-.5-1.8-1.5-2.5Z" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="white" /><circle cx="15" cy="17" r="2" fill="white" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    leaf: <><path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-7 8-16Z" /><path d="M4 21c2-5 5-8 10-11" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    sparkle: <><path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="workspace-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {paths[name]}
    </svg>
  );
}
