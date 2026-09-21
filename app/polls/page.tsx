import { createClient } from "@/lib/supabase/server";
import type { Poll, PollInvitee, PollOption, PollVote, Profile } from "@/lib/database.types";
import { PollForm } from "./PollForm";
import { PollCard } from "./PollCard";

export default async function PollsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role, is_board_member")
    .eq("id", user.id)
    .single();
  const caller = callerProfile as { role: string; is_board_member: boolean } | null;
  const isAdmin = caller?.role === "admin";
  const isBoardMember = Boolean(caller?.is_board_member);
  const canCreate = Boolean(isAdmin || caller?.role === "coach" || isBoardMember);

  const { data: pollsData } = await supabase
    .from("polls")
    .select("*")
    .order("created_at", { ascending: false });
  const polls = (pollsData as Poll[] | null) ?? [];

  const { data: optionsData } = await supabase
    .from("poll_options")
    .select("*")
    .order("position", { ascending: true });
  const options = (optionsData as PollOption[] | null) ?? [];

  const { data: votesData } = await supabase.from("poll_votes").select("*");
  const votes = (votesData as PollVote[] | null) ?? [];

  const { data: inviteesData } = await supabase.from("poll_invitees").select("*");
  const invitees = (inviteesData as PollInvitee[] | null) ?? [];

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .is("disabled_at", null);
  const profiles = (profilesData as (Pick<Profile, "id" | "display_name"> & { role: string })[] | null) ?? [];
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
  const coaches = profiles
    .filter((p) => p.role === "coach")
    .map((p) => ({ id: p.id, display_name: p.display_name }));

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Polls</h1>

      {canCreate && (
        <div className="mb-6">
          <PollForm coaches={coaches} />
        </div>
      )}

      {polls.length === 0 && <p className="text-sm text-gray-500">No polls yet.</p>}

      <div className="flex flex-col gap-6 max-w-md">
        {polls.map((poll) => {
          const pollOptions = options.filter((o) => o.poll_id === poll.id);
          const pollVotes = votes.filter((v) => v.poll_id === poll.id);
          const myOptionIds = pollVotes
            .filter((v) => v.user_id === user.id)
            .map((v) => v.option_id);
          const closed = poll.closed_at !== null;
          const canManageThis = isAdmin || isBoardMember || poll.created_by === user.id;
          const pollInviteeIds = invitees
            .filter((i) => i.poll_id === poll.id)
            .map((i) => i.user_id);
          const inviteeNames = pollInviteeIds.map((id) => nameById.get(id) ?? "Someone").join(", ");
          const optionVotes = pollOptions.map((option) => {
            const votesForOption = pollVotes.filter((v) => v.option_id === option.id);
            return {
              optionId: option.id,
              count: votesForOption.length,
              voterNames: votesForOption.map((v) => nameById.get(v.user_id) ?? "Someone").join(", "),
            };
          });

          return (
            <PollCard
              key={poll.id}
              poll={poll}
              options={pollOptions.map((o) => ({ id: o.id, label: o.label }))}
              optionVotes={optionVotes}
              myOptionIds={myOptionIds}
              canManageThis={canManageThis}
              closed={closed}
              coaches={coaches}
              inviteeIds={pollInviteeIds}
              inviteeNames={inviteeNames}
            />
          );
        })}
      </div>
    </div>
  );
}
