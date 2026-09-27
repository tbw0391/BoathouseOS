-- Let people delete messages they sent.

drop policy if exists "senders can delete their own messages" on messages;
create policy "senders can delete their own messages"
  on messages for delete
  to authenticated
  using (auth.uid() = sender_id);
