/** @doc Billing — plan status, credit top-ups, cancel subscription and history, as a glass sheet over settings. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  Clapperboard,
  Gift,
  Globe,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Presentation,
  RefreshCw,
  Search,
  Wand2,
  XCircle,
  Zap,
} from "lucide-react";
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

type Tx = {
  id: string;
  amount: number;
  description: string | null;
  action_type: string | null;
  created_at: string;
};

const LABELS: Record<string, [string, string]> = {
  reward: ["Reward", "مكافأة"],
  daily: ["Daily credits", "رصيد يومي"],
  video: ["Video", "فيديو"],
  edit: ["Image editing", "تعديل صورة"],
  image: ["Image", "صورة"],
  slides: ["Presentation", "عرض تقديمي"],
  research: ["Research", "بحث"],
  web: ["Website", "موقع"],
  chat: ["Chat", "محادثة"],
  task: ["Task", "مهمة"],
};

const ICONS: Record<string, typeof Zap> = {
  reward: Gift,
  daily: RefreshCw,
  video: Clapperboard,
  edit: Wand2,
  image: ImageIcon,
  slides: Presentation,
  research: Search,
  web: Globe,
  chat: MessageCircle,
  task: Zap,
};

/** Never expose upstream provider or model names in the UI. */
const kindOf = (raw: string | null, action: string | null) => {
  const s = `${raw ?? ""} ${action ?? ""}`.toLowerCase();
  if (/reward|follow|bonus/.test(s)) return "reward";
  if (/refresh|daily/.test(s)) return "daily";
  if (/video|veo|sora|kling|hailuo|seedance|ltx|minimax/.test(s)) return "video";
  if (/headshot|inpaint|remover|colorizer|sketch|retouch|image-tool/.test(s)) return "edit";
  if (/image|seedream|gpt-image|render/.test(s)) return "image";
  if (/slide|presentation/.test(s)) return "slides";
  if (/research|report/.test(s)) return "research";
  if (/page|code|web/.test(s)) return "web";
  if (/chat|message|agent|generation/.test(s)) return "chat";
  return "task";
};

