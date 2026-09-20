"use client";

import { useEffect } from "react";
import { markScheduleViewed } from "./actions";

export function MarkViewed() {
  useEffect(() => {
    markScheduleViewed();
  }, []);

  return null;
}
