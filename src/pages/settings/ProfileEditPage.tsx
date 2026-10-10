/** @doc Profile editor — full name, photo, delete account. Autosaves the name. */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Camera, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeErrorMessage } from "@/lib/sanitizeError";
import { useIsMobile } from "@/hooks/use-mobile";
import { SubShell, SubSection, SubCard, DangerCallout } from "@/components/settings/SubShell";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { translateExactText, useUserLang } from "@/lib/authI18n";

const ProfileEditPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const lang = useUserLang();
  const isAr = lang === "ar-eg";
  const tx = (text: string) => translateExactText(text, lang);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");

  const savedRef = useRef({ fullName: "" });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setAvatarUrl(user.user_metadata?.avatar_url ?? null);

      const profileRes = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      if ((profileRes.data as any)?.avatar_url) setAvatarUrl((profileRes.data as any).avatar_url);

      const initialFull =
        (profileRes.data as any)?.display_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "";

      setFullName(initialFull);
      savedRef.current = { fullName: initialFull };
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (loading || !userId) return;
    const dirtyName = fullName.trim() !== savedRef.current.fullName.trim();
    if (!dirtyName) return;

    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        const results = await Promise.all([
          Promise.resolve(
            supabase.rpc("update_profile_safe", {
              p_user_id: userId,
              p_display_name: fullName.trim(),
            }),
          ),
          supabase.auth.updateUser({ data: { full_name: fullName.trim() } }),
        ]);
        const err = results.find((r: any) => r?.error)?.error;
        if (err) throw err;

        savedRef.current = { fullName };
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1400);
      } catch (err: any) {
        setSaveState("idle");
        toast.error(sanitizeErrorMessage(err, "Failed to save"));
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [fullName, loading, userId]);

  const goBack = () => navigate("/settings");

  const pickAvatar = () => fileRef.current?.click();

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image is too large (max 5MB)");
      return;
    }
    setAvatarBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const { uploadToTelegram } = await import("@/lib/telegramStorage");
      const uploaded = await uploadToTelegram(file, {
        filename: `avatar-${Date.now()}.${ext}`,
        kind: "photo",
      });
      const url = uploaded.url;
      if (!url) throw new Error("Could not resolve image URL");

      const [profRes, authRes] = await Promise.all([
        supabase.from("profiles").update({ avatar_url: url }).eq("id", userId),
        supabase.auth.updateUser({ data: { avatar_url: url } }),
      ]);
      if ((profRes as any)?.error) throw (profRes as any).error;
      if ((authRes as any)?.error) throw (authRes as any).error;

      setAvatarUrl(url);
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error(sanitizeErrorMessage(err, "Failed to update photo"));
    } finally {
      setAvatarBusy(false);
    }
  };

  const openDelete = () => setConfirmOpen(true);
  const confirmDelete = () => {
    setConfirmOpen(false);
    navigate("/settings/delete-account");
  };

  const statusIcon =
    saveState === "saving" ? (
      <Loader2 className="pep-spin animate-spin" />
    ) : saveState === "saved" ? (
      <Check strokeWidth={2.2} />
    ) : null;

  // ============================== MOBILE ==============================
  if (isMobile) {
    const initial = (fullName || "U").trim().charAt(0).toUpperCase();
    const BackChevron = isAr ? ChevronRight : ChevronLeft;
    return (
      <div className="pep-root" dir={isAr ? "rtl" : "ltr"}>
        <style>{pepCss}</style>

        {/* Topbar — same glass header language as the settings home */}
        <header className="pep-topbar">
          <button className="pep-icon-btn" aria-label={tx("Back")} onClick={goBack}>
            <BackChevron className="pep-chev" />
          </button>
          <h1 className="pep-title">{tx("Account")}</h1>
          <span className="pep-save" aria-live="polite">{statusIcon}</span>
        </header>

        <main className="pep-main">
          <section className="pep-card">
            <button type="button" className="pep-row pep-row-btn" onClick={pickAvatar} disabled={avatarBusy}>
              <span className="pep-avatar">
                {avatarUrl ? <img src={avatarUrl} alt="" className="pep-avatar-img" /> : initial}
              </span>
              <span className="pep-row-label">{tx("Profile photo")}</span>
              <span className="pep-row-trailing">
                {avatarBusy ? (
                  <Loader2 className="pep-spin animate-spin" />
                ) : (
                  <Camera className="pep-row-ico" strokeWidth={1.7} />
                )}
                {avatarBusy ? tx("Uploading…") : tx("Change")}
              </span>
            </button>
          </section>

          <section className="pep-card">
            <div className="pep-row">
              <label htmlFor="pep-full" className="pep-row-label">{tx("Full name")}</label>
              <input
                id="pep-full"
                className="pep-row-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={tx("Your name")}
                autoComplete="name"
              />
            </div>
          </section>
          <p className="pep-hint">{tx("Megsy calls you by this name in chat.")}</p>

          <button className="pep-danger" type="button" onClick={openDelete}>
            <Trash2 className="pep-danger-ico" strokeWidth={1.7} />
            <span>{tx("Delete account")}</span>
          </button>

          <div className="pep-spacer" />
        </main>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarFile} />

        <ConfirmDialog
          open={confirmOpen}
          tone="danger"
          title={tx("Delete account")}
          description={tx("This permanently removes your account, chats and files. This cannot be undone.")}
          confirmLabel={tx("Delete")}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    );
  }


  // ============================== DESKTOP ==============================
  return (
    <SubShell
      title="Profile"
      subtitle="Changes are saved automatically."
      backTo="/settings"
      action={
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          {saveState === "saving" && (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>)}
          {saveState === "saved" && (<><Check className="w-3.5 h-3.5 text-primary" /> Saved</>)}
        </span>
      }
    >
      <SubSection title="Photo" description="Shown across Megsy.">
        <SubCard>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={pickAvatar}
              disabled={avatarBusy}
              className="relative w-16 h-16 rounded-full overflow-hidden border border-border/70 bg-muted grid place-items-center text-[22px] font-medium text-foreground"
              aria-label="Change profile photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (nickname || fullName || email || "U").trim().charAt(0).toUpperCase()
              )}
              {avatarBusy && (
                <span className="absolute inset-0 grid place-items-center bg-background/60">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
              )}
            </button>
            <div>
              <button
                type="button"
                onClick={pickAvatar}
                disabled={avatarBusy}
                className="px-3.5 py-2 rounded-lg text-[13px] font-medium bg-background/60 border border-border/70 hover:border-foreground/40 transition-colors inline-flex items-center gap-2"
              >
                <Camera className="w-3.5 h-3.5" /> Upload photo
              </button>
              <p className="mt-2 text-[12px] text-muted-foreground">PNG or JPG, up to 5MB.</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarFile} />
        </SubCard>
      </SubSection>

      <SubSection title={tx("Name")} description={tx("How Megsy addresses you.")}>
        <SubCard>
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
              {tx("Full name")}
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={tx("Your name")}
              className="mt-2 w-full px-3.5 py-2.5 rounded-lg bg-background/60 border border-border/70 text-[14px] text-foreground outline-none focus:border-foreground/40 transition-colors"
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              {tx("Megsy calls you by this name in chat.")}
            </p>
          </div>
        </SubCard>
      </SubSection>

      <SubSection title={tx("Danger zone")} description={tx("Irreversible actions.")}>
        <DangerCallout
          title={tx("Delete account")}
          description={tx("Permanently remove your account and all associated data.")}
          action={
            <button
              onClick={openDelete}
              className="px-4 py-2 rounded-lg text-[13px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
            >
              {tx("Delete account")}
            </button>
          }
        />
      </SubSection>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title={tx("Delete account")}
        description={tx("This permanently removes your account, chats and files. This cannot be undone.")}
        confirmLabel={tx("Delete")}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </SubShell>
  );
};

