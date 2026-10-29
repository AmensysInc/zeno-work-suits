import html
import logging
import httpx
from app.core.config import settings

log = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(settings.sendgrid_api_key and settings.mail_from)


def send_login_details(user, temp_password: str, reset: bool = False) -> bool:
    """Emails sign-in details. Returns False (never raises) when email isn't set up or fails,
    so the admin can still hand the temporary password over manually."""
    if not email_configured():
        return False
    subject = (
        "Your Zeno TeamSuite password was reset"
        if reset
        else "Your Zeno TeamSuite account is ready"
    )
    intro = (
        "An administrator reset your password."
        if reset
        else "An administrator created a Zeno TeamSuite account for you."
    )
    name = html.escape(user.first_name)
    body = (
        f"<p>Hi {name},</p><p>{intro}</p>"
        f'<p><b>Sign in:</b> <a href="{settings.app_url}/login">{settings.app_url}/login</a><br>'
        f"<b>Email:</b> {html.escape(user.email)}<br>"
        f"<b>Temporary password:</b> <code>{html.escape(temp_password)}</code></p>"
        "<p>You'll be asked to choose your own password when you sign in.</p>"
    )
    return _send(user.email, subject, body)


def send_issue_update(user, issue, message: str) -> bool:
    """Emails an automation notice about an issue; False when email isn't set up."""
    if not email_configured():
        return False
    link = f"{settings.app_url}/issues/{issue.id}"
    body = (
        f"<p>Hi {html.escape(user.first_name)},</p><p>{html.escape(message)}</p>"
        f'<p><a href="{link}">{html.escape(issue.issue_key)}: '
        f"{html.escape(issue.summary)}</a></p>"
    )
    return _send(user.email, f"[{issue.issue_key}] {message}"[:200], body)


def _send(to: str, subject: str, body: str) -> bool:
    try:
        response = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
            json={
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": settings.mail_from, "name": settings.mail_from_name},
                "subject": subject,
                "content": [{"type": "text/html", "value": body}],
            },
            timeout=15,
        )
        if response.status_code >= 300:
            log.warning(
                "SendGrid rejected email: %s %s",
                response.status_code,
                response.text[:200],
            )
            return False
        return True
    except httpx.HTTPError as exc:
        log.warning("Could not send email: %s", exc)
        return False
