import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./CardPreview";
import artCoat from "@/assets/orange-coat.png.asset.json";

import {
  type HostedMethod,
  type KashierOrder,
  isKashierUrl,
  onlyDigits,
  openHostedSession,
  payWithCard,
  requestWalletPayment,
  watchWalletPayment,
} from "@/lib/payments/kashier";
import type { PlanTier } from "@/data/pricingData";

type Props = { open: boolean; tier: PlanTier; interval: "monthly" | "yearly"; onClose: () => void };
type PaymentMethod = HostedMethod;

function formatCardNumber(value: string) {
  return onlyDigits(value)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export default function CustomCardForm({ open, tier, interval, onClose }: Props) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threeDsUrl, setThreeDsUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [result, setResult] = useState<"idle" | "processing" | "success">("idle");
  const [stage, setStage] = useState<"main" | "wallet">("main");
  const [method, setMethod] = useState<TileId>("visa");
  const [hostedUrl, setHostedUrl] = useState<string | null>(null);
  const [hostedLabel, setHostedLabel] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [walletWaiting, setWalletWaiting] = useState(false);
  const stopWatchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    const listener = (event: MessageEvent) => {
      if (!isKashierUrl(event.origin)) return;
      const data = event.data as { message?: string; params?: { status?: string } } | null;
      if (data?.message !== "merchantStoreRedirect") return;
      setThreeDsUrl(null);
      setBusy(false);
      if (data.params?.status === "SUCCESS") setResult("success");
      else setError("Your bank didn’t confirm the payment. Try another card or a different method.");
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [open]);
  useEffect(() => {
    if (!open) {
      setNumber("");
      setName("");
      setMonth("");
      setYear("");
      setCvv("");
      setBusy(false);
      setError(null);
      setThreeDsUrl(null);
      setOrderId(null);
      setResult("idle");
      setStage("main");
      setHostedUrl(null);
      setPhone("");
      setWalletWaiting(false);
    }
    if (!open) { stopWatchRef.current?.(); stopWatchRef.current = null; }
  }, [open]);
  useEffect(() => () => stopWatchRef.current?.(), []);
  if (!open) return null;

  const fail = (cause: unknown, fallback: string) => {
    setError(cause instanceof Error ? cause.message : fallback);
    setBusy(false);
  };

  const openHostedCheckout = async (selectedMethod: PaymentMethod, label: string) => {
    setBusy(true);
    setError(null);
    setHostedLabel(label);
    try {
      setHostedUrl(await openHostedSession(tier, interval, selectedMethod));
      setBusy(false);
    } catch (cause) {
      fail(cause, "Something went wrong while opening the payment page.");
    }
  };

  const submitCard = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    setResult("processing");
    try {
      const outcome = await payWithCard(tier, interval, { number, name, month, year, cvv });
      setOrderId(outcome.orderId);
      if (outcome.kind === "3ds") setThreeDsUrl(outcome.url);
      else setResult("success");
    } catch (cause) {
      fail(cause, "Something went wrong while paying.");
      setResult("idle");
    } finally {
      setNumber("");
      setName("");
      setMonth("");
      setYear("");
      setCvv("");
    }
  };

  const submitWallet = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const order: KashierOrder = await requestWalletPayment(tier, interval, phone);
      setOrderId(order.order_id);
      setWalletWaiting(true);
      setBusy(false);
      stopWatchRef.current?.();
      stopWatchRef.current = watchWalletPayment(order, (status) => {
        stopWatchRef.current = null;
        setWalletWaiting(false);
        setBusy(false);
        if (status === "success") setResult("success");
        else if (status === "expired") setError("The approval window expired. Please try again.");
        else setError("The wallet declined the payment or its window expired. Please try again.");
      });
    } catch (cause) {
      fail(cause, "Something went wrong while paying.");
    }
  };

  const cancelWallet = () => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
    setWalletWaiting(false);
    setBusy(false);
    setError(null);
  };

  const onHostedLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const href = event.currentTarget.contentWindow?.location.href;
      if (href && href.startsWith(window.location.origin)) {
        setHostedUrl(null);
        const status = new URL(href).searchParams.get("paymentStatus");
        if (status && status !== "SUCCESS") setError("The payment didn’t complete. Please try again.");
        else setResult("success");
      }
    } catch {}
  };

  const back = () => {
    if (hostedUrl) {
      setHostedUrl(null);
      return;
    }
    if (walletWaiting) {
      cancelWallet();
      return;
    }
    if (busy) return;
    if (stage !== "main" && !threeDsUrl && result !== "success") {
      setStage("main");
      setError(null);
    } else onClose();
  };

  const view = hostedUrl ? "hosted" : threeDsUrl ? "verify" : result === "success" ? "done" : stage;

  return (
    <section className="botanical-pricing megsy-checkout z-[120]" dir="ltr" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div aria-hidden="true" className="botanical-art">
        <img src={artCoat.url} alt="" fetchPriority="high" width={768} height={1376} />
      </div>
      <div aria-hidden="true" className="botanical-scrim" />
      <div className="botanical-content botanical-checkout-content">
        <header className="checkout-nav">
          <Button variant="ghost" type="button" onClick={back} disabled={busy && !hostedUrl} aria-label="Back" title="Back" className="megsy-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </header>

        <div key={view} className="checkout-stage">
          <h1 id="checkout-title" className="checkout-title">
            {result === "success"
              ? "Payment complete"
              : threeDsUrl
                ? "Confirm your payment"
                : hostedUrl
                  ? `Pay with ${hostedLabel}`
                  : "Payment"}
          </h1>
          {hostedUrl && result !== "success" ? (
            <div className="mt-6 flex-1">
              <iframe title={`Pay with ${hostedLabel}`} src={hostedUrl} onLoad={onHostedLoad} allow="payment *" className="h-[min(640px,72dvh)] w-full rounded-2xl bg-card" />
            </div>
          ) : threeDsUrl ? (
            <div className="mt-6 flex-1 space-y-4">
              <p className="checkout-note">Complete your bank’s verification to finish the payment.</p>
              <iframe title="Bank verification" src={threeDsUrl} className="h-[480px] w-full rounded-2xl bg-card" />
            </div>
          ) : result === "success" ? (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <span className="checkout-success-badge"><Check aria-hidden="true" /></span>
                <h2 className="checkout-subtitle mt-6 text-xl font-semibold">Thank you</h2>
                <p className="checkout-note mt-3">We’re confirming the payment and activating your subscription in a moment.</p>
                {orderId && <p className="mt-2 max-w-full break-all font-mono text-xs text-muted-foreground">{orderId}</p>}
              </div>
              <Button variant="ghost" type="button" className="megsy-pay-cta" onClick={onClose}>Continue</Button>
            </div>
          ) : (
            <div className="checkout-allinone">
              <div className="checkout-methods" role="tablist" aria-label="Payment method">
                {METHODS.map((m) => (
                  <Button variant="ghost" key={m.id} type="button" role="tab" aria-selected={method === m.id} data-selected={method === m.id} disabled={busy || walletWaiting} onClick={() => { setError(null); setMethod(m.id); }} className="checkout-method">
                    <TileLogo id={m.id} />
                    <span>{m.label}</span>
                  </Button>
                ))}
              </div>
              <div key={method} className="checkout-panel">
                {method === "visa" ? (
                  <form onSubmit={submitCard} className="checkout-card-form" autoComplete="off">
                    <Field label="Card number"><input inputMode="numeric" autoComplete="cc-number" dir="ltr" value={formatCardNumber(number)} onChange={(e) => setNumber(e.target.value)} placeholder="1234 5678 9012 3456" /></Field>
                    <Field label="Name on card"><input autoComplete="cc-name" dir="ltr" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Expiry"><input inputMode="numeric" autoComplete="cc-exp" value={month ? `${month}${month.length === 2 ? " / " : ""}${year}` : ""} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setMonth(d.slice(0, 2)); setYear(d.slice(2)); }} placeholder="MM / YY" /></Field>
                      <Field label="CVV"><input type="password" inputMode="numeric" autoComplete="cc-csc" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="•••" /></Field>
                    </div>
                    {error && <ErrorBox text={error} />}
                    <Button variant="ghost" type="submit" data-plain disabled={busy} className="megsy-pay-cta">
                      {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</> : "Pay now"}
                    </Button>
                  </form>
                ) : method === "vodafone" ? (
                  <form onSubmit={submitWallet} className="checkout-card-form" autoComplete="off">
                    {walletWaiting ? (
                      <div className="flex flex-col items-center py-6 text-center">
                        <Loader2 className="h-9 w-9 animate-spin" />
                        <h2 className="checkout-subtitle mt-4 text-lg font-semibold">Approve the payment on your phone</h2>
                        <p className="checkout-note mt-2">Request sent to <span dir="ltr">+20 {phone}</span>. Open Ana Vodafone or dial *9#, then enter your PIN.</p>
                        <Button variant="ghost" type="button" onClick={cancelWallet} className="megsy-pay-quiet mt-4">Change number or cancel</Button>
                      </div>
                    ) : (
                      <>
                        <Field label="Wallet number">
                          <span className="wallet-prefix">+20</span>
                          <input inputMode="tel" autoComplete="tel-national" dir="ltr" aria-label="Vodafone Cash wallet number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="10 0000 0000" />
                        </Field>
                        <p className="checkout-note">We'll send a payment request to approve on your phone.</p>
                        {error && <ErrorBox text={error} />}
                        <Button variant="ghost" type="submit" data-plain disabled={busy} className="megsy-pay-cta">
                          {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Sending…</> : "Send payment request"}
                        </Button>
                      </>
                    )}
                  </form>
                ) : (
                  <div className="checkout-card-form">
                    <p className="checkout-note">Pay securely with {method === "apple_pay" ? "Apple Pay" : "Google Pay"} — no card details needed.</p>
                    {error && <ErrorBox text={error} />}
                    <Button variant="ghost" type="button" disabled={busy} onClick={() => void openHostedCheckout("card", method === "apple_pay" ? "Apple Pay" : "Google Pay")} className="wallet-pay-btn">
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{method === "apple_pay" ? <TileLogo id="apple_pay" /> : <TileLogo id="google_pay" />}<span>Pay</span></>}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type TileId = "visa" | "mastercard" | "apple_pay" | "google_pay" | "vodafone";
const METHODS: Array<{ id: TileId; label: string }> = [
  { id: "visa", label: "Card" },
  { id: "apple_pay", label: "Apple Pay" },
  { id: "google_pay", label: "Google Pay" },
  { id: "vodafone", label: "Vodafone" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="checkout-field">
      <span>{label}</span>
      <div className="checkout-input-wrap">{children}</div>
    </label>
  );
}

function TileLogo({ id }: { id: TileId }) {
  switch (id) {
    case "visa":
    case "mastercard":
      return (
        <span className="payment-card-pair" aria-hidden="true">
          <BrandMark brand="visa" />
          <BrandMark brand="mastercard" />
        </span>
      );

    case "apple_pay":
      return (
        <svg viewBox="0 0 17 20" className="h-[17px] w-[15px]" fill="currentColor">
          <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM11.5 3c.7-.9 1.2-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3.1 1.1.1 2.2-.6 2.9-1.4z" />
        </svg>
      );
    case "google_pay":
      return (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]">
          <path className="payment-blue" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
          <path className="payment-green" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1A12 12 0 0 0 12 24z" />
          <path className="payment-gold" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.3a12 12 0 0 0 0 10.9z" />
          <path className="payment-red" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
        </svg>
      );
    case "vodafone":
      return (
        <svg viewBox="0 0 24 24" className="h-[20px] w-[20px]">
          <circle cx="12" cy="12" r="12" className="payment-red" />
          <path className="payment-white" d="M12.6 5.2c2.3-.6 4.4.2 5 .6-1.8.1-3.5 1.4-3.5 3.6 2 .5 3.4 2 3.4 4.2 0 2.700-2.300 4.900-5.200 4.900-3.300 0-5.700-2.700-5.700-6 0-3.600 2.500-6.500 6-7.300z" />
        </svg>
      );
  }
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p
      role="alert"
      className="checkout-error"
    >
      {text}
    </p>
  );
}
