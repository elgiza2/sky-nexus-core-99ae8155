/** @doc Data & privacy — opens as a stacked sheet over settings (shares pep styles). */
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { pepCss } from "./ProfileEditPage";
import { translateExactText, useUserLang } from "@/lib/authI18n";

const privacyCss = `
.dp-title { margin: 4px 0 18px; font-size: 34px; font-weight: 700; letter-spacing: -.02em; color: var(--settings-ink); }
.dp-block { padding: 16px 16px 18px; }
.dp-block h2 { margin: 0 0 6px; font-size: 17px; font-weight: 600; color: var(--settings-ink); }
.dp-block p { margin: 0 0 10px; font-size: 15px; line-height: 1.5; color: var(--settings-muted); }
.dp-block p:last-child { margin-bottom: 0; }
.dp-link { width: 100%; display: flex; align-items: center; justify-content: space-between;
  min-height: 56px; padding: 0 16px; border: 0; background: transparent; font: inherit;
  font-size: 16px; color: var(--settings-ink); cursor: pointer; text-align: start; }
.dp-link + .dp-link { border-top: 1px solid var(--settings-line); }
.dp-link:active { background: var(--settings-line); }
.dp-link.dp-red { color: var(--settings-red, #e5484d); }
.dp-link svg { width: 18px; height: 18px; color: var(--settings-muted); }
`;

export default function SettingsPrivacyPage() {
  const navigate = useNavigate();
  const lang = useUserLang();
  const isAr = lang === "ar-eg";
  const tx = (t: string) => translateExactText(t, lang);
  const Chev = isAr ? ChevronLeft : ChevronRight;
  const ar = (a: string, e: string) => (isAr ? a : e);

  return (
    <div className="pep-root" dir={isAr ? "rtl" : "ltr"}>
      <style>{pepCss + privacyCss}</style>
      <div className="pep-sheet">
        <header className="pep-topbar">
          <button className="pep-icon-btn" aria-label={tx("Close")} onClick={() => navigate("/settings")}>
            <X className="pep-chev" strokeWidth={1.9} />
          </button>
          <span />
          <span />
        </header>
        <main className="pep-main">
          <h1 className="dp-title">{ar("البيانات والخصوصية", "Data & privacy")}</h1>

          <section className="pep-card dp-block">
            <h2>{ar("محادثاتك", "Your conversations")}</h2>
            <p>{ar("بنستخدم رسايلك وملفاتك عشان Megsy يرد عليك وينفذ شغلك بس. محادثاتك خاصة بيك ومحدش غيرك يقدر يشوفها.",
              "We use your messages and files only to answer you and get your work done. Your chats are private to you.")}</p>
          </section>

          <section className="pep-card dp-block">
            <h2>{ar("مشاركة البيانات", "Data sharing")}</h2>
            <p>{ar("مش بنبيع بياناتك ومش بنستخدمها في إعلانات. بنبعت للمزودين اللي بيشغلوا الذكاء الاصطناعي اللازم بس لتنفيذ طلبك.",
              "We never sell your data or use it for ads. Only what's needed to run your request is sent to our AI providers.")}</p>
          </section>

          <section className="pep-card">
            <button className="dp-link" onClick={() => navigate("/privacy")}>
              <span>{ar("سياسة الخصوصية", "Privacy policy")}</span><Chev />
            </button>
            <button className="dp-link" onClick={() => navigate("/terms")}>
              <span>{ar("شروط الخدمة", "Terms of service")}</span><Chev />
            </button>
          </section>

          <section className="pep-card">
            <button className="dp-link dp-red" onClick={() => navigate("/settings/delete-account")}>
              <span>{ar("حذف الحساب", "Delete account")}</span><Chev />
            </button>
          </section>
          <div className="pep-spacer" />
        </main>
      </div>
    </div>
  );
}
