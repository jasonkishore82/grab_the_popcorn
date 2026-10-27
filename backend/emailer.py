"""Sends email through Resend (HTTP API) or any SMTP server such as Zoho Mail. With neither set up,
the message is printed to the server console so sign-up still works while developing."""
import html as _html
import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage


def configured():
    return bool(os.environ.get("RESEND_API_KEY") or os.environ.get("SMTP_HOST"))


def send_mail(to, subject, text, html):
    sender = os.environ.get("EMAIL_FROM") or "ClapBoxes <onboarding@resend.dev>"
    if os.environ.get("RESEND_API_KEY"):
        base = os.environ.get("RESEND_BASE_URL") or "https://api.resend.com"
        req = urllib.request.Request(
            f"{base}/emails",
            data=json.dumps({"from": sender, "to": [to], "subject": subject, "text": text, "html": html}).encode(),
            headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=10).read()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Resend refused the email ({e.code}): {e.read()[:200].decode(errors='replace')}")
        return True
    if os.environ.get("SMTP_HOST"):
        port = int(os.environ.get("SMTP_PORT") or 465)
        secure_env = os.environ.get("SMTP_SECURE")
        secure = (secure_env == "1") if secure_env else port == 465
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = sender, to, subject
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
        host = os.environ["SMTP_HOST"]
        if secure:
            smtp = smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=15)
        else:
            smtp = smtplib.SMTP(host, port, timeout=15)
            smtp.starttls(context=ssl.create_default_context())
        with smtp:
            if os.environ.get("SMTP_USER"):
                smtp.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASS", ""))
            smtp.send_message(msg)
        return True
    print(f"\n[email not configured, printing instead]\nTo: {to}\nSubject: {subject}\n{text}\n", flush=True)
    return False


def _esc(s):
    return _html.escape(str(s), quote=True)


def _layout(heading, lines, button_text, url):
    paragraphs = "".join(f'<p style="line-height:1.5">{_esc(l)}</p>' for l in lines)
    html = (
        '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#121212">'
        f'<h2 style="margin:0 0 12px">{_esc(heading)}</h2>{paragraphs}'
        f'<p><a href="{_esc(url)}" style="display:inline-block;background:#d90511;color:#fff;padding:12px 20px;'
        f'border-radius:10px;text-decoration:none;font-weight:600">{_esc(button_text)}</a></p>'
        '<p style="color:#80808a;font-size:13px">If the button does not work, paste this link into your browser:'
        f"<br>{_esc(url)}</p></div>"
    )
    text = f"{heading}\n\n" + "\n\n".join(lines) + f"\n\n{button_text}: {url}\n"
    return html, text


def verify_email(name, url):
    return _layout(
        f"Welcome, {name}",
        ["Confirm your email address so you can reset your password if you ever need to.", "This link works for 24 hours."],
        "Confirm email",
        url,
    )


def reset_email(name, url):
    return _layout(
        "Reset your password",
        [f"Hi {name}, we got a request to reset your ClapBoxes password.", "This link works for one hour. If it was not you, ignore this email and nothing changes."],
        "Choose a new password",
        url,
    )
