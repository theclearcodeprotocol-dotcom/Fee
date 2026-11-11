---
name: edit-reel
description: Edit a reel the user filmed for Cleo, their online content dashboard — take the clip from the "Cleo - to edit" Google Drive folder, edit it in the house style, render it, save it to "Cleo - ready to post" and attach it to that post in Cleo's scheduler. Use when the user types /edit, says "edit tomorrow's reel", "edit the plan reel", or says they've dropped a clip in Drive.
---

# /edit — from filmed clip to a post waiting for approval in Cleo

The user films on an iPad or phone and drops the clip in Google Drive. You edit and render it
here, then hand it back to **Cleo**, their content dashboard at
**https://claude.ai/artifact/C377BSo7rK7oopk2gX1C1K**. Cleo's data is in that page's database,
read and written with the **ArtifactData** tool.

- **Drive folders** (Google Drive connector):
  - **"Cleo - to edit"** (id `13ywngdqXwrqQV9eOJi4aVzQklsvwVouZ`): raw clips in.
  - **"Cleo - ready to post"**: finished videos out. Find it with `search_files`; if it
    doesn't exist, create it next to "Cleo - to edit" (same `parentId`).
- **Editing:** this repo's own pipeline. Load and follow `my-editing-style` for every
  creative decision, or `premium-bold-style` when the user asks for the premium look. Use
  `video-use` for cutting and `hyperframes` for captions, graphics and render.
- The user is on an iPad and doesn't want new subscriptions. Talk in plain words.

## 1. Which reel

- Use ArtifactData `list` on `calendar` and match what the user said: a date ("tomorrow"),
  a title ("the plan reel") or a hook.
- If they said nothing specific, take the earliest upcoming reel whose status is
  `scripted` or `filmed`.
- Say which one you picked in one line before starting.

## 2. Get the clip

1. Find it with `search_files`, query `parentId = '13ywngdqXwrqQV9eOJi4aVzQklsvwVouZ'`,
   ordered by `modifiedTime desc`. Match the filename to the reel. If you can't tell which
   clip is which, ask.
2. Make the clip downloadable here: `share_file` with `permissionId: "anyoneWithLink"` and
   `role: "reader"`. Then download it with
   `curl -L -o ai-video-editing/<slug>/clip.mp4 "https://drive.usercontent.google.com/download?id=<fileId>&export=download&confirm=t"`.
3. Check it's really video with `ffprobe`; a Drive warning page comes back as HTML. Never
   use `download_file_content` for video: it returns the whole file as text.
4. Several clips for one reel (several takes) are fine. Download them all.

## 3. Edit

- Work in `edits/<slug>/`, like the existing edits.
- Use the Cleo entry's `hook`, `script` and on-screen text as the brief. Keep the user's
  actual words: cut to the script's beats, don't rewrite what they said.
- Transcribe with `node scripts/elevenlabs-transcribe.mjs`, per the repo CLAUDE.md.
- Follow the house style: hook in the first 3 seconds, pacing, captions, pop-ups, sound and
  the `c.` watermark. Run `npm run check` and look at snapshots, as the repo CLAUDE.md
  requires.
- Render, then run `scripts/master.sh exports/<slug>_render.mp4 exports/<slug>.mp4`. Use
  `exports/<slug>_phone.mp4` as the posting file.
- Send the user the phone version with SendUserFile so they can watch it, and tell them what
  you did in two or three lines.

## 4. Back to Cleo

1. **Upload:** `create_file` into "Cleo - ready to post", with title `<date> <title>.mp4`,
   `contentMimeType: "video/mp4"`, `disableConversionToGoogleType: true` and `base64Content`
   set to a file reference, `sha256:<sha256 of the file>:<absolute path>`. Never paste the
   base64 itself.
2. **Share:** `share_file` with `permissionId: "anyoneWithLink"` and `role: "reader"`.
3. **Media link:** `https://drive.usercontent.google.com/download?id=<fileId>&export=download&confirm=t`.
   It's a direct file link Metricool can fetch, and it doesn't need Drive linked in Metricool.
4. **Attach it in Cleo:** use ArtifactData `list` on `posts` and find the one with this
   `calendarEntryId`.
   - **No post yet:** `set` `posts/post_<8 hex>` with
     `{id, calendarEntryId, title, format, platforms, scheduledFor, captions, media: [link], status: "pending_approval", captionSource: "script", createdAt}`.
     - `captions` comes from the calendar entry.
     - `scheduledFor` is the entry's London date and time as an ISO instant:
       `TZ=Europe/London node -e "console.log(new Date('<date>T<time>:00').toISOString())"`.
   - **Post `pending_approval`:** `update` its `media` to `[link]`, with `if_version`.
   - **Post already `approved` or later:** don't touch it, because that would break the
     user's approval. Tell them the new video is in Drive and they can swap it in.
5. Update the calendar entry's `status` to `"edited"`, with `if_version`.

## 5. Reply

Tell the user:
- the reel's title and when it goes out
- that it's waiting in Cleo's scheduler under "needs your approval"
- what to do next: check the captions, tap **approve**, then type `/metricool send`

Keep it to four lines plus the preview.