export default function UsagePage() {
  const navigate = useNavigate();
  const lang = useUserLang();
  const ar = lang === "ar-eg";
  const loc = ar ? "ar-EG" : "en-US";
  const t = (s: string) => translateExactText(s, lang);
  const [ov, setOv] = useState<CreditOverview | null>(null);
  const [rows, setRows] = useState<Tx[]>([]);
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
      const [o, tx] = await Promise.all([
        fetchCreditOverview(),
        supabase
          .from("credit_transactions")
          .select("id, amount, description, action_type, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(80),
      ]);
      if (dead) return;
      setOv(o);
      setRows((tx.data as Tx[]) ?? []);
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

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const r of rows) {
      const k = new Date(r.created_at).toLocaleDateString(loc, { month: "long", day: "numeric" });
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return Array.from(map.entries());
  }, [rows, loc]);

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

        {/* Plan status */}
        <section className="pep-card bill-status">
          <div className="bill-status-top">
            <span className="bill-plan">
              <BadgeCheck className="h-3.5 w-3.5" />
              {paid ? plan : ar ? "مجاني" : "Free"}
            </span>
            {paid && !cancelled && (
              <span className="bill-renew">
                <CalendarClock className="h-3.5 w-3.5" />
                {ar ? "يتجدد تلقائيًا" : "Auto-renews"}
              </span>
            )}
          </div>
          <p className="bill-balance-label">{ar ? "رصيدك الحالي" : "Current balance"}</p>
          <p className="bill-balance">{ov ? fmt(ov.credits) : "—"}</p>
          <p className="bill-status-note">
            {cancelled
              ? ar
                ? "الاشتراك اتلغى — الباقة شغالة لآخر المدة المدفوعة"
                : "Cancelled — your plan stays active until the paid period ends"
              : paid
                ? ar
                  ? "اشتراكك شغال ومفيش أي مشكلة في الدفع"
                  : "Your subscription is active and payments are up to date"
                : ar
                  ? "أنت على الخطة المجانية"
                  : "You're on the free plan"}
          </p>
        </section>

        {/* Today */}
        <section className="pep-card bill-pad">
          <div className="bill-row-between">
            <p className="bill-sec-label">{ar ? "استخدام النهارده" : "Today's usage"}</p>
            <p className="bill-sec-val">{ov ? `${fmt(ov.spentToday)} / ${fmt(ov.dailyAllowance)}` : "—"}</p>
          </div>
          <div className="bill-bar">
            <div
              className="bill-bar-fill"
              style={{ width: `${Math.max(usedPct, ov && ov.spentToday > 0 ? 3 : 0)}%` }}
            />
          </div>
          <div className="bill-stats">
            <Stat label={ar ? "مهام" : "Tasks"} value={ov ? fmt(ov.tasksToday) : "—"} />
            <Stat label={ar ? "الشهر ده" : "This month"} value={ov ? fmt(ov.spentThisMonth) : "—"} />
            <Stat label={ar ? "التجديد" : "Refresh"} value={refreshIn ?? "—"} />
          </div>
        </section>

        {/* Balance breakdown */}
        <section className="pep-card bill-pad">
          <div className="bill-stats bill-stats-4">
            <Stat label={ar ? "يومي" : "Daily"} value={ov ? fmt(ov.dailyCredits) : "—"} />
            <Stat label={ar ? "هدايا" : "Bonus"} value={ov ? fmt(ov.bonusCredits) : "—"} />
            <Stat label={ar ? "الباقة" : "Plan"} value={ov ? fmt(ov.planCredits) : "—"} />
            <Stat label={ar ? "مشترى" : "Purchased"} value={ov ? fmt(ov.purchasedCredits) : "—"} />
          </div>
        </section>

        {!signedOut && (
          <div className="bill-packs">
            <CreditPacks isPro={paid} />
          </div>
        )}

        {paid && !cancelled && !signedOut && (
          <button className="pep-danger" type="button" onClick={() => setConfirmCancel(true)}>
            <XCircle className="pep-danger-ico" strokeWidth={1.7} />
            {ar ? "إلغاء الاشتراك" : "Cancel subscription"}
          </button>
        )}

        {/* History */}
        <h2 className="bill-hist-title">{ar ? "السجل" : "History"}</h2>
        {loading ? (
          <div className="grid h-32 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--settings-muted)" }} />
          </div>
        ) : signedOut ? (
          <p className="bill-empty">{ar ? "سجّل دخولك عشان تشوف رصيدك" : "Sign in to see your credits"}</p>
        ) : groups.length === 0 ? (
          <p className="bill-empty">{ar ? "لسه مفيش استخدام" : "No usage yet"}</p>
        ) : (
          <div className="space-y-6">
            {groups.map(([day, items]) => (
              <div key={day}>
                <p className="bill-day">{day}</p>
                <div className="pep-card bill-hist">
                  {items.map((it) => {
                    const amount = Number(it.amount) || 0;
                    const grant = amount < 0; // grants are stored as negatives
                    const kind = kindOf(it.description, it.action_type);
                    const Icon = ICONS[kind];
                    const label = LABELS[kind][ar ? 1 : 0];
                    return (
                      <div key={it.id} className="bill-tx">
                        <span className="bill-tx-ico">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="bill-tx-main">
                          <span className="bill-tx-label">{label}</span>
                          <span className="bill-tx-time">
                            {new Date(it.created_at).toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </span>
                        <span className="bill-tx-amt">
                          {grant ? "+" : "−"}
                          {fmt(Math.abs(amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bill-stat">
      <p className="bill-stat-val">{value}</p>
      <p className="bill-stat-label">{label}</p>
    </div>
  );
}

const billCss = `
.pep-root .pep-title { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
.pep-root .bill-status { padding: 22px; }
.pep-root .bill-status-top { display: flex; align-items: center; justify-content: space-between; }
.pep-root .bill-plan {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 999px;
  background: var(--settings-ink); color: var(--settings-surface);
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
}
.pep-root .bill-renew {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--settings-muted);
}
.pep-root .bill-balance-label { margin-top: 20px; font-size: 13px; font-weight: 500; color: var(--settings-muted); }
.pep-root .bill-balance {
  margin-top: 4px; font-size: 52px; font-weight: 700; line-height: 1;
  letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: var(--settings-ink);
}
.pep-root .bill-status-note { margin-top: 10px; font-size: 12.5px; color: var(--settings-muted); }
.pep-root .bill-pad { padding: 18px; }
.pep-root .bill-row-between { display: flex; align-items: baseline; justify-content: space-between; }
.pep-root .bill-sec-label { font-size: 14px; font-weight: 600; color: var(--settings-ink); }
.pep-root .bill-sec-val { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--settings-muted); }
.pep-root .bill-bar {
  margin-top: 12px; height: 10px; border-radius: 999px; overflow: hidden;
  background: var(--settings-line);
}
.pep-root .bill-bar-fill { height: 100%; border-radius: 999px; background: var(--settings-ink); transition: width .4s ease; }
.pep-root .bill-stats { margin-top: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; }
.pep-root .bill-stats-4 { margin-top: 0; grid-template-columns: repeat(2, 1fr); }
@media (min-width: 640px) { .pep-root .bill-stats-4 { grid-template-columns: repeat(4, 1fr); } }
.pep-root .bill-stat { border-radius: 16px; background: var(--settings-line); padding: 12px 8px; }
.pep-root .bill-stat-val { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--settings-ink); }
.pep-root .bill-stat-label { margin-top: 2px; font-size: 11.5px; color: var(--settings-muted); }
.pep-root .bill-packs .py-10 { padding-top: 0; padding-bottom: 0; }
.pep-root .bill-packs h2 { color: var(--settings-ink); }
.pep-root .bill-packs p { color: var(--settings-muted); }
.pep-root .bill-packs button {
  background: var(--settings-surface); border-color: var(--settings-glass-edge) !important;
  color: var(--settings-ink); border-radius: 20px;
}
.pep-root .bill-hist-title {
  margin: 28px 4px 12px; font-size: 12px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .08em; color: var(--settings-muted);
}
.pep-root .bill-day { margin: 0 4px 8px; font-size: 12.5px; font-weight: 500; color: var(--settings-muted); }
.pep-root .bill-hist { padding: 0; overflow: hidden; }
.pep-root .bill-tx {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  border-bottom: 1px solid var(--settings-line);
}
.pep-root .bill-tx:last-child { border-bottom: 0; }
.pep-root .bill-tx-ico {
  display: grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0;
  border-radius: 12px; background: var(--settings-line); color: var(--settings-ink);
}
.pep-root .bill-tx-main { min-width: 0; flex: 1; }
.pep-root .bill-tx-label { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500; color: var(--settings-ink); }
.pep-root .bill-tx-time { display: block; font-size: 12px; color: var(--settings-muted); }
.pep-root .bill-tx-amt { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--settings-ink); }
.pep-root .bill-empty { padding: 40px 0; text-align: center; font-size: 14px; color: var(--settings-muted); }
`;
