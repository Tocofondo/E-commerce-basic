"""Endpoints del botón de arrepentimiento: alta pública (sin login, como
pide la norma) y gestión del admin."""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import rate_limit
from app.core.db.session import get_db
from app.core.email import build_withdrawal_emails, send_email_safe
from app.modules.auth.dependencies import get_current_admin_user
from app.modules.withdrawals.models import WithdrawalRequest
from app.modules.withdrawals.schemas import (
    WithdrawalCreate,
    WithdrawalCreated,
    WithdrawalRead,
    WithdrawalStatusUpdate,
)
from app.modules.withdrawals.service import (
    WithdrawalNotFoundError,
    create_withdrawal,
    list_withdrawals,
    set_withdrawal_status,
)

router = APIRouter(prefix="/withdrawals", tags=["withdrawals"])

# Público y manda mails: mismo criterio que forgot-password.
CREATE_IP_LIMIT = (10, 3600)


@router.post("", response_model=WithdrawalCreated, status_code=status.HTTP_201_CREATED)
def create(
    request: Request,
    body: WithdrawalCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> WithdrawalRequest:
    rate_limit.hit(f"withdrawal:ip:{rate_limit.client_ip(request)}", *CREATE_IP_LIMIT)
    withdrawal = create_withdrawal(db, body)
    for to_email, subject, text in build_withdrawal_emails(withdrawal):
        background_tasks.add_task(send_email_safe, to_email, subject, text)
    return withdrawal


@router.get("", response_model=list[WithdrawalRead])
def list_all(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
) -> list[WithdrawalRequest]:
    return list_withdrawals(db)


@router.patch("/{withdrawal_id}", response_model=WithdrawalRead)
def update_status(
    withdrawal_id: int,
    body: WithdrawalStatusUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin_user),
) -> WithdrawalRequest:
    try:
        return set_withdrawal_status(db, withdrawal_id, body.status)
    except WithdrawalNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trámite no encontrado"
        ) from exc
