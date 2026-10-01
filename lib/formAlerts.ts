import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeMemberIds, familyMemberIds } from "@/lib/push";
import type { FormAudience } from "@/lib/database.types";

// Who a form or election is for (matches can_see_form() in 0115).
export async function formAudienceIds(clubId: string, audience: FormAudience): Promise<string[]> {
  switch (audience) {
    case "rowers":
      return activeMemberIds(clubId, ["rower", "coxswain"]);
    case "parents":
      return familyMemberIds(clubId);
    case "coaches":
      return activeMemberIds(clubId, ["coach", "admin"]);
    case "board": {
      const { data } = await createAdminClient()
        .from("profiles")
        .select("id")
        .eq("club_id", clubId)
        .or("role.eq.admin,is_board_member.eq.true")
        .not("approved_at", "is", null)
        .is("disabled_at", null);
      return ((data as { id: string }[] | null) ?? []).map((p) => p.id);
    }
    default:
      return activeMemberIds(clubId);
  }
}
