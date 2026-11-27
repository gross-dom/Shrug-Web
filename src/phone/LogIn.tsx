import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ChevronRight, Plus } from "lucide-react";
import { FACES } from "../../store/shared/faces";
import {
  hidden,
  phoneOf,
  POINTS_PER_DOLLAR,
  type Picture,
} from "../../store/shared/rules";
import {
  clock,
  COUNT,
  enough,
  HEADS,
  pretty,
  said,
  shaped,
  squared,
  useLeft,
} from "../os/Account";
import {
  account,
  ACCOUNT_DEMO,
  addPhone,
  askLogIn,
  closeLogIn,
  demoLink,
  isLP,
  logIn,
  logOut,
  provePhone,
  refreshAccount,
  saveProfile,
  start,
  textTo,
  verify,
  type Failed,
  type Member,
  type Why,
} from "../os/account";
import { asked } from "../os/address";
import { Face } from "../os/Face";
import { launchApp } from "../os/launch";
import { useStore } from "../os/store";
import { wm } from "../os/wm";
import { chrome } from "./chrome";
import { closeSheet, launchAt, onPhone, openSheet, sys } from "./system";
import { Tray, useApp } from "./ui";
import "../styles/phone/login.css";

// Logging in, on a phone: a tray (ui.tsx, after Family's), up over whichever app asked, so that nobody is
// taken out of what they were doing. The steps are the desk's own (os/Account.tsx: an email; a number and
// six digits by text, or six digits to an inbox for an address on the list; a name, and then a picture, the
// first time), and so are the words. Someone logged in is shown their account in the same tray: their
// points, My VIP, their name and picture to change, and Log Out.
//
// One thing is the phone's own. A phone's keyboard comes up only for a press on a field: let go of between
// one step and the next, it would have to be asked for again each time. So every step that is typed is typed
// into the one field, which is never put away between them: it keeps the keyboard, and only what it asks for
// changes (letters for an address, figures for a number and a code). The picture is a step of its own after
// the name, with the keyboard gone, so that the faces are all in sight.
//
// An app that can ask puts the tray in its `SheetHost` under the name `LOGIN`. Anything that asks the desk
// for Log In (`askLogIn`) gets this one here.

export const LOGIN = "login";

type Stage =
  | { at: "email" }
  /** Someone new: their number. `adding`: for an account that is logged in already (it came by its inbox, or a link). */
  | { at: "phone"; adding: boolean }
  | {
      at: "code";
      kind: "new" | "text" | "inbox" | "add";
      phone?: string;
      to?: string;
      byInbox?: boolean;
      again: number;
    }
  | { at: "paused"; until: number; what: "number" | "address" }
  | { at: "name"; first: boolean }
  | { at: "picture"; first: boolean }
  | { at: "menu" };

/** The steps that are typed: they share the one field. */
const typed = (stage: Stage) =>
  stage.at === "email" ||
  stage.at === "phone" ||
  stage.at === "code" ||
  stage.at === "name";