const pepCss = `
.pep-root {
  min-height: 100dvh;
  background: var(--mn-bg);
  color: var(--mn-fg);
  font-family: "Neue Haas Unica", "Helvetica Now Display", -apple-system, "SF Pro Display", Inter, "Segoe UI", Roboto, sans-serif;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.pep-topbar {
  position: sticky; top: 0; z-index: 5;
  display: grid; grid-template-columns: 38px 1fr 38px;
  align-items: center;
  padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 10px;
  background: var(--mn-bg);
}
.pep-title {
  margin: 0;
  text-align: center;
  font-size: 16px; font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--mn-fg);
}
.pep-icon-btn {
  width: 34px; height: 34px;
  display: inline-grid; place-items: center;
  border-radius: 999px;
  background: transparent;
  border: 0;
  color: var(--mn-fg);
  cursor: pointer;
  transition: transform 160ms ease;
}
.pep-icon-btn:active { transform: scale(0.94); }

.pep-main { padding: 6px 14px 20px; }
.pep-avatar-wrap { display: grid; place-items: center; gap: 8px; padding: 20px 0 18px; }
.pep-avatar {
  width: 74px; height: 74px; border-radius: 999px;
  display: grid; place-items: center;
  background: var(--mn-avatar); color: #fff;
  font-size: 30px; font-weight: 500; line-height: 1;
}
.pep-avatar-hint { margin: 0; font-size: 12.5px; color: var(--mn-muted); }
.pep-avatar-btn {
  position: relative; padding: 0; border: 0; background: transparent;
  width: 74px; height: 74px; border-radius: 999px; cursor: pointer;
  transition: transform 160ms ease;
}
.pep-avatar-btn:active { transform: scale(0.96); }
.pep-avatar-btn:disabled { opacity: 0.7; }
.pep-avatar-img { width: 74px; height: 74px; border-radius: 999px; object-fit: cover; display: block; }
.pep-avatar-badge {
  position: absolute; right: -2px; bottom: -2px;
  width: 26px; height: 26px; border-radius: 999px;
  display: grid; place-items: center;
  background: var(--mn-fg); color: var(--mn-bg);
  border: 2px solid var(--mn-bg);
}
.pep-row-value { flex: 1; text-align: end; font-size: 14px; color: var(--mn-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pep-row-value-mono { font-variant-numeric: tabular-nums; }
.pep-flat {
  margin-top: 16px; width: 100%;
  padding: 14px 16px; border: 0; border-radius: 14px;
  background: var(--mn-card); color: var(--mn-fg);
  font: inherit; font-size: 14px; font-weight: 500;
  cursor: pointer; text-align: center;
  transition: transform 160ms ease;
}
.pep-flat:active { transform: scale(0.99); }
.pep-flat-danger { color: var(--mn-danger); }
.pep-section-title {
  margin: 18px 4px 8px;
  font-size: 12px; font-weight: 500;
  color: var(--mn-muted);
  letter-spacing: -0.005em;
}

.pep-card {
  background: var(--mn-card);
  border: 0;
  border-radius: 14px;
  overflow: hidden;
}
.pep-card-tight { padding: 4px; }


.pep-row {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 15px;
  min-height: 48px;
}
.pep-row-label {
  font-size: 14px; font-weight: 400;
  color: var(--mn-muted);
  flex-shrink: 0;
}
.pep-root .pep-row-input {
  flex: 1;
  background-color: var(--mn-card) !important;
  background-image: none !important;
  border: 0 !important; outline: none;
  color: var(--mn-fg) !important;
  font: inherit;
  font-size: 14px; font-weight: 500;
  text-align: end;
  min-width: 0;
  -webkit-appearance: none;
  appearance: none;
  color-scheme: dark;
  box-shadow: none !important;
  caret-color: var(--mn-fg);
}
.pep-root .pep-row-input::placeholder { color: var(--mn-faint) !important; }
.pep-root .pep-row-input:-webkit-autofill,
.pep-root .pep-row-input:-webkit-autofill:hover,
.pep-root .pep-row-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px var(--mn-card) inset;
  -webkit-text-fill-color: var(--mn-fg);
  caret-color: var(--mn-fg);
}
.pep-divider {
  height: 1px;
  background: var(--mn-sep);
  margin-left: 15px;
}
.pep-hint {
  margin: 8px 6px 0;
  font-size: 12px;
  color: rgba(232,232,232,0.5);
  line-height: 1.45;
}

/* Scope under .pep-root so these rules beat the mobile theme's global
   body.ms-theme textarea selector and keep the textarea the same dark
   surface as the card. */
.pep-root .pep-textarea {
  width: 100%;
  min-height: 80px;
  background-color: var(--mn-card) !important;
  background-image: none !important;
  border: 0; outline: none;
  padding: 12px 14px;
  color: var(--mn-fg);
  font: inherit;
  font-size: 14px; font-weight: 400;
  resize: none;
  -webkit-appearance: none;
  appearance: none;
  color-scheme: dark;
  box-shadow: none;
}
.pep-root .pep-textarea::placeholder { color: var(--mn-muted); }
.pep-root .pep-textarea:-webkit-autofill,
.pep-root .pep-textarea:-webkit-autofill:hover,
.pep-root .pep-textarea:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px var(--mn-card) inset;
  -webkit-text-fill-color: var(--mn-fg);
  caret-color: var(--mn-fg);
}

.pep-danger {
  margin-top: 18px;
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 13px 15px;
  background: rgba(255,90,90,0.06);
  border: 1px solid rgba(255,90,90,0.12);
  border-radius: 14px;
  color: var(--mn-danger);
  font: inherit;
  font-size: 14px; font-weight: 500;
  cursor: pointer;
  transition: transform 160ms ease, background-color 160ms ease;
}
.pep-danger:active { transform: scale(0.99); background: rgba(255,90,90,0.10); }

.pep-spacer { height: 28px; }

/* Confirm modal */
.pep-modal-scrim {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(6px);
  display: grid; place-items: center;
  padding: 20px;
  animation: pep-fade 200ms ease-out both;
}
.pep-modal {
  width: 100%; max-width: 300px;
  background: var(--mn-card);
  border: 0;
  border-radius: 18px;
  padding: 18px 18px 12px;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 var(--mn-sep);
  animation: pep-pop 220ms cubic-bezier(0.16,1,0.3,1) both;
}
.pep-modal-title {
  margin: 0 0 5px;
  font-size: 16px; font-weight: 600;
  color: var(--mn-fg);
}
.pep-modal-body {
  margin: 0 0 16px;
  font-size: 13.5px; line-height: 1.4;
  color: var(--mn-muted);
}
.pep-modal-actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.pep-modal-btn {
  padding: 10px;
  border-radius: 12px;
  background: var(--mn-card-2);
  border: 0;
  color: var(--mn-fg);
  font: inherit;
  font-size: 13.5px; font-weight: 500;
  cursor: pointer;
  transition: transform 160ms ease, background-color 160ms ease;
}
.pep-modal-btn:active { transform: scale(0.97); }
.pep-modal-btn-danger {
  color: var(--mn-danger);
  background: rgba(255,90,90,0.08);
  border-color: rgba(255,90,90,0.16);
}

@keyframes pep-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pep-pop {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
`;

export default ProfileEditPage;
