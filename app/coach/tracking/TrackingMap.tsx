"use client";

import dynamic from "next/dynamic";
import type { ActiveSessionView } from "./page";

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

export function TrackingMap({ initialSessions }: { initialSessions: ActiveSessionView[] }) {
  return <LeafletMap initialSessions={initialSessions} />;
}
