/** @doc Billing — plan status, credit top-ups and cancel subscription, as a glass sheet over settings. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunction";
import { claimDailyCredits, fetchCreditOverview, type CreditOverview } from "@/lib/creditsSystem";
import { translateExactText, useUserLang } from "@/lib/authI18n";
import CreditPacks from "@/components/billing/CreditPacks";
import { pepCss } from "@/pages/settings/ProfileEditPage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function UsagePage() {
  const navigate = useNavigate();
  const lang = useUserLang();
  const ar = lang === "ar-eg";
  const loc = ar ? "ar-EG" : "en-US";
  const t = (s: string) => translateExactText(s, lang);
  const [ov, setOv] = useState<CreditOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!dead) {
          setSignedOut(true);
          setLoading(false);
        }
        return;
      }
      await claimDailyCredits();
      const o = await fetchCreditOverview();
      if (dead) return;
      setOv(o);
      setLoading(false);
    })();
    return () => {
      dead = true;
    };
  }, []);

  const plan = (ov?.plan ?? "free").toLowerCase();
  const paid = plan !== "free";
  const fmt = (n: number) => Math.round(n).toLocaleString(loc);

  const refreshIn = useMemo(() => {
    if (!ov?.nextRefresh) return null;
    const mins = Math.max(0, Math.round((new Date(ov.nextRefresh).getTime() - Date.now()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return ar ? (h ? `${h} س ${m} د` : `${m} د`) : h ? `${h}h ${m}m` : `${m}m`;
  }, [ov?.nextRefresh, ar]);

  const usedPct = ov && ov.dailyAllowance > 0 ? Math.min(100, (ov.spentToday / ov.dailyAllowance) * 100) : 0;

  const cancelSubscription = async () => {
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error(t("Sign in again to continue."));
      const { error } = await invokeFunction("kashier-checkout", {
        body: { kind: "cancel-subscription" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      setCancelled(true);
      setConfirmCancel(false);
      toast.success(t("Subscription cancelled. Your plan stays active until the end of the billing period."));
    } catch (e: any) {
      toast.error(e?.message || t("Could not cancel right now. Please contact support."));
    } finally {
      setCancelling(false);
    }
  };

  const status = cancelled
    ? ar ? "ملغي — شغال لآخر المدة" : "Cancelled — active until period ends"
    : paid
      ? ar ? "نشط · يتجدد تلقائيًا" : "Active · Auto-renews"
      : ar ? "الخطة المجانية" : "Free plan";

  return (
    <div className="pep-root" dir={ar ? "rtl" : "ltr"}>
      <style>{pepCss}</style>
      <style>{billCss}</style>
      <div className="pep-sheet">
        <header className="pep-topbar">
          <button
            type="button"
            aria-label={t("Back")}
            onClick={() => navigate("/settings", { replace: true })}
            className="pep-icon-btn"
          >
            <ChevronLeft className="pep-chev" strokeWidth={2.1} />
          </button>
          <h1 className="pep-title">{ar ? "الفاتورة" : "Billing"}</h1>
          <span className="pep-icon-btn" style={{ visibility: "hidden" }} />
        </header>

        {loading ? (
          <div className="bill-loading">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : signedOut ? (
          <p className="bill-empty">{ar ? "سجّل دخولك عشان تشوف رصيدك" : "Sign in to see your credits"}</p>
        ) : (
          <>
            <section className="bill-hero">
              <p className="bill-hero-label">{ar ? "رصيدك" : "Balance"}</p>
              <p className="bill-hero-num">{ov ? fmt(ov.credits) : "—"}</p>
              <span className="bill-chip">
                <span className={`bill-dot ${cancelled ? "off" : paid ? "on" : ""}`} />
                {paid ? <b>{plan}</b> : null}
                {status}
              </span>
            </section>

            <p className="bill-sec">{ar ? "النهارده" : "Today"}</p>
            <section className="pep-card bill-list">
              <div className="bill-li bill-li-col">
                <div className="bill-li-row">
                  <span>{ar ? "الاستخدام" : "Used"}</span>
                  <span className="bill-li-val">
                    {ov ? `${fmt(ov.spentToday)} / ${fmt(ov.dailyAllowance)}` : "—"}
                  </span>
                </div>
                <div className="bill-bar">
                  <div className="bill-bar-fill" style={{ width: `${usedPct}%` }} />
                </div>
              </div>
              <Row label={ar ? "التجديد بعد" : "Refreshes in"} value={refreshIn ?? "—"} />
              <Row label={ar ? "الشهر ده" : "This month"} value={ov ? fmt(ov.spentThisMonth) : "—"} />
            </section>

            <p className="bill-sec">{ar ? "تفاصيل الرصيد" : "Breakdown"}</p>
            <section className="pep-card bill-list">
              <Row label={ar ? "يومي" : "Daily"} value={ov ? fmt(ov.dailyCredits) : "—"} />
              <Row label={ar ? "الباقة" : "Plan"} value={ov ? fmt(ov.planCredits) : "—"} />
              <Row label={ar ? "هدايا" : "Bonus"} value={ov ? fmt(ov.bonusCredits) : "—"} />
              <Row label={ar ? "مشترى" : "Purchased"} value={ov ? fmt(ov.purchasedCredits) : "—"} />
            </section>

            <div className="bill-packs">
              <CreditPacks isPro={paid} />
            </div>

            {paid && !cancelled && (
              <button className="bill-cancel" type="button" onClick={() => setConfirmCancel(true)}>
                {ar ? "إلغاء الاشتراك" : "Cancel subscription"}
              </button>
            )}
          </>
        )}
        <div className="pep-spacer" />
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? "إلغاء الاشتراك؟" : "Cancel subscription?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هتفضل على الباقة المدفوعة لآخر المدة الحالية، وبعدها هترجع للخطة المجانية. الكريدت المشترى مش بيتمسح."
                : "You'll keep your paid plan until the end of the current period, then switch to the free plan. Purchased credits are kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>{ar ? "رجوع" : "Keep plan"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelSubscription();
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : ar ? "إلغاء الاشتراك" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bill-li">
      <span>{label}</span>
      <span className="bill-li-val">{value}</span>
    </div>
  );
}

const billCss = `
.pep-root .pep-title { font-size: 17px; font-weight: 600; letter-spacing: -0.01em; }
.pep-root .bill-loading { display: grid; place-items: center; height: 240px; color: var(--settings-muted); }
.pep-root .bill-empty { padding: 60px 0; text-align: center; font-size: 14px; color: var(--settings-muted); }
.pep-root .bill-hero { text-align: center; padding: 28px 0 32px; }
.pep-root .bill-hero-label { font-size: 13px; color: var(--settings-muted); }
.pep-root .bill-hero-num {
  margin-top: 6px; font-size: 56px; font-weight: 600; line-height: 1;
  letter-spacing: -0.04em; font-variant-numeric: tabular-nums; color: var(--settings-ink);
}
.pep-root .bill-chip {
  margin-top: 16px; display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 12px; border-radius: 999px; font-size: 12.5px;
  background: var(--settings-line); color: var(--settings-muted);
}
.pep-root .bill-chip b { color: var(--settings-ink); font-weight: 600; text-transform: capitalize; }
.pep-root .bill-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--settings-muted); }
.pep-root .bill-dot.on { background: hsl(145 60% 45%); }
.pep-root .bill-dot.off { background: var(--settings-red); }
.pep-root .bill-sec {
  margin: 22px 16px 8px; font-size: 13px; font-weight: 500; color: var(--settings-muted);
}
.pep-root .bill-list { padding: 0; overflow: hidden; }
.pep-root .bill-li {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 50px; padding: 0 18px; font-size: 15px; color: var(--settings-ink);
  border-bottom: 1px solid var(--settings-line);
}
.pep-root .bill-li:last-child { border-bottom: 0; }
.pep-root .bill-li-col { flex-direction: column; align-items: stretch; justify-content: center; gap: 10px; padding: 14px 18px; }
.pep-root .bill-li-row { display: flex; justify-content: space-between; }
.pep-root .bill-li-val { color: var(--settings-muted); font-variant-numeric: tabular-nums; }
.pep-root .bill-bar { height: 4px; border-radius: 999px; overflow: hidden; background: var(--settings-line); }
.pep-root .bill-bar-fill { height: 100%; border-radius: 999px; background: var(--settings-ink); transition: width .5s ease; }
.pep-root .bill-packs { margin-top: 28px; }
.pep-root .bill-packs .py-10 { padding-top: 0; padding-bottom: 0; }
.pep-root .bill-packs h2 { color: var(--settings-ink); }
.pep-root .bill-packs p { color: var(--settings-muted); }
.pep-root .bill-packs button {
  background: var(--settings-surface); border-color: var(--settings-glass-edge) !important;
  color: var(--settings-ink); border-radius: 20px; box-shadow: none;
}
.pep-root .bill-cancel {
  display: block; width: 100%; margin-top: 28px; padding: 14px;
  border-radius: 20px; background: transparent; border: 0;
  font-size: 15px; font-weight: 500; color: var(--settings-red);
}
`;
