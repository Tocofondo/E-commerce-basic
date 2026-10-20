import re

from tests.conftest import API, auth_headers

BODY = {
    "fullName": "Cliente de Prueba",
    "email": "Cliente@Ejemplo.com",
    "phone": "341 555-1234",
    "orderNumber": "#12",
    "reason": "Me arrepentí",
}


def test_anyone_can_request_a_withdrawal_and_gets_a_code(client, sent_emails):
    res = client.post(f"{API}/withdrawals", json=BODY)
    assert res.status_code == 201
    code = res.json()["code"]
    assert re.fullmatch(r"ARR-[2-9A-HJ-NP-Z]{8}", code)
    # Solo el código: no expone datos de otros trámites.
    assert set(res.json()) == {"code", "createdAt"}

    assert {mail.to for mail in sent_emails} == {"cliente@ejemplo.com", "avisos@ejemplo.com"}
    assert all(code in mail.body for mail in sent_emails)


def test_withdrawal_list_is_admin_only(client, customer, admin):
    client.post(f"{API}/withdrawals", json=BODY)
    assert client.get(f"{API}/withdrawals").status_code == 401
    assert client.get(f"{API}/withdrawals", headers=auth_headers(customer)).status_code == 403

    items = client.get(f"{API}/withdrawals", headers=auth_headers(admin)).json()
    assert len(items) == 1
    assert items[0]["phone"] == "5493415551234"
    assert items[0]["status"] == "pendiente"


def test_admin_resolves_a_withdrawal(client, admin):
    client.post(f"{API}/withdrawals", json=BODY)
    withdrawal_id = client.get(f"{API}/withdrawals", headers=auth_headers(admin)).json()[0]["id"]
    res = client.patch(
        f"{API}/withdrawals/{withdrawal_id}",
        json={"status": "resuelta"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "resuelta"
