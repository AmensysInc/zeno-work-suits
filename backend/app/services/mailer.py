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
        "Your Zeno Work Suite password was reset"
        if reset
        else "Your Zeno Work Suite account is ready"
    )
    intro = (
        "An administrator reset your password."
        if reset
        else "An administrator created a Zeno Work Suite account for you."
    )
    name = html.escape(user.first_name)
    body = (
        f"<p>Hi {name},</p><p>{intro}</p>"
        f"<p><b>Sign in:</b> <a href=\"{settings.app_url}/login\">{settings.app_url}/login</a><br>"
        f"<b>Email:</b> {html.escape(user.email)}<br>"
        f"<b>Temporary password:</b> <code>{html.escape(temp_password)}</code></p>"
        "<p>You'll be asked to choose your own password when you sign in.</p>"
    )
    try:
        response = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
            json={
                "personalizations": [{"to": [{"email": user.email}]}],
                "from": {"email": settings.mail_from, "name": settings.mail_from_name},
                "subject": subject,
                "content": [{"type": "text/html", "value": body}],
            },
            timeout=15,
        )
        if response.status_code >= 300:
            log.warning("SendGrid rejected login email: %s %s", response.status_code, response.text[:200])
            return False
        return True
    except httpx.HTTPError as exc:
        log.warning("Could not send login email: %s", exc)
        return False
