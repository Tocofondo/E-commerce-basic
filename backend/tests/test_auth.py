from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.core.security import create_password_reset_token, password_fingerprint
from tests.conftest import API, PASSWORD, auth_headers


def _register(client, **overrides):
    body = {
        "email": "Nuevo@Ejemplo.Com",
        "phone": "+54 9 341 555-1234",
        "password": PASSWORD,
        "full_name": "Nuevo",
    }
    body.update(overrides)
    return client.post(f"{API}/auth/register", json=body)


def _login(client, email, password=PASSWORD):
    return client.post(f"{API}/auth/login", data={"username": email, "password": password})


def test_register_login_and_me(client):
    res = _register(client)
    assert res.status_code == 201
    # Email en minúsculas y teléfono normalizado a formato wa.me.
    assert res.json()["email"] == "nuevo@ejemplo.com"
    assert res.json()["phone"] == "5493415551234"

    token = _login(client, "NUEVO@ejemplo.com").json()["access_token"]
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["role"] == "customer"


def test_register_ignores_role(client):
    res = _register(client, role="admin")
    assert res.status_code == 201
    assert res.json()["role"] == "customer"


def test_register_rejects_duplicate_email(client):
    _register(client)
    assert _register(client, email="nuevo@ejemplo.com").status_code == 409


def test_register_rejects_invalid_phone(client):
    res = _register(client, phone="123")
    assert res.status_code == 422
    assert "celular argentino" in res.json()["detail"][0]["msg"]


def test_wrong_password_is_401(client, customer):
    assert _login(client, customer.email, "otra-clave-123").status_code == 401


def test_customer_cannot_use_admin_endpoints(client, customer):
    res = client.get(f"{API}/orders", headers=auth_headers(customer))
    assert res.status_code == 403


def test_reset_password_flow_is_single_use(client, customer):
    token = create_password_reset_token(
        customer.email, fingerprint=password_fingerprint(customer.hashed_password)
    )
    body = {"token": token, "new_password": "clave-nueva-456"}
    assert client.post(f"{API}/auth/reset-password", json=body).status_code == 200
    assert _login(client, customer.email, "clave-nueva-456").status_code == 200
    # Cambió la huella de la contraseña: el mismo link ya no sirve.
    assert client.post(f"{API}/auth/reset-password", json=body).status_code == 400


def test_reset_password_rejects_expired_token(client, customer):
    expired = jwt.encode(
        {
            "sub": customer.email,
            "exp": datetime.now(UTC) - timedelta(minutes=1),
            "scope": "password_reset",
            "pwd": password_fingerprint(customer.hashed_password),
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    res = client.post(
        f"{API}/auth/reset-password", json={"token": expired, "new_password": "clave-nueva-456"}
    )
    assert res.status_code == 400


def test_access_token_is_not_a_reset_token_and_vice_versa(client, customer):
    access_token = auth_headers(customer)["Authorization"].removeprefix("Bearer ")
    res = client.post(
        f"{API}/auth/reset-password",
        json={"token": access_token, "new_password": "clave-nueva-456"},
    )
    assert res.status_code == 400

    reset_token = create_password_reset_token(
        customer.email, fingerprint=password_fingerprint(customer.hashed_password)
    )
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {reset_token}"})
    assert me.status_code == 401


def test_update_profile(client, customer):
    res = client.patch(
        f"{API}/auth/me",
        json={"full_name": "Nombre Nuevo", "phone": "011 15 5555-1234"},
        headers=auth_headers(customer),
    )
    assert res.status_code == 200
    assert res.json()["full_name"] == "Nombre Nuevo"
    assert res.json()["phone"] == "5491155551234"


def test_change_password_revokes_other_sessions(client, customer):
    old_headers = auth_headers(customer)
    res = client.post(
        f"{API}/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "clave-nueva-456"},
        headers=old_headers,
    )
    assert res.status_code == 200
    new_token = res.json()["access_token"]

    assert client.get(f"{API}/auth/me", headers=old_headers).status_code == 401
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert me.status_code == 200


def test_change_password_requires_current_password(client, customer):
    res = client.post(
        f"{API}/auth/change-password",
        json={"current_password": "no-es-esta", "new_password": "clave-nueva-456"},
        headers=auth_headers(customer),
    )
    assert res.status_code == 400
