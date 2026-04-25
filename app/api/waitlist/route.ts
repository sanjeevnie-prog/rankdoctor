import { NextResponse } from "next/server";
import { Resend } from "resend";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM ?? "Ninety <onboarding@resend.dev>";
  const replyTo = process.env.NOTIFICATION_EMAIL;

  if (!convexUrl) {
    return NextResponse.json(
      { error: "Waitlist isn't configured yet. Missing NEXT_PUBLIC_CONVEX_URL." },
      { status: 500 },
    );
  }

  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email !== "string") throw new Error();
    email = body.email.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "That doesn't look like a valid email." },
      { status: 400 },
    );
  }

  let isNew = false;
  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = (await convex.mutation(anyApi.waitlist.add, {
      email,
      source: "landing",
    })) as { isNew: boolean };
    isNew = result.isNew;
  } catch (err) {
    console.error("Convex mutation failed:", err);
    return NextResponse.json(
      { error: "Could not save your email. Try again in a moment." },
      { status: 502 },
    );
  }

  if (!isNew) {
    return NextResponse.json(
      { ok: true, alreadySubscribed: true },
      { status: 200 },
    );
  }

  if (!resendKey) {
    return NextResponse.json(
      { ok: true, emailSent: false, note: "Saved. Email disabled (RESEND_API_KEY not set)." },
      { status: 200 },
    );
  }

  const resend = new Resend(resendKey);
  const send = await resend.emails.send({
    from: fromAddress,
    to: email,
    replyTo,
    subject: "You're on the Ninety waitlist.",
    text: welcomeText(),
    html: welcomeHtml(),
  });

  if (send.error) {
    console.error("Resend emails.send failed:", send.error);
    return NextResponse.json(
      { ok: true, emailSent: false },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, emailSent: true }, { status: 200 });
}

function welcomeText() {
  return [
    "You're on the list.",
    "",
    "Ninety turns a raw episode into publish-ready show notes in ninety seconds — chapters, pull quotes, guest bios, links, and platform-specific formatting.",
    "",
    "We'll email you once when the doors open. Reply to this message if you want to tell us what you'd like it to do for your show.",
    "",
    "— The Ninety team",
  ].join("\n");
}

function welcomeHtml() {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2ece1;font-family:Georgia,'Times New Roman',serif;color:#17130f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ece1;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#f2ece1;">
            <tr>
              <td style="padding:0 0 24px 0;border-bottom:1px solid #c9beab;">
                <div style="font-family:'SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8a7d6d;">Ninety — waitlist confirmation</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 0 8px 0;">
                <h1 style="margin:0;font-family:Georgia,serif;font-size:40px;line-height:1.05;letter-spacing:-0.02em;color:#17130f;">
                  You're on the list.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 0 8px 0;font-size:17px;line-height:1.6;color:#3a3129;">
                Ninety turns a raw episode into publish-ready show notes in <strong>ninety seconds</strong> — chapters, pull quotes, guest bios, links, and platform-specific formatting.
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0 24px 0;font-size:17px;line-height:1.6;color:#3a3129;">
                We'll email you once, when the doors open. Reply to this message if you want to tell us what you'd love it to do for your show — we read every one.
              </td>
            </tr>
            <tr>
              <td style="padding:24px 0 0 0;border-top:1px solid #c9beab;font-family:'SF Mono',Menlo,monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8a7d6d;">
                — The Ninety team
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
