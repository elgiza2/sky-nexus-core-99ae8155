/** Immersive subscription screen. Prices and checkout stay in the shared catalogue and parent. */
import { Check, ChevronRight, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUserLang } from "@/lib/authI18n";
import { useUserPlan } from "@/hooks/useUserPlan";
import { getDisplayPrice, getPlan, type PlanTier } from "@/data/pricingData";
import artwork from "@/assets/megsy-botanical-girl.jpg";

interface Props {
  isYearly: boolean;
  onToggleYearly: (yearly: boolean) => void;
  onSubscribe: (tier: PlanTier, opts?: { trial?: boolean }) => void;
  loadingTier?: PlanTier | null;
  onMenuClick?: () => void;
}

export default function MobilePricingScreen({ isYearly, onToggleYearly, onSubscribe, loadingTier }: Props) {
  const isAr = useUserLang() === "ar-eg";
  const navigate = useNavigate();
  const { plan } = useUserPlan();
  const subscribed = plan === "pro" || plan === "max" || plan === "elite";
  const pro = getPlan("pro");
  if (!pro) return null;
  const monthly = getDisplayPrice(pro, false);
  const yearly = getDisplayPrice(pro, true);
  const benefits = isAr
    ? ["١٬٠٠٠ رصيد Megsy كل شهر", "بحث وتصفح وبرمجة مع وكيلك", "إنشاء الصور والفيديو داخل الشات"]
    : ["1,000 Megsy Credits every month", "Research, browse & code with your agent", "Create images & video in chat"];
  const options = [
    { yearly: false, label: isAr ? "شهري" : "Monthly", price: monthly.price, note: isAr ? "للشهر الأول" : "First month", detail: isAr ? `ثم $${pro.monthlyPrice} / شهر` : `Then $${pro.monthlyPrice} / month` },
    { yearly: true, label: isAr ? "سنوي" : "Yearly", price: yearly.price, note: isAr ? "دفع سنوي" : "Billed yearly", detail: isAr ? `يعادل $${(yearly.price / 12).toFixed(2)} / شهر` : `$${(yearly.price / 12).toFixed(2)} / month equivalent` },
  ];
  const fine = subscribed
    ? (isAr ? "اشتراكك نشط. تقدر تديره أو تلغيه من إعدادات الاشتراك." : "Your subscription is active. Manage or cancel it in subscription settings.")
    : isYearly
      ? (isAr ? `$${yearly.price.toFixed(2)} سنويًا. الاشتراك بيتجدد تلقائيًا لحد ما تلغيه.` : `$${yearly.price.toFixed(2)} billed annually. Your subscription renews automatically unless cancelled.`)
      : (isAr ? `$${monthly.price.toFixed(2)} للشهر الأول، ثم $${pro.monthlyPrice.toFixed(2)} شهريًا. تقدر تلغي في أي وقت.` : `$${monthly.price.toFixed(2)} for the first month, then $${pro.monthlyPrice.toFixed(2)}/month. Cancel anytime.`);

  return (
    <section className="botanical-pricing" dir={isAr ? "rtl" : "ltr"} aria-label={isAr ? "اشتراك Megsy Pro" : "Megsy Pro subscription"}>
      <div className="botanical-art" aria-hidden="true">
        <img src={artwork} alt="" width={1024} height={1536} fetchPriority="high" />
      </div>
      <div className="botanical-scrim" aria-hidden="true" />
      <div className="botanical-content">
        <header className="botanical-nav">
          <Button variant="ghost" size="icon" className="botanical-close" aria-label={isAr ? "رجوع" : "Close pricing"} onClick={() => navigate(-1)} title={isAr ? "رجوع" : "Back"}><X /></Button>
          <Button variant="ghost" className="botanical-account" onClick={() => navigate(subscribed ? "/settings/billing" : "/auth?redirect=/pricing")}>
            {isAr ? "حسابي" : "My account"}
          </Button>
        </header>
        <div className="botanical-heading">
          <h1 dir="ltr">megsy <span>pro</span></h1>
          <p>{isAr ? "إمكانيات أكتر. أفكار بلا حدود." : "Unlock more possibilities with"}<br />{isAr ? "وكيلك الذكي، في مكان واحد." : "your personal AI agent."}</p>
        </div>
        <div className="botanical-details">
          <ul className="botanical-benefits">
            {benefits.map(text => <li key={text}><Check aria-hidden="true" /><span>{text}</span></li>)}
          </ul>
          <div className="botanical-options" role="group" aria-label={isAr ? "مدة الاشتراك" : "Billing interval"}>
            {options.map(option => {
              const selected = isYearly === option.yearly;
              return <Button key={String(option.yearly)} variant="ghost" className="botanical-option" data-selected={selected} aria-pressed={selected} onClick={() => onToggleYearly(option.yearly)}>
                {selected && <span className="botanical-selection"><Check aria-hidden="true" /></span>}
                <span className="botanical-option-label">{option.label}</span>
                <span className="botanical-price" dir="ltr">${option.price.toFixed(2)}</span>
                <span className="botanical-option-note">{option.note}</span>
                <span className="botanical-option-detail">{option.detail}</span>
              </Button>;
            })}
          </div>
          <Button variant="neutral" className="botanical-subscribe" disabled={loadingTier === "pro"} onClick={() => subscribed ? navigate("/settings/billing") : onSubscribe("pro", { trial: false })}>
            {loadingTier === "pro" ? <Loader2 className="animate-spin" /> : <>{subscribed ? (isAr ? "إدارة الاشتراك" : "Manage subscription") : (isAr ? "اشترك الآن" : "Subscribe")}<ChevronRight className="rtl-flip" /></>}
          </Button>
          <p className="botanical-fine">{fine}</p>
        </div>
      </div>
    </section>
  );
}