function Flow({
  who,
  why,
  says,
  dark,
}: {
  who: Member | null;
  why: Why;
  says?: string;
  dark: boolean;
}) {
  const [at, setStage] = useState<Stage>(() =>
    who
      ? who.via === "link" && who.needs.phone
        ? { at: "phone", adding: true }
        : why === "name" && who.needs.profile
          ? { at: "name", first: true }
          : { at: "menu" }
      : { at: "email" },
  );
  // What is only for someone logged in is not shown to nobody: should they be logged out under it, it begins again
  const stage: Stage =
    !who &&
    (at.at === "menu" ||
      at.at === "name" ||
      at.at === "picture" ||
      (at.at === "phone" && at.adding))
      ? { at: "email" }
      : at;
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState(who?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState("");
  const [wrongs, setWrongs] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const typing = typed(stage);

  // The field has the keyboard from the moment the tray is up (it comes up for the press that asked for the
  // tray), and has it again whenever a step that is typed follows one that was not
  useLayoutEffect(() => {
    if (typing) field.current?.focus({ preventScroll: true });
  }, [typing]);

  const go = (next: Stage) => {
    setTold("");
    setCode("");
    setWrongs(0);
    setStage(next);
  };
  const fail = (failed: Failed, what: "number" | "address") => {
    if (failed.error === "locked")
      return go({
        at: "paused",
        until: Date.now() + (failed.retryIn ?? 600) * 1000,
        what,
      });
    setTold(said(failed.error));
  };
  /** What comes after getting in: a number for someone who came by their inbox or a link, then a name and picture the first time. */
  const onward = () => {
    const now = account.get();
    if (now.status !== "member") return go({ at: "email" });
    if (now.needs.phone && now.via !== "text")
      return go({ at: "phone", adding: true });
    if (now.needs.profile)
      return (setName(now.name), go({ at: "name", first: true }));
    closeSheet();
  };

  // ---- An email
  const sendEmail = async (byInbox = false) => {
    const address = (who?.email ?? email).trim();
    if (!address || busy) return;
    setBusy(true);
    setTold("");
    const started = await start(address, byInbox);
    setBusy(false);
    if ("error" in started) {
      if (started.error === "wait" && started.step)
        return go({
          at: "code",
          kind: started.step,
          to: started.to,
          byInbox,
          again: Date.now() + (started.retryIn ?? 45) * 1000,
        });
      return fail(started, "address");
    }
    if (started.step === "phone") return go({ at: "phone", adding: false });
    go({
      at: "code",
      kind: started.step,
      to: started.step === "text" ? started.to : undefined,
      byInbox,
      again: Date.now() + started.resendIn * 1000,
    });
  };

  // ---- A number: someone new's, or one being added to an account
  const sendPhone = async () => {
    if (stage.at !== "phone" || busy) return;
    if (!phoneOf(phone)) return setTold(said("phone"));
    setBusy(true);
    setTold("");
    const sent = stage.adding
      ? await addPhone(phone)
      : await textTo(email.trim(), phone);
    setBusy(false);
    if ("error" in sent) return fail(sent, "number");
    go({
      at: "code",
      kind: stage.adding ? "add" : "new",
      phone: sent.phone,
      again: Date.now() + sent.resendIn * 1000,
    });
  };

  // ---- Six digits
  const check = async (given: string) => {
    if (stage.at !== "code") return;
    setBusy(true);
    setTold("");
    const checked =
      stage.kind === "add"
        ? await provePhone(stage.phone!, given)
        : await verify({
            email: (who?.email ?? email).trim(),
            code: given,
            phone: stage.kind === "new" ? stage.phone : undefined,
            byInbox: stage.byInbox,
          });
    setBusy(false);
    if ("ok" in checked) return onward();
    if (checked.error === "wrong") {
      const left = checked.left ?? Math.max(0, 4 - wrongs);
      setWrongs((n) => n + 1);
      return setTold(
        `That code isn’t right. ${COUNT[left] ?? left} ${left === 1 ? "try" : "tries"} left.`,
      );
    }
    fail(checked, stage.kind === "inbox" ? "address" : "number");
  };
  const again = async () => {
    if (stage.at !== "code" || busy) return;
    setBusy(true);
    setTold("");
    setCode("");
    const sent =
      stage.kind === "add"
        ? await addPhone(stage.phone!)
        : stage.kind === "new"
          ? await textTo(email.trim(), stage.phone!)
          : await start((who?.email ?? email).trim(), stage.byInbox);
    setBusy(false);
    if ("error" in sent && sent.error !== "wait")
      return fail(sent, stage.kind === "inbox" ? "address" : "number");
    setWrongs(0);
    setStage({
      ...stage,
      again:
        Date.now() +
        ("resendIn" in sent
          ? sent.resendIn
          : ("retryIn" in sent && sent.retryIn) || 45) *
          1000,
    });
  };

  // ---- A name
  const saveName = async () => {
    if (stage.at !== "name" || busy) return;
    if (!name.trim()) return setTold(said("name"));
    setBusy(true);
    setTold("");
    const saved = await saveProfile({ name });
    setBusy(false);
    if ("error" in saved) return setTold(said(saved.error));
    go({ at: "picture", first: stage.first });
  };

  /** What the field holds at this step, and what typing in it does. */
  const value =
    stage.at === "email"
      ? email
      : stage.at === "phone"
        ? phone
        : stage.at === "code"
          ? code
          : stage.at === "name"
            ? name
            : "";
  const onType = (text: string, atEnd: boolean) => {
    if (stage.at === "email") return setEmail(text);
    // (set out as it is typed, while the typing is at its end; an edit in its middle is left alone)
    if (stage.at === "phone") return setPhone(atEnd ? shaped(text) : text);
    if (stage.at === "name") return setName(text.slice(0, 40));
    if (stage.at !== "code" || busy) return;
    const next = text.replace(/\D/g, "").slice(0, 6);
    // After a wrong one, whatever is typed begins the next
    setTold((was) => (was && next.length < 6 ? "" : was));
    setCode(next);
    if (next.length === 6) void check(next);
  };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (stage.at === "email") void sendEmail();
    else if (stage.at === "phone") void sendPhone();
    else if (stage.at === "name") void saveName();
  };
  // A wrong code stays in its boxes to be seen; the next digit typed begins a new one
  const bad = stage.at === "code" && !!told && code.length === 6;
  useEffect(() => {
    if (bad) field.current?.select();
  }, [bad]);

  const head = (() => {
    if (stage.at === "email")
      return {
        head: HEADS[why ?? "plain"].head,
        lead: says ?? HEADS[why ?? "plain"].lead,
      };
    if (stage.at === "phone") {
      if (!stage.adding)
        return {
          head: "What’s your number?",
          lead: "We’ll text you a code to use for logging in.",
        };
      const linked = who?.via === "link";
      return {
        head: linked
          ? `Welcome${who?.first ? `, ${who.first}` : ""}`
          : who?.needs.phone
            ? "Email confirmed"
            : "A new number",
        lead: linked
          ? `Your link confirmed ${who!.email}. Add a phone number to finish. It’s how you’ll log in next time.`
          : "Add a phone number. It’s how you’ll log in next time, with a texted code.",
      };
    }
    if (stage.at === "code") {
      const inbox = stage.kind === "inbox";
      return {
        head: inbox ? "Check your inbox" : "Enter the code",
        lead: inbox
          ? `We emailed six digits to ${hidden((who?.email ?? email).trim())} to confirm it’s you.`
          : stage.phone
            ? `Texted to ${pretty(stage.phone)}.`
            : `Texted to your number ending in ${stage.to ?? "••"}.`,
      };
    }
    if (stage.at === "name")
      return {
        head: stage.first ? "What’s your name?" : "Your name",
        lead: "Shown on your card and on anything you post.",
      };
    if (stage.at === "picture")
      return {
        head: "Pick a picture",
        lead: "One of ours, or a photo of your own.",
      };
    if (stage.at === "paused")
      return {
        head: "Too many tries",
        lead: `To keep your account safe, new codes are paused for this ${stage.what}.`,
      };
    return null;
  })();
  /** What each step asks the keyboard for: the field is the one field, and only this changes. */
  const asks =
    stage.at === "email"
      ? ({
          inputMode: "email",
          autoComplete: "email",
          placeholder: "you@example.com",
          label: "Email address",
          enterKeyHint: "next",
        } as const)
      : stage.at === "phone"
        ? ({
            inputMode: "tel",
            autoComplete: "tel",
            placeholder: "+1 (___) ___ ____",
            label: "Phone number",
            enterKeyHint: "next",
          } as const)
        : stage.at === "code"
          ? ({
              inputMode: "numeric",
              autoComplete: "one-time-code",
              placeholder: "",
              label:
                stage.kind === "inbox"
                  ? "The six digits we emailed"
                  : "The six digits we texted",
              enterKeyHint: "done",
            } as const)
          : ({
              inputMode: "text",
              autoComplete: "nickname",
              placeholder: "Your name",
              label: "Your name",
              enterKeyHint: "next",
            } as const);
  /** Pressing something in the tray leaves the keyboard where it is: the field keeps it. */
  const keep = {
    onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(),
  };

  if (stage.at === "menu" && who)
    return (
      <Tray label="Your account" title="Account" dark={dark}>
        <Menu
          who={who}
          onEdit={() => (setName(who.name), go({ at: "name", first: false }))}
          onPhone={() => go({ at: "phone", adding: true })}
        />
      </Tray>
    );

  const key =
    stage.at === "code"
      ? `code:${stage.kind}`
      : stage.at === "phone"
        ? `phone:${stage.adding}`
        : stage.at;
  return (
    <Tray
      label={who ? "Your account" : "Log in"}
      dark={dark}
      // (what the step asks is the tray's own title, as each of Family's trays is headed)
      title={
        head && (
          <span key={`head:${key}`} className="lt-head ios-tray__step">
            {head.head}
          </span>
        )
      }
    >
      <form className="lt" data-at={stage.at} onSubmit={submit} noValidate>
        {head && (
          <p key={`lead:${key}`} className="lt-lead ios-tray__step">
            {head.lead}
          </p>
        )}
        {typing && (
          <label
            key="field"
            className="lt-field"
            data-code={stage.at === "code" || undefined}
            data-bad={bad || undefined}
          >
            <span className="sr-only">{asks.label}</span>
            {/* (a field of words whatever it holds: it is what it asks the keyboard for that changes, so the field,
              and the keyboard with it, stay where they are from one step to the next) */}
            <input
              ref={field}
              type="text"
              inputMode={asks.inputMode}
              autoComplete={asks.autoComplete}
              autoCapitalize={stage.at === "name" ? "words" : "none"}
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={asks.enterKeyHint}
              placeholder={asks.placeholder}
              maxLength={
                stage.at === "code" ? 6 : stage.at === "name" ? 40 : undefined
              }
              aria-invalid={bad || undefined}
              value={value}
              onChange={(e) =>
                onType(
                  e.target.value,
                  e.target.selectionStart === e.target.value.length,
                )
              }
            />
            {stage.at === "code" && (
              <span className="lt-boxes" aria-hidden>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    data-cur={
                      (!bad && i === Math.min(code.length, 5)) || undefined
                    }
                  >
                    {code[i] ?? ""}
                  </span>
                ))}
              </span>
            )}
          </label>
        )}
        <div key={`acts:${key}`} className="lt-acts ios-tray__step">
          {told && (
            <p className="lt-said" role="alert">
              {told}
            </p>
          )}
          {stage.at === "email" && (
            <button
              type="submit"
              className="lt-go"
              disabled={busy || !email.trim()}
              {...keep}
            >
              {busy ? "One moment…" : "Continue"}
            </button>
          )}
          {stage.at === "phone" && (
            <>
              <button
                type="submit"
                className="lt-go"
                disabled={busy || !enough(phone)}
                {...keep}
              >
                {busy ? "Texting…" : "Text Me a Code"}
              </button>
              {!stage.adding && (
                <button
                  type="button"
                  className="lt-link"
                  {...keep}
                  onClick={() => go({ at: "email" })}
                >
                  Use a different email
                </button>
              )}
              {stage.adding && told === said("confirm") && (
                <button
                  type="button"
                  className="lt-link"
                  {...keep}
                  onClick={() => void sendEmail(true)}
                >
                  Email me a code
                </button>
              )}
            </>
          )}
          {stage.at === "code" && (
            <Again
              until={stage.again}
              waiting={!told}
              busy={busy}
              keep={keep}
              onAgain={() => void again()}
            />
          )}
          {stage.at === "name" && (
            <button
              type="submit"
              className="lt-go"
              disabled={busy || !name.trim()}
              {...keep}
            >
              {busy ? "Saving…" : "Continue"}
            </button>
          )}
          {stage.at === "picture" && who && (
            <Pictures
              who={who}
              onSaved={() => (stage.first ? closeSheet() : go({ at: "menu" }))}
            />
          )}
          {stage.at === "paused" && (
            <Paused
              until={stage.until}
              onOver={() => go(who ? { at: "menu" } : { at: "email" })}
            />
          )}
          {ACCOUNT_DEMO &&
            (stage.at === "email" ||
              stage.at === "phone" ||
              stage.at === "code") && (
              <p className="lt-note">
                {stage.at === "email"
                  ? "Demo: nothing is sent. An address beginning “lp” is on the list; any other is new."
                  : stage.at === "phone"
                    ? "Demo: no text is sent."
                    : "Demo: any six digits will do. 000000 is a wrong code."}
              </p>
            )}
        </div>
      </form>
    </Tray>
  );
}

