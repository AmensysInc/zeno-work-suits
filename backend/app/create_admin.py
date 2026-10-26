"""Create (or promote) an administrator from the server shell.

    docker compose -f docker-compose.prod.yml exec backend \
        python -m app.create_admin you@company.com First Last

Prints a temporary password; the admin chooses their own on first sign-in.
"""

import sys
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select
from app.db.database import SessionLocal
from app.models import User
from app.core.security import hash_password
from app.services.auth import temporary_password


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    try:
        # Same rules as the sign-in form, so we never create an admin who can't log in.
        email = validate_email(argv[1].strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        print(f"Invalid email: {exc}")
        return 2
    first = argv[2] if len(argv) > 2 else "Admin"
    last = argv[3] if len(argv) > 3 else "User"
    temp = temporary_password()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            action = "Promoted existing user to administrator"
        else:
            user = User(first_name=first, last_name=last, email=email)
            db.add(user)
            action = "Created administrator"
        user.role = "ADMIN"
        user.is_active = True
        user.password_hash = hash_password(temp)
        user.must_change_password = True
        db.commit()
    print(f"{action}: {email}")
    print(f"Temporary password: {temp}")
    print("Sign in and you'll be asked to choose a new password.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
