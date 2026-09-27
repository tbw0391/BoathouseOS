"use client";

import { useRef, useState, useTransition } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { addPhotoComment, deletePhotoComment, setPhotoLiked } from "./actions";

export interface PhotoCommentView {
  id: string;
  authorName: string;
  body: string;
  canDelete: boolean;
}

export function PhotoSocial({
  photoId,
  likeCount,
  likedByMe,
  likerNames,
  comments,
}: {
  photoId: string;
  likeCount: number;
  likedByMe: boolean;
  likerNames: string[];
  comments: PhotoCommentView[];
}) {
  const [liked, setLiked] = useState(likedByMe);
  const [count, setCount] = useState(likeCount);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function toggleLike() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      try {
        await setPhotoLiked(photoId, next);
      } catch {
        setLiked(!next);
        setCount((c) => c + (next ? -1 : 1));
      }
    });
  }

  function handleComment(formData: FormData) {
    setError(null);
    const text = String(formData.get("body") ?? "");
    startTransition(async () => {
      try {
        await addPhotoComment(photoId, text);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't post that.");
      }
    });
  }

  function handleDelete(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    startTransition(async () => {
      try {
        await deletePhotoComment(commentId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't delete that.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 text-xs text-gray-600">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          title={likerNames.length ? `Liked by ${likerNames.join(", ")}` : undefined}
          className="flex items-center gap-1 py-1"
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : ""}`} />
          {count > 0 && count}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 py-1"
        >
          <MessageCircle className="w-4 h-4" />
          {comments.length > 0 ? comments.length : "Comment"}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2">
          {comments.map((c) => (
            <p key={c.id} className="text-xs">
              <strong>{c.authorName}</strong> {c.body}
              {c.canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="ml-1 text-gray-400 hover:text-red-600"
                >
                  Delete
                </button>
              )}
            </p>
          ))}
          <form ref={formRef} action={handleComment} className="flex gap-1">
            <input
              name="body"
              placeholder="Add a comment..."
              maxLength={500}
              required
              autoComplete="off"
              className="min-w-0 flex-1 border rounded px-2 py-1 text-xs bg-white text-gray-900"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded border-2 border-[var(--color-primary)] px-2 text-xs disabled:opacity-50"
            >
              Post
            </button>
          </form>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
