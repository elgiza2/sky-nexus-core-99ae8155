/** Shared reference sign-in and registration presentation with Megsy branding. */
import { ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";
import { AgentOrb } from "@/components/agent/AgentOrb";
import AuthAgentOrbit from "@/components/auth/AuthAgentOrbit";
import { AnimatePresence, m as motion, useReducedMotion } from "framer-motion";
import { useUserLang } from "@/lib/authI18n";
import { Button } from "@/components/ui/button";

interface Props {
  onGoogle: () => void; onMicrosoft?: () => void; onEmail: () => void; onBack?: () => void; onClose?: () => void; onTelegram?: () => void;
  expanded?: boolean; showPasswordField?: boolean; email?: string; setEmail?: (v: string) => void;
  password?: string; setPassword?: (v: string) => void; showPassword?: boolean; setShowPassword?: (v: boolean) => void;
  isSubmitting?: boolean; onSubmitEmail?: () => void; onSubmitPassword?: () => void; onForgotPassword?: () => void; error?: string | null;
  authMode?: "signup" | "signin"; onAuthModeChange?: (mode: "signup" | "signin") => void;
}
export default function MobileAuthIntro(p: Props) {
  const ar = useUserLang() === "ar-eg";
  const reducedMotion = useReducedMotion();
  const screen = !p.expanded ? "entry" : p.showPasswordField ? "password" : "email";
  const label = (provider: string) => ar ? `متابعة باستخدام ${provider}` : `Continue with ${provider}`;
  return <AnimatePresence mode="wait" initial={false}><motion.main key={screen} initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }} transition={{ duration: reducedMotion ? 0 : .24, ease: "easeOut" }} className={`megsy-auth-screen ${p.expanded ? "megsy-auth-expanded" : "megsy-auth-entry"}`} dir={ar ? "rtl" : "ltr"}>
    {p.expanded && <Button variant="ghost" type="button" className="megsy-auth-back" onClick={p.onBack} aria-label={ar ? "رجوع" : "Back"}><ArrowLeft size={20} /></Button>}
    <div className="megsy-auth-brand">
      {!p.expanded && <AuthAgentOrbit />}
      <div className="megsy-auth-brand-copy"><div className="megsy-auth-lockup">{p.expanded && <AgentOrb color="aurora" state="idle" size={64} />}<h1>Megsy</h1></div><p className="megsy-auth-tagline">{p.expanded ? (ar ? "أنشئ حسابك مجانًا" : "Create an account for free") : (ar ? <>فريقك من الوكلاء، جاهز دائمًا<br />لإنجاز شغلك.</> : <>Your team of always-on agents<br />that finish the work.</>)}</p></div>
    </div>
    <section className="megsy-auth-actions">
      {p.error && <p role="alert" className="megsy-auth-error">{p.error}</p>}
      {!p.expanded ? <>
        <Button variant="ghost" className="megsy-auth-pill" onClick={p.onGoogle}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.54 12.28c0-.82-.08-1.62-.22-2.4H12v4.54h6.48c-.28 1.5-1.12 2.78-2.4 3.64l3.7 2.88c2.16-2 3.42-4.94 3.42-8.66z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.06 7.94-2.9l-3.7-2.88c-1.02.68-2.34 1.1-4.24 1.1-2.86 0-5.34-2.02-6.36-4.96L1.28 17.4C3.26 21.3 7.32 24 12 24z"/><path fill="#FBBC05" d="M5.64 14.42a7.1 7.1 0 010-4.84L1.28 6.2A11.98 11.98 0 000 12c0 1.94.46 3.78 1.28 5.4l4.36-2.98z"/><path fill="#EA4335" d="M12 5.04c1.94 0 3.66.67 5.02 1.98l3.72-3.72C18.42 1.19 15.44 0 12 0 7.32 0 3.26 2.7 1.28 6.62l4.36 3.38C6.66 7.06 9.14 5.04 12 5.04z"/></svg><span>{label("Google")}</span></Button>
        <Button variant="ghost" className="megsy-auth-pill megsy-auth-primary" onClick={p.onEmail}><Mail size={21} /><span>{ar ? "التسجيل بالبريد الإلكتروني" : "Continue with email"}</span></Button>
      </> : <form className="megsy-auth-form" onSubmit={e => { e.preventDefault(); if (!p.isSubmitting) (p.showPasswordField ? p.onSubmitPassword : p.onSubmitEmail)?.(); }}>
        <h2>{ar ? (p.showPasswordField ? "أدخل كلمة المرور" : p.authMode === "signin" ? "تسجيل الدخول" : "أنشئ حسابك في Megsy") : (p.showPasswordField ? "Enter your password" : p.authMode === "signin" ? "Sign in to Megsy" : "Create your Megsy account")}</h2>
        <input className="megsy-auth-input" type="email" aria-label={ar ? "البريد الإلكتروني" : "Email address"} autoComplete="email" placeholder={ar ? "البريد الإلكتروني" : "Email address"} value={p.email ?? ""} onChange={e => p.setEmail?.(e.target.value)} disabled={p.showPasswordField} autoFocus dir="ltr" />
        {p.showPasswordField && <div className="megsy-auth-password"><input className="megsy-auth-input" type={p.showPassword ? "text" : "password"} aria-label={ar ? "كلمة المرور" : "Password"} autoComplete="current-password" placeholder={ar ? "كلمة المرور" : "Password"} value={p.password ?? ""} onChange={e => p.setPassword?.(e.target.value)} autoFocus dir="ltr" /><Button variant="ghost" type="button" onClick={() => p.setShowPassword?.(!p.showPassword)} aria-label={ar ? (p.showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور") : (p.showPassword ? "Hide password" : "Show password")}>{p.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</Button></div>}
        {p.showPasswordField && <Button variant="ghost" type="button" className="megsy-auth-forgot" onClick={p.onForgotPassword}>{ar ? "نسيت كلمة المرور؟" : "Forgot password?"}</Button>}
        <Button variant="ghost" type="submit" className="megsy-auth-pill megsy-auth-primary" disabled={p.isSubmitting || !(p.showPasswordField ? p.password?.trim() : p.email?.trim())}>{p.isSubmitting ? (ar ? "لحظة…" : "Please wait…") : ar ? (p.showPasswordField ? "تسجيل الدخول" : "متابعة") : (p.showPasswordField ? "Sign in" : "Continue")}</Button>
      </form>}
    </section>
  </motion.main></AnimatePresence>;
}
