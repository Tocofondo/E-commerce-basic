"""Lógica de negocio del botón de arrepentimiento. Sin FastAPI."""

import logging
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.withdrawals.models import WithdrawalRequest
from app.modules.withdrawals.schemas import WithdrawalCreate, WithdrawalStatus

logger = logging.getLogger(__name__)

# Sin 0/O ni 1/I: el código se dicta por teléfono o se copia a mano.
_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


class WithdrawalNotFoundError(Exception):
    pass


def _new_code(db: Session) -> str:
    while True:
        code = "ARR-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
        if db.scalar(select(WithdrawalRequest.id).where(WithdrawalRequest.code == code)) is None:
            return code


def create_withdrawal(db: Session, data: WithdrawalCreate) -> WithdrawalRequest:
    request = WithdrawalRequest(code=_new_code(db), **data.model_dump())
    db.add(request)
    db.commit()
    db.refresh(request)
    logger.info("Pedido de arrepentimiento %s (pedido %s)", request.code, request.order_number)
    return request


def list_withdrawals(db: Session) -> list[WithdrawalRequest]:
    return list(db.scalars(select(WithdrawalRequest).order_by(WithdrawalRequest.created_at.desc())))


def set_withdrawal_status(
    db: Session, withdrawal_id: int, status: WithdrawalStatus
) -> WithdrawalRequest:
    request = db.get(WithdrawalRequest, withdrawal_id)
    if request is None:
        raise WithdrawalNotFoundError(withdrawal_id)
    request.status = status
    db.commit()
    db.refresh(request)
    return request