/** Under the six boxes: when another code can be asked for, and the way to ask. */
function Again({
  until,
  waiting,
  busy,
  keep,
  onAgain,
}: {
  until: number;
  waiting: boolean;
  busy: boolean;
  keep: object;
  onAgain: () => void;
}) {
  const wait = useLeft(until);
  return wait > 0 && waiting ? (
    <p className="lt-wait">Send it again in {clock(wait)}</p>
  ) : (
    <button
      type="button"
      className="lt-link"
      disabled={busy}
      {...keep}
      onClick={onAgain}
    >
      Send a new code
    </button>
  );
}

function Paused({ until, onOver }: { until: number; onOver: () => void }) {
  const left = useLeft(until);
  return (
    <>
      <button
        type="button"
        className="lt-go"
        disabled={left > 0}
        onClick={onOver}
      >
        {left > 0 ? `Try again in ${clock(left)}` : "Try Again"}
      </button>
      <button
        type="button"
        className="lt-link"
        onClick={() => (closeSheet(), launchApp("messages"))}
      >
        Message Shrug for help
      </button>
    </>
  );
}

/** The picture: Shrug's faces four to a row, and last a photo of their own. The keyboard is away, so all of them are in sight. */
function Pictures({ who, onSaved }: { who: Member; onSaved: () => void }) {
  // Someone with no picture yet is offered one of the faces, theirs to change
  const [picture, setPicture] = useState<Picture>(
    () =>
      who.picture ?? {
        face: FACES[Math.floor(Math.random() * FACES.length)]!.id,
      },
  );
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const chosen = async (picked: File | undefined) => {
    if (!picked) return;
    try {
      const made = await squared(picked);
      setPhoto(made);
      setPicture({ url: made });
      setTold("");
    } catch {
      setTold(said("picture"));
    }
  };
  const save = async () => {
    setBusy(true);
    setTold("");
    const changed = JSON.stringify(picture) !== JSON.stringify(who.picture);
    const saved = changed
      ? await saveProfile(
          "face" in picture ? { face: picture.face } : photo ? { photo } : {},
        )
      : ({ ok: true } as const);
    setBusy(false);
    if ("error" in saved) return setTold(said(saved.error));
    onSaved();
  };
  const mine = "url" in picture ? picture.url : null;
  return (
    <>
      <div className="lt-faces" role="radiogroup" aria-label="Picture">
        {FACES.map((face) => {
          const on = "face" in picture && picture.face === face.id;
          return (
            <button
              key={face.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={face.says}
              data-on={on || undefined}
              onClick={() => setPicture({ face: face.id })}
            >
              <Face picture={{ face: face.id }} size={60} />
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={!!mine}
          aria-label={mine ? "Your photo. Choose another" : "Upload a photo"}
          data-on={!!mine || undefined}
          data-upload={!mine || undefined}
          onClick={() => file.current?.click()}
        >
          {mine ? (
            <Face picture={{ url: mine }} size={60} />
          ) : (
            <Plus size={22} strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => (
          void chosen(e.target.files?.[0]),
          (e.target.value = "")
        )}
      />
      {told && (
        <p className="lt-said" role="alert">
          {told}
        </p>
      )}
      <button
        type="button"
        className="lt-go"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Done"}
      </button>
    </>
  );
}

/** Someone logged in: who they are, what they have, and the ways on. */
function Menu({
  who,
  onEdit,
  onPhone,
}: {
  who: Member;
  onEdit: () => void;
  onPhone: () => void;
}) {
  const dollars = who.points / POINTS_PER_DOLLAR;
  const { app } = useApp();
  const to = (id: "myvip" | "updates") => {
    closeSheet();
    // (My VIP, asked for from My VIP itself, is where they are)
    if (id !== app) setTimeout(() => launchApp(id), 60);
  };
  return (
    <div className="lt lt-menu ios-tray__step">
      <div className="lt-who">
        <Face picture={who.picture} name={who.name} size={64} />
        <b>{who.name || who.email}</b>
        <small>
          {who.roles.length
            ? `${who.roles.join(" · ")}${who.funds.length ? ` · ${who.funds.join(", ")}` : ""}`
            : "Member"}
        </small>
      </div>
      <div className="lt-rows">
        <div className="lt-row">
          Points
          <small>
            {who.points.toLocaleString("en-US")} pts · $
            {dollars.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            {ACCOUNT_DEMO ? " · demo" : ""}
          </small>
        </div>
        {app !== "myvip" && (
          <button type="button" className="lt-row" onClick={() => to("myvip")}>
            My VIP
            <ChevronRight size={17} strokeWidth={2.6} aria-hidden />
          </button>
        )}
        {isLP(account.get()) && onPhone_("updates") && app !== "updates" && (
          <button
            type="button"
            className="lt-row"
            onClick={() => to("updates")}
          >
            Updates
            <ChevronRight size={17} strokeWidth={2.6} aria-hidden />
          </button>
        )}
        {who.needs.phone && (
          <button type="button" className="lt-row" onClick={onPhone}>
            Add a Phone Number
            <ChevronRight size={17} strokeWidth={2.6} aria-hidden />
          </button>
        )}
        <button type="button" className="lt-row" onClick={onEdit}>
          Name and Picture
          <ChevronRight size={17} strokeWidth={2.6} aria-hidden />
        </button>
      </div>
      <button
        type="button"
        className="lt-out"
        onClick={async () => {
          closeSheet();
          await logOut();
        }}
      >
        Log Out
      </button>
    </div>
  );
}
const onPhone_ = onPhone;

/** The tray itself: draw it from the app's `SheetHost` for the name `LOGIN`. */
export function LogInSheet() {
  const who = useStore(account, (s) => s);
  const why = useStore(logIn, (s) => s.why);
  const says = useStore(logIn, (s) => s.says);
  const member = who.status === "member" ? who : null;
  // It is as dark or as light as the app it is over: dark over a store, pale over the folder of updates
  const { app } = useApp();
  const dark = useStore(chrome, (c) => c[app] === "dark");
  if (who.status === "checking")
    return (
      <Tray label="Log in" dark={dark}>
        <div className="lt" aria-busy="true" />
      </Tray>
    );
  return <Flow who={member} why={why} says={says} dark={dark} />;
}

/** Asks for Log In from a phone's app: the same as the desk's, which the phone answers with its tray. */
export const phoneLogIn = (why: Why = null) => askLogIn(why);

/** Keeps the phone's tray and the desk's Log In as one thing: asked for, the tray comes up over the app in
 * front (over My VIP, from the Home Screen); put away, nothing is left asking. Also what the desk's menu bar
 * does as it arrives: asks who is logged in, and lets Log In down for someone sent here to log in (?login). */
export function useLogIn() {
  useEffect(() => {
    let up = sys.get().sheet === LOGIN;
    const wanted = () => {
      if (!wm.get().compact || !logIn.get().open) return;
      const s = sys.get();
      if (s.locked || s.sheet === LOGIN) return;
      if (s.app) openSheet(LOGIN);
      else launchAt("myvip", [], null, LOGIN);
    };
    const shown = () => {
      const is = sys.get().sheet === LOGIN;
      if (up && !is) closeLogIn();
      up = is;
      // (asked for while the phone was locked: it comes up once the phone is open)
      if (!is) wanted();
    };
    const offAsked = logIn.subscribe(wanted);
    const offShown = sys.subscribe(shown);
    const arrived = asked("login");
    if (arrived === "link") demoLink();
    void refreshAccount().then(() => {
      if (arrived === null || !wm.get().compact) return;
      askLogIn();
      const url = new URL(window.location.href);
      for (const key of [...url.searchParams.keys()])
        if (key.toLowerCase() === "login") url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", url);
    });
    return () => {
      offAsked();
      offShown();
    };
  }, []);
}
